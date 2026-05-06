import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectPackageManager, findWorkspaceRoot } from '../lib/detect-pm.js';
import { makeTmp, write, mkdir, makeStandalonePackage, makeWorkspacePackage, cleanup } from './fixtures.js';

describe('detectPackageManager', () => {
  test('detects npm from package-lock.json in same dir', () => {
    const dir = makeTmp();
    try {
      write(dir, 'package-lock.json', '{}');
      assert.equal(detectPackageManager(dir), 'npm');
    } finally { cleanup(dir); }
  });

  test('detects yarn from yarn.lock in same dir', () => {
    const dir = makeTmp();
    try {
      write(dir, 'yarn.lock', '# yarn lockfile v1\n');
      assert.equal(detectPackageManager(dir), 'yarn');
    } finally { cleanup(dir); }
  });

  test('detects pnpm from pnpm-lock.yaml in same dir', () => {
    const dir = makeTmp();
    try {
      write(dir, 'pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
      assert.equal(detectPackageManager(dir), 'pnpm');
    } finally { cleanup(dir); }
  });

  test('detects bun from bun.lockb in same dir', () => {
    const dir = makeTmp();
    try {
      write(dir, 'bun.lockb', 'binary');
      assert.equal(detectPackageManager(dir), 'bun');
    } finally { cleanup(dir); }
  });

  test('detects bun from bun.lock (text format) in same dir', () => {
    const dir = makeTmp();
    try {
      write(dir, 'bun.lock', '');
      assert.equal(detectPackageManager(dir), 'bun');
    } finally { cleanup(dir); }
  });

  test('walks up to find yarn.lock in parent (workspace package scenario)', () => {
    const root = makeTmp();
    try {
      write(root, 'yarn.lock', '# yarn lockfile v1\n');
      const pkg = mkdir(root, 'packages/my-pkg');
      write(pkg, 'package.json', JSON.stringify({ name: '@test/my-pkg' }));
      assert.equal(detectPackageManager(pkg), 'yarn');
    } finally { cleanup(root); }
  });

  test('walks up to find pnpm-lock.yaml two levels up', () => {
    const root = makeTmp();
    try {
      write(root, 'pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
      const pkg = mkdir(root, 'a/b/c');
      assert.equal(detectPackageManager(pkg), 'pnpm');
    } finally { cleanup(root); }
  });

  test('falls back to npm when no lockfile found anywhere', () => {
    const root = makeTmp();
    try {
      const pkg = mkdir(root, 'orphan');
      const result = detectPackageManager(pkg);
      assert.ok(typeof result === 'string' && result.length > 0, 'should return a non-empty string');
    } finally { cleanup(root); }
  });
});

describe('findWorkspaceRoot', () => {
  test('returns null for a standalone package (no workspaces field)', () => {
    const pkg = makeStandalonePackage({ pm: 'npm' });
    try {
      assert.equal(findWorkspaceRoot(pkg), null);
    } finally { cleanup(pkg); }
  });

  test('detects yarn workspace root', () => {
    const { rootDir, pkgDir } = makeWorkspacePackage({ pm: 'yarn' });
    try {
      const result = findWorkspaceRoot(pkgDir);
      assert.ok(result !== null, 'Expected workspace root to be found');
      assert.equal(result.rootDir, rootDir);
      assert.equal(result.pm, 'yarn');
    } finally { cleanup(rootDir); }
  });

  test('detects npm workspace root (package-lock.json + workspaces)', () => {
    const { rootDir, pkgDir } = makeWorkspacePackage({ pm: 'npm' });
    try {
      const result = findWorkspaceRoot(pkgDir);
      assert.ok(result !== null, 'Expected workspace root to be found');
      assert.equal(result.rootDir, rootDir);
      assert.equal(result.pm, 'npm');
    } finally { cleanup(rootDir); }
  });

  test('detects pnpm workspace root via pnpm-workspace.yaml', () => {
    const { rootDir, pkgDir } = makeWorkspacePackage({ pm: 'pnpm' });
    try {
      const result = findWorkspaceRoot(pkgDir);
      assert.ok(result !== null, 'Expected workspace root to be found');
      assert.equal(result.rootDir, rootDir);
      assert.equal(result.pm, 'pnpm');
    } finally { cleanup(rootDir); }
  });

  test('detects workspace root two levels up', () => {
    const root = makeTmp();
    try {
      write(root, 'yarn.lock', '# yarn lockfile v1\n');
      write(root, 'package.json', { name: 'root', workspaces: ['packages/**'] });
      const pkg = mkdir(root, 'packages/scope/deep-pkg');
      write(pkg, 'package.json', { name: '@scope/deep-pkg' });
      const result = findWorkspaceRoot(pkg);
      assert.ok(result !== null, 'Expected workspace root found two levels up');
      assert.equal(result.rootDir, root);
      assert.equal(result.pm, 'yarn');
    } finally { cleanup(root); }
  });

  test('prefers nearest workspace root when nested workspaces exist', () => {
    const outerRoot = makeTmp();
    try {
      write(outerRoot, 'yarn.lock', '# yarn lockfile v1\n');
      write(outerRoot, 'package.json', { name: 'outer', workspaces: ['inner'] });

      const innerRoot = mkdir(outerRoot, 'inner');
      write(innerRoot, 'yarn.lock', '# yarn lockfile v1\n');
      write(innerRoot, 'package.json', { name: 'inner-root', workspaces: ['packages/*'] });

      const pkg = mkdir(innerRoot, 'packages/my-pkg');
      write(pkg, 'package.json', { name: '@test/my-pkg' });

      const result = findWorkspaceRoot(pkg);
      assert.ok(result !== null, 'Expected workspace root found');
      assert.equal(result.rootDir, innerRoot);
    } finally { cleanup(outerRoot); }
  });
});
