import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const script = new URL('../tools/validate-plugin.mjs', import.meta.url).pathname;

test('validator accepts a safe payload and rejects traversal or missing runtime files', () => {
  const root = mkdtempSync(join(tmpdir(), 'sleep-plugin-'));
  try {
    const payload = join(root, 'stats-sleeper.crosspoint-plugin'); mkdirSync(payload);
    writeFileSync(join(payload, 'plugin.js'), 'CrossPoint.registerPlugin(() => {});');
    const manifest = { name: 'stats-sleeper', version: '0.1.0', files: ['manifest.json', 'plugin.js'] };
    const run = files => {
      writeFileSync(join(payload, 'manifest.json'), JSON.stringify({ ...manifest, files }));
      return spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
    };
    assert.equal(run(manifest.files).status, 0);
    for (const file of ['../secret', '/secret', 'a\\secret', 'missing.js']) assert.notEqual(run([...manifest.files, file]).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
