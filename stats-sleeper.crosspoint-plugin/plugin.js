/* Stats Sleeper: browser setup for the native sleep-enter image download. */
CrossPoint.registerPlugin(async (container, api) => {
  'use strict';
  if (!globalThis.StatsSleeper) await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = api.pluginFile('core.js'); script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Stats Sleeper helpers.'));
    document.head.append(script);
  });
  const core = globalThis.StatsSleeper;
  const controller = core.createController(api);
  container.innerHTML = `
    <style>
      .stats-sleeper { max-width:720px;line-height:1.5;color:inherit }
      .stats-sleeper h2 { margin:0 0 4px }.stats-sleeper p { margin:8px 0 16px }
      .stats-sleeper .ss-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px }
      .stats-sleeper label { display:block;font-weight:600 }.stats-sleeper input:not([type=checkbox]),.stats-sleeper select { box-sizing:border-box;width:100%;padding:9px;border:1px solid #999;border-radius:5px;background:transparent;color:inherit;font:inherit }
      .stats-sleeper .ss-help { display:block;font-weight:400;font-size:.88em;opacity:.8;margin:4px 0 8px }
      .stats-sleeper fieldset { margin:18px 0;padding:12px;border:1px solid #aaa;border-radius:6px }
      .stats-sleeper .ss-check { font-weight:400;margin:7px 0 }.stats-sleeper button { padding:9px 13px;margin:5px 7px 5px 0;cursor:pointer;font:inherit;border:1px solid #999;border-radius:5px }
      .stats-sleeper button[type=submit] { background:#222;color:#fff }.stats-sleeper button:disabled { opacity:.5;cursor:wait }
      .stats-sleeper .ss-status { white-space:pre-wrap;padding:10px;border-left:3px solid #777;min-height:24px }
      .stats-sleeper .ss-preview { max-width:280px;max-height:500px;display:block;background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 50% / 16px 16px;border:1px solid #aaa;margin-top:12px }
    </style>
    <section class="stats-sleeper">
      <h2>Stats Sleeper</h2><p>Your reading year, ready for the next chapter.</p>
      <form>
        <div class="ss-grid">
          <label>Sync server URL<input name="server" type="url" required placeholder="https://sync.crosspointreader.com"><span class="ss-help">Prefilled from the reader’s sync settings when available. You can change it here, including any path prefix.</span></label>
          <label>Sync username<input name="username" required autocomplete="username" autocapitalize="none"><span class="ss-help">Your existing username and password are protected, so we need to ask for them here.</span></label>
          <label>Sync password<input name="password" type="password" autocomplete="current-password"><span class="ss-help ss-password-help">Your browser calculates the sync key locally. Only the key is sent and saved; your password is not stored by this plugin.</span></label>
          <label>Sleep image<select name="mode"><option value="overlay">Cover + Transparent overlay</option><option value="custom">Custom wallpaper</option></select></label>
          <label>Screen width<input name="width" type="number" min="240" max="1600" required></label>
          <label>Screen height<input name="height" type="number" min="240" max="1600" required></label>
          <label>Timezone<input name="timezone" required placeholder="America/New_York"><span class="ss-help">Seasonal clock changes are handled by the server.</span></label>
          <label>Panel position<select name="placement"><option value="bottom">Bottom</option><option value="top">Top</option></select></label>
        </div>
        <fieldset><legend>Show on the panel</legend>
          <label class="ss-check"><input type="checkbox" name="metric" value="books" checked> Books finished this year</label>
          <label class="ss-check"><input type="checkbox" name="metric" value="goal" checked> Annual goal and celebration</label>
          <label class="ss-check"><input type="checkbox" name="metric" value="current" checked> Current-book progress</label>
          <label class="ss-check"><input type="checkbox" name="metric" value="streak" checked> Reading streak</label>
          <span class="ss-help">Uses your existing annual goal. No goal means no goal bar. Current-book progress appears when sleeping from a reader.</span>
          <a class="ss-goals" target="_blank" rel="noopener noreferrer">Manage your goal on the sync server</a>
        </fieldset>
        <fieldset><legend>Custom wallpaper background</legend>
          <label>Choose artwork<input name="background" type="file" accept="image/png,image/jpeg,image/webp"><span class="ss-help">Converted to a bounded PNG before upload. Stored on your sync account; available to its readers. Affects Custom wallpapers.</span></label>
          <button type="button" data-action="upload">Upload background</button><button type="button" data-action="remove">Use plain background</button>
        </fieldset>
        <label class="ss-check"><input name="replace" type="checkbox"> If a sleep image already exists, preserve a backup and replace it.</label>
        <label class="ss-check"><input name="allow_http" type="checkbox"> I accept sending my sync key over unencrypted HTTP if my server uses HTTP.</label>
        <p class="ss-help">Your authentication key is an account credential saved on the reader's SD card. Anyone with access to the card or its WebUI may be able to read it. Sleep refresh may briefly connect Wi-Fi; offline or low-battery sleep retains the last image.</p>
        <button type="button" data-action="test">Test connection</button><button type="button" data-action="preview">Preview</button><button type="submit">Save, refresh &amp; enable</button>
      </form>
      <p class="ss-status" role="status" aria-live="polite">Loading configuration…</p>
      <p class="ss-instructions"></p><img class="ss-preview" alt="Sleep image preview" hidden>
    </section>`;
  const form = container.querySelector('form'), status = container.querySelector('.ss-status');
  const image = container.querySelector('.ss-preview'), instructions = container.querySelector('.ss-instructions');
  let previewUrl, savedKey = '', savedUsername = '';
  const field = name => form.elements.namedItem(name);
  function explain() {
    instructions.textContent = field('mode').value === 'overlay'
      ? 'On the reader, choose Cover + Transparent to show this panel over your book cover. Transparent can overlay the retained page. This plugin does not change the sleep setting.'
      : 'On the reader, choose Custom to show the generated wallpaper. Cover + Custom shows it only on the custom branch; sleeping from a book shows its cover alone.';
    try { container.querySelector('.ss-goals').href = new URL(field('server').value).href.replace(/\/+$/, '') + '/app/#/settings/goals'; } catch { container.querySelector('.ss-goals').removeAttribute('href'); }
  }
  function values() {
    const value = {};
    for (const name of ['server','username','password','mode','width','height','timezone','placement']) value[name] = field(name).value;
    value.auth_key = value.username.trim() === savedUsername ? savedKey : '';
    value.metrics = [...form.querySelectorAll('[name=metric]:checked')].map(el => el.value).join(',');
    const cfg = core.buildConfig(value);
    if (cfg.server.startsWith('http:') && !field('allow_http').checked) throw new Error('Confirm the HTTP warning, or use HTTPS.');
    return cfg;
  }
  async function work(action) {
    for (const button of form.querySelectorAll('button')) button.disabled = true;
    status.textContent = 'Working…'; status.style.borderColor = '#777';
    try { await action(); }
    catch (error) { status.textContent = error.message || 'Request failed.'; status.style.borderColor = '#b33'; }
    finally { for (const button of form.querySelectorAll('button')) button.disabled = false; }
  }
  async function showPreview() {
    const blob = await controller.preview(values());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob); image.src = previewUrl; image.hidden = false;
    status.textContent = 'Preview uses your currently synced account stats. Current-book progress is supplied by the reader at sleep.';
  }
  async function backgroundPng(file) {
    if (!file) throw new Error('Choose a background image first.');
    if (file.size > 8 * 1024 * 1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image below 8 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 24000000) throw new Error('Choose artwork below 24 megapixels.');
      const ratio = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height, Math.sqrt(2000000 / (bitmap.width * bitmap.height)));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.floor(bitmap.width * ratio)); canvas.height = Math.max(1, Math.floor(bitmap.height * ratio));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 8 * 1024 * 1024) throw new Error('Converted background is too large. Try smaller artwork.');
      return blob;
    } finally { bitmap.close(); }
  }
  form.addEventListener('change', explain);
  form.addEventListener('submit', event => { event.preventDefault(); work(async () => {
    const cfg = await controller.save(values(), field('replace').checked);
    field('replace').checked = false;
    savedKey = cfg.auth_key; savedUsername = cfg.username; field('password').value = '';
    container.querySelector('.ss-password-help').textContent = 'Sync key saved. Leave the password blank to keep it, or enter a new password to replace it.';
    const backups = JSON.parse(cfg.backup_paths);
    status.textContent = 'Image refreshed and automatic sleep refresh enabled. ' + (backups.length ? 'Original artwork backups: ' + backups.join(', ') : '');
    explain();
  }); });
  form.querySelector('[data-action=test]').addEventListener('click', () => work(async () => {
    const result = await controller.connection(values()); status.textContent = 'Connected. Image rendering is supported. ' + (result.background ? 'Your account has a custom background.' : 'Using a plain Custom background.');
  }));
  form.querySelector('[data-action=preview]').addEventListener('click', () => work(showPreview));
  form.querySelector('[data-action=upload]').addEventListener('click', () => work(async () => {
    const input = values(), blob = await backgroundPng(field('background').files[0]);
    await controller.upload(input, blob); status.textContent = 'Background saved on your sync account. Preview or refresh the Custom wallpaper to use it.';
  }));
  form.querySelector('[data-action=remove]').addEventListener('click', () => work(async () => {
    await controller.removeBackground(values()); status.textContent = 'Account background removed. Custom wallpapers will use a plain background on the next refresh.';
  }));
  const defaults = { server: 'https://sync.crosspointreader.com', username: '', auth_key: '', mode: 'overlay', width: 480, height: 800, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', placement: 'bottom', metrics: core.METRICS.join(',') };
  try {
    const saved = await controller.load();
    if (!saved?.server) {
      try {
        const response = await fetch('/api/settings?keys=koServerUrl', { cache: 'no-store' });
        if (response.ok) {
          const settings = await response.json();
          const value = Array.isArray(settings) && settings.find(item => item.key === 'koServerUrl')?.value;
          if (typeof value === 'string' && value.trim()) {
            const url = new URL(value.trim());
            if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash) defaults.server = value.trim();
          }
        }
      } catch { /* Older firmware or unavailable settings: keep the editable default. */ }
    }
    const config = { ...defaults, ...saved };
    savedKey = config.auth_key; savedUsername = config.username;
    for (const name of ['server','username','mode','width','height','timezone','placement']) field(name).value = config[name];
    for (const checkbox of form.querySelectorAll('[name=metric]')) checkbox.checked = config.metrics.split(',').includes(checkbox.value);
    if (saved?.auth_key) container.querySelector('.ss-password-help').textContent = 'A sync key is already saved. Leave the password blank to keep it, or enter a new password to replace it.';
    status.textContent = saved ? 'Configuration loaded. Save, refresh & enable reapplies automatic refresh after a plugin update.' : 'Enter your sync account and reader resolution, then test the connection.';
  } catch (error) { status.textContent = error.message; }
  explain();
});
