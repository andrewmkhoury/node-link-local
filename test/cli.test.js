import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'node-link-local.js');

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

describe('CLI validation', () => {
  test('no args → prints usage and exits 1', () => {
    const r = runCli([]);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('add'));
    assert.ok(r.stderr.includes('remove'));
  });

  test('add without path → exits 1 with path-to-lib hint', () => {
    const r = runCli(['add']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('path-to-lib'));
  });

  test('unknown command → exits 1 with usage', () => {
    const r = runCli(['bad']);
    assert.equal(r.status, 1);
    assert.ok(r.stderr.includes('add'));
    assert.ok(r.stderr.includes('remove'));
  });
});
