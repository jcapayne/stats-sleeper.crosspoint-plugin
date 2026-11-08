import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';

test('the real setup form loads configuration, checks credentials, and reports unsupported servers', async () => {
  const dom = new JSDOM('<main id="plugin"></main>', { url: 'http://reader.local/plugins', runScripts: 'outside-only' });
  const window = dom.window;
  try {
    window.TextEncoder = TextEncoder;
    window.Response = Response;
    const stored = { server: 'https://example.org/sync', username: 'reader', auth_key: 'a'.repeat(32), width: 480, height: 800, mode: 'custom', timezone: 'UTC', metrics: 'books,streak', placement: 'top' };
    let remoteStatus = 200;
    let expectedKey = stored.auth_key;
    window.fetch = async url => {
      assert.equal(url, '/plugin?file=config.json');
      return Response.json(stored);
    };
    let initialize;
    window.CrossPoint = { registerPlugin(fn) { initialize = fn; } };
    window.eval(readFileSync(new URL('../stats-sleeper.crosspoint-plugin/core.js', import.meta.url), 'utf8'));
    window.eval(readFileSync(new URL('../stats-sleeper.crosspoint-plugin/plugin.js', import.meta.url), 'utf8'));
    assert.equal(typeof initialize, 'function');
    const container = window.document.getElementById('plugin');
    await initialize(container, {
      dir: '/plugins/stats-sleeper', name: 'stats-sleeper', pluginFile: file => '/plugin?file=' + file,
      relay: async (method, url, headers) => {
        assert.equal(method, 'GET');
        assert.equal(url, 'https://example.org/sync/api/v1/stats/sleep-image/status');
        assert.equal(headers['x-auth-key'], expectedKey);
        return { status: remoteStatus, headers: [], body: '{"version":1,"background":false}' };
      },
    });
    const form = container.querySelector('form');
    assert.equal(form.elements.namedItem('username').value, 'reader');
    assert.equal(form.elements.namedItem('mode').value, 'custom');
    assert.match(container.querySelector('.ss-instructions').textContent, /custom branch/);
    assert.equal(form.querySelector('[value=goal]').checked, false);
    const status = container.querySelector('[role=status]');
    const clickAndWait = async pattern => {
      container.querySelector('[data-action=test]').click();
      for (let i = 0; i < 40 && !pattern.test(status.textContent); i++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.match(status.textContent, pattern);
      assert.equal(container.querySelector('[data-action=test]').disabled, false);
    };
    await clickAndWait(/Connected/);
    assert.equal(form.elements.namedItem('auth_key'), null, 'credentials form exposes only username and password');
    assert.equal(form.elements.namedItem('password').value, '');
    form.elements.namedItem('password').value = '読書 password ';
    expectedKey = createHash('md5').update('読書 password ').digest('hex');
    await clickAndWait(/Connected/);
    remoteStatus = 404;
    await clickAndWait(/needs the Stats Sleeper image endpoint/);
    form.elements.namedItem('server').value = 'http://example.org/sync';
    await clickAndWait(/Confirm the HTTP warning/);
  } finally { window.close(); }
});

test('new setup inherits the reader sync URL and tolerates unavailable settings', async () => {
  for (const [settings, expected] of [
    [[{ key: 'koServerUrl', type: 'string', value: 'http://poohmba.local:8081/prefix/' }], 'http://poohmba.local:8081/prefix/'],
    [[{ key: 'koServerUrl', type: 'string', value: '' }], 'https://sync.crosspointreader.com'],
    [null, 'https://sync.crosspointreader.com'],
  ]) {
    const dom = new JSDOM('<main></main>', { url: 'http://reader.local/plugins', runScripts: 'outside-only' });
    const { window } = dom;
    try {
      window.TextEncoder = TextEncoder;
      window.fetch = async url => {
        if (url === '/plugin?file=config.json') return new Response(null, { status: 404 });
        assert.equal(url, '/api/settings?keys=koServerUrl');
        if (settings === null) throw new Error('settings unavailable');
        return Response.json(settings);
      };
      let initialize;
      window.CrossPoint = { registerPlugin(fn) { initialize = fn; } };
      window.eval(readFileSync(new URL('../stats-sleeper.crosspoint-plugin/core.js', import.meta.url), 'utf8'));
      window.eval(readFileSync(new URL('../stats-sleeper.crosspoint-plugin/plugin.js', import.meta.url), 'utf8'));
      const container = window.document.querySelector('main');
      await initialize(container, { dir: '/.crosspoint/plugins/stats-sleeper', pluginFile: file => '/plugin?file=' + file });
      assert.equal(container.querySelector('[name=server]').value, expected);
      assert.match(container.textContent, /existing username and password are protected, so we need to ask for them here/i);
      assert.equal(container.querySelector('[name=allow_http]').checked, false);
    } finally { window.close(); }
  }
});
