/**
 * Helpers for building temp-dir fixture trees used across test files.
 * All fixtures are torn down automatically when the returned cleanup() is called.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function makeTmp(label = 'nll-test') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
}

export function write(dir, relPath, content) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return abs;
}

export function mkdir(dir, relPath) {
  const abs = path.join(dir, relPath);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

/**
 * Build a standalone package fixture (no workspace).
 *
 *   root/
 *     package.json
 *     <lockfile>          ← one of: package-lock.json | yarn.lock | pnpm-lock.yaml
 *     dist/index.js       ← optional, created when opts.hasDist = true
 */
export function makeStandalonePackage(opts = {}) {
  const {
    name = '@test/standalone',
    version = '1.0.0',
    pm = 'npm',       // 'npm' | 'yarn' | 'pnpm'
    hasDist = false,
    buildScript = 'echo built',
    extraDeps = {},
  } = opts;

  const root = makeTmp('pkg');
  write(root, 'package.json', {
    name,
    version,
    main: 'dist/index.js',
    files: ['dist'],
    scripts: { build: buildScript },
    dependencies: extraDeps,
  });

  if (pm === 'yarn')  write(root, 'yarn.lock', '# yarn lockfile v1\n');
  if (pm === 'pnpm')  write(root, 'pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
  if (pm === 'npm')   write(root, 'package-lock.json', JSON.stringify({ name, version, lockfileVersion: 3, packages: {} }, null, 2));

  if (hasDist) {
    write(root, 'dist/index.js', `module.exports = { name: '${name}' };\n`);
  }

  return root;
}

/**
 * Build a workspace fixture.
 *
 *   root/
 *     package.json             { workspaces: ['packages/*'] }
 *     <lockfile>
 *     packages/<pkgSlug>/
 *       package.json
 *       dist/index.js          ← optional
 *
 * Returns { rootDir, pkgDir, pkgName }.
 */
export function makeWorkspacePackage(opts = {}) {
  const {
    name = '@test/ws-pkg',
    version = '1.0.0',
    pm = 'npm',
    hasDist = false,
    buildScript = 'echo built',
    pnpmWorkspaceYaml = false,  // force pnpm-workspace.yaml even if pm != pnpm
  } = opts;

  const root = makeTmp('ws');
  const slug = name.replace(/^@/, '').replace('/', '-');
  const pkgDir = path.join(root, 'packages', slug);
  fs.mkdirSync(pkgDir, { recursive: true });

  write(root, 'package.json', {
    name: 'monorepo-root',
    version: '0.0.0',
    private: true,
    workspaces: ['packages/*'],
  });

  if (pm === 'yarn' || (!pnpmWorkspaceYaml && pm === 'yarn')) {
    write(root, 'yarn.lock', '# yarn lockfile v1\n');
  } else if (pm === 'pnpm' || pnpmWorkspaceYaml) {
    write(root, 'pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
    write(root, 'pnpm-workspace.yaml', 'packages:\n  - "packages/*"\n');
  } else {
    write(root, 'package-lock.json', JSON.stringify({ name: 'monorepo-root', lockfileVersion: 3, packages: {} }, null, 2));
  }

  write(pkgDir, 'package.json', {
    name,
    version,
    main: 'dist/index.js',
    files: ['dist'],
    scripts: { build: buildScript },
  });

  if (hasDist) {
    write(pkgDir, 'dist/index.js', `module.exports = { name: '${name}' };\n`);
  }

  return { rootDir: root, pkgDir, pkgName: name };
}

/**
 * Build a minimal app fixture that can receive a linked package.
 * No node_modules — just package.json + lockfile.
 */
export function makeApp(opts = {}) {
  const {
    pm = 'npm',
    existingDeps = {},
    existingDevDeps = {},
  } = opts;

  const root = makeTmp('app');
  write(root, 'package.json', {
    name: 'test-app',
    version: '0.0.0',
    private: true,
    dependencies: existingDeps,
    devDependencies: existingDevDeps,
  });

  if (pm === 'yarn') write(root, 'yarn.lock', '# yarn lockfile v1\n');
  if (pm === 'pnpm') write(root, 'pnpm-lock.yaml', 'lockfileVersion: "9.0"\n');
  if (pm === 'npm')  write(root, 'package-lock.json', JSON.stringify({ name: 'test-app', lockfileVersion: 3, packages: {} }, null, 2));

  return root;
}

export function cleanup(...dirs) {
  for (const dir of dirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
