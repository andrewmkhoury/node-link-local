import fs from 'node:fs';
import path from 'node:path';

/**
 * Detect package manager by walking up to find the nearest lockfile.
 * Workspace packages often have no lockfile of their own — the root has it.
 * Returns 'pnpm' | 'yarn' | 'bun' | 'npm'.
 */
export function detectPackageManager(dir) {
  let current = path.resolve(dir);
  while (true) {
    if (fs.existsSync(path.join(current, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(current, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(current, 'bun.lockb')) || fs.existsSync(path.join(current, 'bun.lock'))) return 'bun';
    if (fs.existsSync(path.join(current, 'package-lock.json'))) return 'npm';
    const parent = path.dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }
  return 'npm';
}

/**
 * Walk up from the package's parent directory looking for a workspace root.
 * Recognises pnpm-workspace.yaml (pnpm) and package.json#workspaces (yarn/bun/npm).
 * Returns { rootDir, pm } or null when the package is not inside a workspace.
 */
export function findWorkspaceRoot(packageDir) {
  let current = path.resolve(path.dirname(packageDir));
  while (true) {
    // pnpm uses a dedicated workspace manifest
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return { rootDir: current, pm: 'pnpm' };
    }

    // yarn / bun / npm declare workspaces inside package.json
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) {
          // Differentiate yarn / bun / npm by lockfile at this level
          let pm = 'npm';
          if (fs.existsSync(path.join(current, 'yarn.lock'))) pm = 'yarn';
          else if (
            fs.existsSync(path.join(current, 'bun.lockb')) ||
            fs.existsSync(path.join(current, 'bun.lock'))
          ) pm = 'bun';
          return { rootDir: current, pm };
        }
      } catch {
        // malformed package.json — keep walking
      }
    }

    const parent = path.dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }
  return null;
}
