(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.StatsSleeper = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const METRICS = ['books', 'goal', 'current', 'streak'];
  const INERT = { title: 'Stats Sleeper', config: { file: 'config.json' } };
  // KOSync requires MD5 of the exact UTF-8 password. Runs locally, including
  // on HTTP reader WebUIs where browser crypto.subtle is unavailable.
  function passwordKey(password) {
    const bytes = new TextEncoder().encode(password);
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes); padded[bytes.length] = 128;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, bytes.length * 8, true);
    view.setUint32(padded.length - 4, Math.floor(bytes.length / 0x20000000), true);
    const shifts = [[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
    const state = [0x67452301,0xefcdab89,0x98badcfe,0x10325476];
    for (let offset = 0; offset < padded.length; offset += 64) {
      let [a,b,c,d] = state;
      for (let i = 0; i < 64; i++) {
        const round = i >>> 4;
        const f = round === 0 ? (b & c) | (~b & d) : round === 1 ? (d & b) | (~d & c) : round === 2 ? b ^ c ^ d : c ^ (b | ~d);
        const word = round === 0 ? i : round === 1 ? (5*i+1)%16 : round === 2 ? (3*i+5)%16 : (7*i)%16;
        const sum = (a + f + Math.floor(Math.abs(Math.sin(i+1))*0x100000000) + view.getUint32(offset+word*4,true)) | 0;
        const shift = shifts[round][i%4];
        [a,b,c,d] = [d,(b+((sum<<shift)|(sum>>>(32-shift))))|0,b,c];
      }
      for (const [i,value] of [a,b,c,d].entries()) state[i] = (state[i]+value)|0;
    }
    return state.map(word => Array.from({length:4},(_,i) => ((word>>>(8*i))&255).toString(16).padStart(2,'0')).join('')).join('');
  }
  function buildConfig(input) {
    let server;
    try { server = new URL(String(input.server).trim()); } catch { throw new Error('Enter a valid sync server URL.'); }
    if (!['https:', 'http:'].includes(server.protocol) || server.username || server.password || server.search || server.hash) throw new Error('Use an HTTP(S) server URL without credentials, query, or fragment.');
    const base = server.href.replace(/\/+$/, '');
    const username = String(input.username || '').trim(), auth_key = input.password ? passwordKey(String(input.password)) : String(input.auth_key || '').trim().toLowerCase();
    if (!/^[A-Za-z0-9._@+\-]{1,64}$/.test(username)) throw new Error('Enter your sync username.');
    if (!/^[a-f0-9]{32}$/.test(auth_key)) throw new Error('Enter your sync password.');
    const width = Number(input.width), height = Number(input.height);
    if (![width, height].every(n => Number.isInteger(n) && n >= 240 && n <= 1600) || width * height > 2000000) throw new Error('Use dimensions 240–1600 with at most 2,000,000 pixels.');
    if (!['overlay', 'custom'].includes(input.mode) || !['top', 'bottom'].includes(input.placement)) throw new Error('Choose an image mode and panel placement.');
    const timezone = String(input.timezone || 'UTC');
    if (timezone.length > 100) throw new Error('Choose a valid timezone.');
    try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw new Error('Choose a valid timezone.'); }
    const metrics = [...new Set(String(input.metrics || '').split(','))];
    if (!metrics.length || metrics.some(m => !METRICS.includes(m))) throw new Error('Choose at least one supported metric.');
    const query = new URLSearchParams({ width: String(width), height: String(height), mode: input.mode, placement: input.placement, timezone, metrics: metrics.join(',') });
    const dest = input.mode === 'overlay' ? '/sleep-overlay.png' : '/sleep.bmp';
    return { server: base, username, auth_key, width, height, mode: input.mode, placement: input.placement, timezone, metrics: metrics.join(','), image_url: base + '/api/v1/stats/sleep-image?' + query, dest, managed_dest: dest, backup_paths: '[]' };
  }
  function encodeJson(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function encodeConfig(value) {
    if (new TextEncoder().encode(JSON.stringify(value)).length >= 2048) throw new Error('Configuration must be below 2048 bytes (2 KB). Shorten the server URL or move old backup records out of configuration.');
    return encodeJson(value);
  }
  function deviceDefinition() {
    return { ...INERT, events: { 'sleep.enter': { download: { method: 'GET', url: '{cfg.image_url}', dest: '{cfg.dest}', headers: { 'x-auth-user': '{cfg.username}', 'x-auth-key': '{cfg.auth_key}', 'X-Sleep-Percent': '{event.percent}' } } } } };
  }
  function createController(api, fetcher = fetch) {
    const headers = cfg => ({ 'x-auth-user': cfg.username, 'x-auth-key': cfg.auth_key });
    const installed = api.dir;
    if (typeof installed !== 'string' || !installed.startsWith('/') || installed.includes('..') || installed.includes('\\')) throw new Error('Firmware did not provide a safe plugin directory.');
    async function readJson(file) {
      const r = await fetcher(api.pluginFile(file), { cache: 'no-store' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Could not read plugin configuration.');
      return r.json();
    }
    async function writeJson(file, value) {
      const r = await api.writeFile(installed + '/' + file, file === 'config.json' ? encodeConfig(value) : encodeJson(value));
      if (!r || !r.ok) throw new Error('Could not save ' + file + '.');
    }
    async function form(path, values) {
      const r = await fetcher(path, { method: 'POST', body: new URLSearchParams(values) });
      if (!r.ok) throw new Error('Reader file operation failed: ' + path);
      // Firmware file operations acknowledge success with text/plain.
      return r.text();
    }
    async function connection(cfg) {
      let r;
      try { r = await api.relay('GET', cfg.server + '/api/v1/stats/sleep-image/status', headers(cfg)); }
      catch (error) {
        if (error.status === 502 || /relay failed/.test(error.message || '')) {
          throw new Error('The reader could not reach ' + cfg.server + '/api/v1/stats/sleep-image/status. Check the reader network, DNS, server port and TLS certificate. Use a LAN address reachable from the reader, not localhost. The firmware reports this as a relay error; this status check does not download an image.');
        }
        throw error;
      }
      if (r.status === 401 || r.status === 403) throw new Error('Sync credentials were rejected. Check the username and authentication key.');
      if (r.status !== 200) throw new Error('This sync server needs the Stats Sleeper image endpoint. Update the server and check its URL prefix.');
      let status;
      try { status = JSON.parse(r.body); } catch { throw new Error('The server returned an invalid status response.'); }
      if (status.version !== 1) throw new Error('Unsupported sleep-image server version.');
      return status;
    }
    async function binary(cfg, suffix, options = {}) {
      let r;
      try { r = await fetcher(cfg.server + '/api/v1/stats/sleep-image' + suffix, { ...options, headers: { ...headers(cfg), ...options.headers }, credentials: 'omit', redirect: 'error' }); }
      catch { throw new Error('Browser could not reach the sync server. Check CORS, HTTPS/mixed-content restrictions, and your network. Sleep downloads use the reader connection.'); }
      if (!r.ok) throw new Error('Sync server request failed (HTTP ' + r.status + ').');
      return r;
    }
    async function save(input, replace) {
      const cfg = buildConfig(input);
      await connection(cfg);
      const prior = await readJson('config.json');
      const priorDevice = await readJson('device.json');
      const listing = await fetcher('/api/files?path=%2F', { cache: 'no-store' });
      if (!listing.ok) throw new Error('Could not check existing sleep images.');
      const files = await listing.json();
      if (!Array.isArray(files)) throw new Error('Invalid reader directory listing.');
      const names = new Set(files.filter(f => !f.isDirectory).map(f => '/' + f.name));
      const candidates = cfg.mode === 'overlay' ? ['/sleep-overlay.bmp', '/sleep-overlay.png'] : ['/sleep.bmp'];
      const existing = candidates.filter(p => names.has(p));
      if (existing.length && !replace) throw new Error('Existing sleep image found. Select the explicit replace option to preserve it as a backup and continue.');
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const pending = '/stats-sleeper-pending-' + id + (cfg.mode === 'overlay' ? '.png' : '.bmp');
      const moves = existing.map(path => ({ path, backup: '/stats-sleeper-original-' + id + '-' + path.slice(1) }));
      let oldBackups = [];
      try { oldBackups = JSON.parse(prior && prior.backup_paths || '[]'); } catch { /* recover with current backups */ }
      if (!Array.isArray(oldBackups) || oldBackups.some(p => typeof p !== 'string' || !/^\/stats-sleeper-original-[A-Za-z0-9.-]+$/.test(p))) throw new Error('Invalid backup records in configuration.');
      // Keep bounded records, but never delete older backup files from the card.
      cfg.backup_paths = JSON.stringify([...oldBackups, ...moves.map(m => m.backup)].slice(-6));
      encodeConfig(cfg);
      const moved = [];
      let imageInstalled = false, configAttempted = false;
      try {
        const result = await api.fetchToSd(cfg.image_url, pending, headers(cfg));
        if (!result || result.status !== 200 || result.complete !== true || !(result.bytes > 0 && result.bytes < 1048576)) throw new Error('Image download did not complete within the reader limit.');
        for (const move of moves) {
          await form('/rename', { path: move.path, name: move.backup.slice(1) }); moved.push(move);
        }
        await form('/rename', { path: pending, name: cfg.dest.slice(1) }); imageInstalled = true;
        configAttempted = true;
        await writeJson('config.json', cfg);
        await writeJson('device.json', deviceDefinition());
      } catch (error) {
        const recovery = [];
        if (imageInstalled) try { await form('/delete', { path: cfg.dest }); } catch { recovery.push(cfg.dest); }
        for (const move of [...moved].reverse()) try { await form('/rename', { path: move.backup, name: move.path.slice(1) }); } catch { recovery.push(move.backup); }
        if (configAttempted) {
          try { await writeJson('config.json', prior || {}); await writeJson('device.json', priorDevice || INERT); }
          catch { recovery.push('plugin configuration'); }
        }
        if (recovery.length) throw new Error('Setup failed; recovery needs attention: ' + recovery.join(', ') + '. Backups were retained.');
        throw error;
      }
      return cfg;
    }
    return {
      load: () => readJson('config.json'), connection: input => connection(buildConfig(input)), save,
      preview: async input => { const cfg = buildConfig(input); const query = new URL(cfg.image_url).searchParams; query.set('preview', '1'); return (await binary(cfg, '?' + query)).blob(); },
      upload: async (input, blob) => { const cfg = buildConfig(input); return (await binary(cfg, '/background', { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob })).json(); },
      removeBackground: async input => { const cfg = buildConfig(input); return (await binary(cfg, '/background', { method: 'DELETE' })).json(); },
    };
  }
  return { buildConfig, encodeJson, encodeConfig, deviceDefinition, createController, METRICS };
});
