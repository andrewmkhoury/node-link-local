import fs from 'node:fs';
import path from 'node:path';

/** Detect package manager from lockfile. Returns 'pnpm' | 'yarn' | 'npm'. */
export function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}
