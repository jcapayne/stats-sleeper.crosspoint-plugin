import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePlugin(root) {
  const directories = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && e.name.endsWith('.crosspoint-plugin'));
  if (directories.length !== 1) throw new Error('Expected exactly one direct-child .crosspoint-plugin payload.');
  const name = directories[0].name, payload = join(root, name);
  const manifest = JSON.parse(readFileSync(join(payload, 'manifest.json'), 'utf8'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name) || name !== manifest.name + '.crosspoint-plugin') throw new Error('Payload name must match a safe manifest ID.');
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Version must be MAJOR.MINOR.PATCH.');
  if (!Array.isArray(manifest.files) || !manifest.files.length || new Set(manifest.files).size !== manifest.files.length) throw new Error('Declare a nonempty, unique runtime file list.');
  if (!manifest.files.includes('manifest.json') || !manifest.files.some(f => f === 'plugin.js' || f === 'device.json')) throw new Error('Declare the manifest and at least one plugin entry point.');
  const safe = p => typeof p === 'string' && p.length && !p.startsWith('/') && !p.includes('\\') && p.split('/').every(c => c && c !== '.' && c !== '..');
  for (const file of manifest.files) {
    if (!safe(file)) throw new Error('Unsafe runtime path: ' + file);
    let path = payload;
    for (const component of file.split('/')) {
      path = join(path, component);
      if (lstatSync(path).isSymbolicLink()) throw new Error('Runtime symlinks are not supported: ' + file);
    }
    if (!lstatSync(path).isFile()) throw new Error('Runtime file missing: ' + file);
  }
  if (manifest.files.includes('device.json')) {
    const data = readFileSync(join(payload, 'device.json'));
    if (data.length >= 8192) throw new Error('device.json must be below 8 KB.');
    JSON.parse(data);
  }
  return `${manifest.name} ${manifest.version}: ${manifest.files.length} runtime files valid`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(validatePlugin(resolve(process.argv[2] || '.'))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
