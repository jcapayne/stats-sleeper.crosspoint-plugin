import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../stats-sleeper.crosspoint-plugin/core.js';

const input = { server: 'https://example.org/sync/', username: 'reader', auth_key: 'A'.repeat(32), mode: 'overlay', width: 480, height: 800, timezone: 'America/New_York', placement: 'bottom', metrics: 'books,goal,current,streak' };

test('configuration keeps prefix paths and authentication out of URLs', () => {
  const config = core.buildConfig(input);
  assert.equal(new URL(config.image_url).pathname, '/sync/api/v1/stats/sleep-image');
  assert.equal(config.auth_key, 'a'.repeat(32));
  assert.equal(config.dest, '/sleep-overlay.png');
  assert.ok(!config.image_url.includes(config.auth_key));
  assert.equal(core.buildConfig({ ...input, mode: 'custom' }).dest, '/sleep.bmp');
  assert.ok(new TextEncoder().encode(JSON.stringify(config)).length < 2048);
  for (const change of [{ server: 'file:///tmp/key' }, { server: 'https://key@host/' }, { server: 'https://host/?key=secret' }, { width: 1 }, { width: 1600, height: 1600 }, { auth_key: 'password' }, { timezone: 'bad/zone' }, { metrics: '' }]) {
    assert.throws(() => core.buildConfig({ ...input, ...change }));
  }
});

test('device handler requests an authenticated image using the native sleep event', () => {
  const device = core.deviceDefinition();
  assert.equal(device.config.file, 'config.json');
  const download = device.events['sleep.enter'].download;
  assert.equal(download.url, '{cfg.image_url}');
  assert.equal(download.dest, '{cfg.dest}');
  assert.equal(download.headers['x-auth-key'], '{cfg.auth_key}');
  assert.equal(download.headers['X-Sleep-Percent'], '{event.percent}');
});

function fixture({ existing = [], status = 200, version = 1, downloadFail = false, failDeviceWrite = false } = {}) {
  const files = new Map(existing.map(name => ['/' + name, 'original']));
  const writes = [];
  const api = {
    name: 'stats-sleeper', dir: '/.crosspoint/plugins/stats-sleeper', pluginFile: name => '/plugin?file=' + name,
    relay: async (_method, url, headers) => {
      assert.equal(headers['x-auth-key'], 'a'.repeat(32));
      assert.equal(new URL(url).pathname, '/sync/api/v1/stats/sleep-image/status');
      return { status, headers: [], body: JSON.stringify({ version, background: false }) };
    },
    writeFile: async (path, b64) => {
      if (failDeviceWrite && path.endsWith('/device.json')) { failDeviceWrite = false; throw new Error('device write failed'); }
      const value = Buffer.from(b64, 'base64').toString('utf8'); files.set(path, value); writes.push(path); return { ok: true, bytes: value.length };
    },
    fetchToSd: async (url, dest, headers) => {
      assert.equal(headers['x-auth-user'], 'reader');
      assert.equal(new URL(url).pathname, '/sync/api/v1/stats/sleep-image');
      if (downloadFail) throw new Error('network failed');
      files.set(dest, 'new image'); return { status: 200, bytes: 500, complete: true };
    },
  };
  const fetcher = async (url, options = {}) => {
    if (url.startsWith('/plugin?')) {
      const path = api.dir + '/' + new URL(url, 'http://reader').searchParams.get('file');
      return files.has(path) ? new Response(files.get(path), { headers: { 'Content-Type': 'application/json' } }) : new Response(null, { status: 404 });
    }
    if (url === '/api/files?path=%2F') return Response.json([...files.keys()].filter(p => p.lastIndexOf('/') === 0).map(p => ({ name: p.slice(1), isDirectory: false })));
    if (url === '/rename') {
      const data = new URLSearchParams(options.body), path = data.get('path'), dest = '/' + data.get('name');
      assert.ok(files.has(path)); assert.ok(!files.has(dest));
      files.set(dest, files.get(path)); files.delete(path); return new Response('Renamed successfully');
    }
    if (url === '/delete') {
      const path = new URLSearchParams(options.body).get('path');
      assert.ok(files.has(path)); files.delete(path); return new Response('Deleted successfully');
    }
    throw new Error('unexpected request ' + url);
  };
  return { controller: core.createController(api, fetcher), files, writes };
}

test('requires explicit replacement and backs up both overlay priority files', async () => {
  const f = fixture({ existing: ['sleep-overlay.bmp', 'sleep-overlay.png'] });
  await assert.rejects(f.controller.save(input, false), /replace|existing/i);
  assert.equal(f.writes.length, 0);
  const result = await f.controller.save(input, true);
  assert.equal(f.files.get('/sleep-overlay.png'), 'new image');
  assert.ok(!f.files.has('/sleep-overlay.bmp'));
  const backups = JSON.parse(result.backup_paths);
  assert.equal(backups.length, 2);
  for (const path of backups) assert.equal(f.files.get(path), 'original');
  const config = JSON.parse(f.files.get('/.crosspoint/plugins/stats-sleeper/config.json'));
  assert.equal(config.image_url, core.buildConfig(input).image_url);
  assert.ok(f.writes.indexOf('/.crosspoint/plugins/stats-sleeper/config.json') < f.writes.indexOf('/.crosspoint/plugins/stats-sleeper/device.json'));
});

test('failed downloads restore original artwork and never enable events', async () => {
  const f = fixture({ existing: ['sleep.bmp'], downloadFail: true });
  await assert.rejects(f.controller.save({ ...input, mode: 'custom' }, true), /network failed/);
  assert.equal(f.files.get('/sleep.bmp'), 'original');
  assert.equal(f.writes.length, 0);
});

test('a config activation failure restores original artwork and disables the handler', async () => {
  const f = fixture({ existing: ['sleep-overlay.bmp', 'sleep-overlay.png'], failDeviceWrite: true });
  await assert.rejects(f.controller.save(input, true), /device write failed/);
  assert.equal(f.files.get('/sleep-overlay.bmp'), 'original');
  assert.equal(f.files.get('/sleep-overlay.png'), 'original');
  const device = JSON.parse(f.files.get('/.crosspoint/plugins/stats-sleeper/device.json'));
  assert.equal(device.events, undefined);
});

test('reapplying a saved configuration preserves original backups and cleans temporary images', async () => {
  const f = fixture({ existing: ['sleep-overlay.png'] });
  const first = await f.controller.save(input, true);
  const second = await f.controller.save(input, false);
  assert.equal(second.backup_paths, first.backup_paths);
  assert.equal(f.files.get('/sleep-overlay.png'), 'new image');
  assert.equal([...f.files.keys()].filter(p => p.startsWith('/stats-sleeper-original-')).length, 1);
  assert.equal([...f.files.keys()].filter(p => p.startsWith('/stats-sleeper-pending-')).length, 0);
});

test('unsupported servers and rejected auth cannot overwrite configuration', async () => {
  for (const opts of [{ status: 404 }, { status: 401 }, { version: 9 }]) {
    const f = fixture(opts);
    await assert.rejects(f.controller.save(input, true), /server|credential|version/i);
    assert.equal(f.writes.length, 0);
    assert.equal(f.files.size, 0);
  }
});

test('UTF-8 config encoding round-trips and size limits include backup paths', () => {
  assert.equal(Buffer.from(core.encodeJson({ title: '読書 café' }), 'base64').toString('utf8'), '{"title":"読書 café"}');
  assert.throws(() => core.encodeConfig({ ...core.buildConfig(input), backup_paths: 'x'.repeat(2100) }), /2048|2 KB/i);
});
