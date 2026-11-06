import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import core from '../stats-sleeper.crosspoint-plugin/core.js';

const worktree = process.env.STATS_SLEEPER_SYNC_WORKTREE;
test('plugin setup and native sleep handler work against the real migrated sync service', { skip: !worktree }, async () => {
  const root = resolve(worktree);
  const { createApp } = await import(pathToFileURL(join(root, 'dist/app.js')));
  const { openDatabase, migrate } = await import(pathToFileURL(join(root, 'dist/db/db.js')));
  const db = openDatabase(':memory:');
  try {
    migrate(db, join(root, 'migrations'));
    const app = createApp(db, { basePath: '/prefix', registrationDisabled: false, authRateLimitPerMinute: 0, trustProxy: false, corsOrigins: '*', kindleServerRegistration: false });
    const username = 'sleep-integration', key = 'a'.repeat(32);
    const registered = await app.request('/prefix/users/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: key }) });
    assert.equal(registered.status, 201);
    const userId = Number(db.prepare('SELECT id FROM users WHERE username=?').get(username).id);
    db.prepare('INSERT INTO reading_goals (user_id,year,target) VALUES (?,?,1)').run(userId, new Date().getUTCFullYear());
    const request = (url, options) => { const u = new URL(url); return app.request(u.pathname + u.search, options); };
    const files = new Map();
    const dir = '/plugins/stats-sleeper';
    const firmwareFetch = async (url, options = {}) => {
      if (url.startsWith('https://sync.test/')) return request(url, options);
      if (url.startsWith('/plugin?')) {
        const name = new URL(url, 'http://reader').searchParams.get('file');
        return files.has(dir + '/' + name) ? Response.json(JSON.parse(files.get(dir + '/' + name))) : new Response(null, { status: 404 });
      }
      if (url.startsWith('/api/files?')) return Response.json([...files.keys()].filter(p => p.lastIndexOf('/') === 0).map(p => ({ name: p.slice(1), isDirectory: false })));
      const form = new URLSearchParams(options.body);
      if (url === '/rename') {
        const path = form.get('path'), dest = '/' + form.get('name');
        assert.ok(files.has(path)); assert.ok(!files.has(dest));
        files.set(dest, files.get(path)); files.delete(path); return new Response('Renamed successfully');
      }
      if (url === '/delete') { files.delete(form.get('path')); return new Response('Deleted successfully'); }
      throw new Error('Unexpected firmware endpoint ' + url);
    };
    const api = {
      name: 'stats-sleeper', dir, pluginFile: file => '/plugin?file=' + file,
      relay: async (method, url, headers) => { const r = await request(url, { method, headers }); return { status: r.status, headers: [...r.headers], body: await r.text() }; },
      writeFile: async (path, b64) => { const bytes = Buffer.from(b64, 'base64'); files.set(path, bytes.toString()); return { ok: true, bytes: bytes.length }; },
      fetchToSd: async (url, dest, headers) => {
        const r = await request(url, { headers });
        const bytes = Buffer.from(await r.arrayBuffer());
        if (r.ok) files.set(dest, bytes);
        return { status: r.status, complete: r.ok, bytes: bytes.length };
      },
    };
    const controller = core.createController(api, firmwareFetch);
    const input = { server: 'https://sync.test/prefix', username, auth_key: key, width: 480, height: 800, timezone: 'UTC', mode: 'overlay', placement: 'bottom', metrics: 'books,goal,current,streak' };
    assert.equal((await controller.connection(input)).version, 1);
    const preview = await controller.preview(input);
    assert.equal(preview.type, 'image/png');
    await controller.save(input, false);
    assert.equal(files.get('/sleep-overlay.png').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const cfg = await controller.load();
    const device = JSON.parse(files.get(dir + '/device.json'));
    const handler = device.events['sleep.enter'].download;
    const substitute = value => value.replace(/\{cfg\.([^}]+)\}/g, (_, key) => cfg[key]).replace('{event.percent}', '68');
    const response = await request(substitute(handler.url), { headers: Object.fromEntries(Object.entries(handler.headers).map(([key, value]) => [key, substitute(value)])) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), files.get('/sleep-overlay.png'));
    const before = db.prepare('SELECT COUNT(*) AS n FROM progress_log').get().n;
    const custom = await controller.save({ ...input, mode: 'custom' }, false);
    assert.equal(custom.dest, '/sleep.bmp');
    assert.equal(files.get('/sleep.bmp').subarray(0, 2).toString(), 'BM');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM progress_log').get().n, before);
    const preflight = await app.request('/prefix/api/v1/stats/sleep-image', { method: 'OPTIONS', headers: { Origin: 'http://reader.local', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-auth-user,x-auth-key,x-sleep-percent' } });
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.match(preflight.headers.get('access-control-allow-headers'), /X-Sleep-Percent/i);
  } finally { db.close(); }
});
