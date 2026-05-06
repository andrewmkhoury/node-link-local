import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { add, remove } from '../lib/sync.js';
import { makeStandalonePackage, makeWorkspacePackage, makeApp, write, cleanup, readJson, makeTmp } from './fixtures.js';

const silent = () => {};

function pmAvailable(pm) {
  return spawnSync(pm, ['--version'], { shell: true, stdio: 'pipe' }).status === 0;
}

function makeSrc(name, pm, workspace = false) {
  const script = 'mkdir -p dist && printf "module.exports={}" > dist/index.js';
  if (workspace) {
    return makeWorkspacePackage({ name, version: '2.0.0', pm, buildScript: script });
  }
  return { pkgDir: makeStandalonePackage({ name, version: '2.0.0', pm, buildScript: script }), rootDir: null };
}

// ---------------------------------------------------------------------------
describe('npm standalone → npm app', () => {
  test('add installs tarball and updates package.json', () => {
    const { pkgDir, rootDir } = makeSrc('@test/mylib-npm', 'npm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      const pkg = readJson(path.join(appDir, 'package.json'));
      const ref = pkg.dependencies?.['@test/mylib-npm'] ?? pkg.devDependencies?.['@test/mylib-npm'];
      assert.ok(ref?.startsWith('file:.local-packages/'), `Expected file: ref, got ${ref}`);
      const tarballs = fs.readdirSync(path.join(appDir, '.local-packages')).filter(f => f.endsWith('.tgz'));
      assert.ok(tarballs.length > 0, 'Expected a tarball in .local-packages/');
      assert.ok(fs.existsSync(path.join(appDir, 'node_modules', '@test', 'mylib-npm')), 'Expected package in node_modules');
    } finally { cleanup(pkgDir, rootDir, appDir); }
  });

  test('remove cleans up tarball and cache dir', () => {
    const { pkgDir, rootDir } = makeSrc('@test/removeme-npm', 'npm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      assert.ok(readJson(path.join(appDir, 'package.json')).dependencies?.['@test/removeme-npm']?.startsWith('file:'));
      assert.ok(fs.existsSync(path.join(appDir, '.local-packages')));

      remove({ packageNameOrPath: '@test/removeme-npm', appPath: appDir }, silent);

      assert.ok(!readJson(path.join(appDir, 'package.json')).dependencies?.['@test/removeme-npm'], 'Dep should be removed');
      assert.ok(!fs.existsSync(path.join(appDir, '.local-packages')), 'Cache dir should be cleaned up');
    } finally { cleanup(pkgDir, rootDir, appDir); }
  });

  test('remove with no args removes all linked packages', () => {
    const { pkgDir: pkgDir1 } = makeSrc('@test/multi-a', 'npm');
    const { pkgDir: pkgDir2 } = makeSrc('@test/multi-b', 'npm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir1, appPath: appDir }, silent);
      add({ libPath: pkgDir2, appPath: appDir }, silent);
      remove({ packageNameOrPath: undefined, appPath: appDir }, silent);
      const pkg = readJson(path.join(appDir, 'package.json'));
      assert.ok(!pkg.dependencies?.['@test/multi-a']?.startsWith('file:'));
      assert.ok(!pkg.dependencies?.['@test/multi-b']?.startsWith('file:'));
    } finally { cleanup(pkgDir1, pkgDir2, appDir); }
  });

  test('add is idempotent: re-adding replaces the tarball ref', () => {
    const { pkgDir } = makeSrc('@test/idempotent', 'npm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      add({ libPath: pkgDir, appPath: appDir }, silent);
      const refs = Object.values(readJson(path.join(appDir, 'package.json')).dependencies ?? {})
        .filter(v => v.startsWith('file:.local-packages/'));
      assert.equal(refs.length, 1, 'Should have exactly one file: ref after double-add');
    } finally { cleanup(pkgDir, appDir); }
  });

  test('remove warns and no-ops for package not linked via node-link-local', () => {
    const appDir = makeApp({ pm: 'npm', existingDeps: { lodash: '^4.0.0' } });
    const logs = [];
    try {
      remove({ packageNameOrPath: 'lodash', appPath: appDir }, (m) => logs.push(m));
      assert.ok(logs.some(l => l.includes('not linked')));
      assert.equal(readJson(path.join(appDir, 'package.json')).dependencies?.lodash, '^4.0.0');
    } finally { cleanup(appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('pnpm standalone → npm app', () => {
  test('add and remove round-trip with pnpm source', { skip: !pmAvailable('pnpm') }, () => {
    const { pkgDir } = makeSrc('@test/mylib-pnpm-src', 'pnpm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      const ref = readJson(path.join(appDir, 'package.json')).dependencies?.['@test/mylib-pnpm-src'];
      assert.ok(ref?.startsWith('file:.local-packages/'), `Expected file: ref, got ${ref}`);
      remove({ packageNameOrPath: '@test/mylib-pnpm-src', appPath: appDir }, silent);
      assert.ok(!readJson(path.join(appDir, 'package.json')).dependencies?.['@test/mylib-pnpm-src']);
    } finally { cleanup(pkgDir, appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('yarn workspace → npm app', () => {
  test('add builds via workspace root and installs (original quarry bug scenario)', { skip: !pmAvailable('yarn') }, () => {
    const { rootDir, pkgDir } = makeSrc('@test/ws-yarn-e2e', 'yarn', true);
    const appDir = makeApp({ pm: 'npm' });
    const logs = [];
    try {
      add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
      assert.ok(logs.some(l => l.includes('yarn') && l.includes('workspace')), `Expected yarn workspace log\n${logs.join('\n')}`);
      const ref = readJson(path.join(appDir, 'package.json')).dependencies?.['@test/ws-yarn-e2e'];
      assert.ok(ref?.startsWith('file:.local-packages/'), `Expected file: ref, got ${ref}`);
    } finally { cleanup(rootDir, appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('pnpm workspace → npm app', () => {
  test('add builds via pnpm --filter and installs', { skip: !pmAvailable('pnpm') }, () => {
    const { rootDir, pkgDir } = makeSrc('@test/ws-pnpm-e2e', 'pnpm', true);
    const appDir = makeApp({ pm: 'npm' });
    const logs = [];
    try {
      add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
      assert.ok(logs.some(l => l.includes('pnpm') && l.includes('workspace')), `Expected pnpm workspace log\n${logs.join('\n')}`);
      const ref = readJson(path.join(appDir, 'package.json')).dependencies?.['@test/ws-pnpm-e2e'];
      assert.ok(ref?.startsWith('file:.local-packages/'), `Expected file: ref, got ${ref}`);
    } finally { cleanup(rootDir, appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('npm workspace → npm app', () => {
  test('add builds via npm --workspace and installs', () => {
    const { rootDir, pkgDir } = makeSrc('@test/ws-npm-e2e', 'npm', true);
    const appDir = makeApp({ pm: 'npm' });
    const logs = [];
    try {
      add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
      assert.ok(logs.some(l => l.includes('npm') && l.includes('workspace')), `Expected npm workspace log\n${logs.join('\n')}`);
      const ref = readJson(path.join(appDir, 'package.json')).dependencies?.['@test/ws-npm-e2e'];
      assert.ok(ref?.startsWith('file:.local-packages/'), `Expected file: ref, got ${ref}`);
    } finally { cleanup(rootDir, appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('restore manifest', () => {
  test('records original dep spec before overwriting', () => {
    const { pkgDir } = makeSrc('@test/restore-check', 'npm');
    const appDir = makeApp({ pm: 'npm', existingDeps: { '@test/restore-check': '^3.0.0' } });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      const manifest = readJson(path.join(appDir, '.local-packages', 'node-link-local-restore.json'));
      assert.equal(manifest.dependencies?.['@test/restore-check'], '^3.0.0');
    } finally { cleanup(pkgDir, appDir); }
  });

  test('remove deletes dep entirely when it was not pre-existing', () => {
    const { pkgDir } = makeSrc('@test/new-dep', 'npm');
    const appDir = makeApp({ pm: 'npm' });
    try {
      add({ libPath: pkgDir, appPath: appDir }, silent);
      remove({ packageNameOrPath: '@test/new-dep', appPath: appDir }, silent);
      const pkg = readJson(path.join(appDir, 'package.json'));
      assert.ok(!pkg.dependencies?.['@test/new-dep'], 'Dep should be fully removed');
      assert.ok(!pkg.devDependencies?.['@test/new-dep']);
    } finally { cleanup(pkgDir, appDir); }
  });
});

// ---------------------------------------------------------------------------
describe('error handling', () => {
  test('add throws when source has no package.json', () => {
    const dir = makeTmp();
    const appDir = makeApp({ pm: 'npm' });
    try {
      assert.throws(() => add({ libPath: dir, appPath: appDir }, silent), /No package\.json/);
    } finally { cleanup(dir, appDir); }
  });

  test('add throws when dest has no package.json', () => {
    const { pkgDir } = makeSrc('@test/err-dest', 'npm');
    const dir = makeTmp();
    try {
      assert.throws(() => add({ libPath: pkgDir, appPath: dir }, silent), /No package\.json/);
    } finally { cleanup(pkgDir, dir); }
  });
});
