import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { add } from '../lib/sync.js';
import { makeStandalonePackage, makeWorkspacePackage, makeApp, cleanup } from './fixtures.js';

describe('buildPackage routing', () => {
  describe('standalone packages', () => {
    test('npm standalone: does not use workspace route', async () => {
      const srcDir = makeStandalonePackage({
        name: '@test/standalone-npm',
        pm: 'npm',
        buildScript: 'mkdir -p dist && echo "module.exports={}" > dist/index.js',
      });
      const appDir = makeApp({ pm: 'npm' });
      const logs = [];
      try {
        add({ libPath: srcDir, appPath: appDir }, (m) => logs.push(m));
        assert.ok(!logs.some(l => l.includes('workspace root')), 'Should not use workspace route for standalone');
        assert.ok(logs.some(l => l.includes('Building')), 'Should log building');
        assert.ok(logs.some(l => l.includes('Installed')), 'Should complete install');
      } finally {
        cleanup(srcDir, appDir);
      }
    });
  });

  describe('workspace packages', () => {
    test('yarn workspace: log mentions "yarn workspace filter"', async () => {
      const { rootDir, pkgDir } = makeWorkspacePackage({
        name: '@test/ws-yarn',
        pm: 'yarn',
        buildScript: 'mkdir -p dist && echo "module.exports={}" > dist/index.js',
      });
      const appDir = makeApp({ pm: 'npm' });
      const logs = [];
      try {
        add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
        assert.ok(
          logs.some(l => l.includes('yarn') && l.includes('workspace')),
          `Expected yarn workspace log, got:\n${logs.join('\n')}`
        );
        assert.ok(logs.some(l => l.includes('Installed')));
      } finally {
        cleanup(rootDir, appDir);
      }
    });

    test('pnpm workspace: log mentions "pnpm workspace filter"', async () => {
      const { rootDir, pkgDir } = makeWorkspacePackage({
        name: '@test/ws-pnpm',
        pm: 'pnpm',
        buildScript: 'mkdir -p dist && echo "module.exports={}" > dist/index.js',
      });
      const appDir = makeApp({ pm: 'npm' });
      const logs = [];
      try {
        add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
        assert.ok(
          logs.some(l => l.includes('pnpm') && l.includes('workspace')),
          `Expected pnpm workspace log, got:\n${logs.join('\n')}`
        );
        assert.ok(logs.some(l => l.includes('Installed')));
      } finally {
        cleanup(rootDir, appDir);
      }
    });

    test('npm workspace: log mentions "npm workspace filter"', async () => {
      const { rootDir, pkgDir } = makeWorkspacePackage({
        name: '@test/ws-npm',
        pm: 'npm',
        buildScript: 'mkdir -p dist && echo "module.exports={}" > dist/index.js',
      });
      const appDir = makeApp({ pm: 'npm' });
      const logs = [];
      try {
        add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
        assert.ok(
          logs.some(l => l.includes('npm') && l.includes('workspace')),
          `Expected npm workspace log, got:\n${logs.join('\n')}`
        );
        assert.ok(logs.some(l => l.includes('Installed')));
      } finally {
        cleanup(rootDir, appDir);
      }
    });

    test('skips build when dist/ already present', async () => {
      const { rootDir, pkgDir } = makeWorkspacePackage({
        name: '@test/ws-hasdist',
        pm: 'yarn',
        hasDist: true,
      });
      const appDir = makeApp({ pm: 'npm' });
      const logs = [];
      try {
        add({ libPath: pkgDir, appPath: appDir }, (m) => logs.push(m));
        assert.ok(logs.some(l => l.includes('dist/')), 'Should note dist/ is present');
        assert.ok(!logs.some(l => l.includes('Building')), 'Should not build when dist/ exists');
        assert.ok(logs.some(l => l.includes('Installed')));
      } finally {
        cleanup(rootDir, appDir);
      }
    });
  });
});
