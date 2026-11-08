# Stats Sleeper for CrossPoint

A native-plugin sleep-image overlay backed by crosspoint-sync. The sync service renders the image; the reader downloads it before sleep. No firmware changes are required.

The plugin supports Cover + Transparent overlays and complete Custom wallpapers. It shows books finished this year, the existing annual goal, goal celebrations, current-book percentage, and reading streaks. See [the installable guide](stats-sleeper.crosspoint-plugin/README.md) for setup, credentials, supported sleep modes, offline behavior, and artwork restoration.

Both modes now use a reading-journal visual treatment: bold serif typography, high-contrast borders, numeric columns, and a tilted goal seal with a progress ring. Custom includes framed artwork or an original line illustration. The image API parameters are unchanged.

## Status and installation

Version `0.1.0` is in development; no stable Plugin Hub release has been published. The companion authenticated image API was merged into upstream crosspoint-sync in [PR #77](https://github.com/crosspoint-reader/crosspoint-sync/pull/77). Merging the API does not deploy it: your hosted or self-hosted server must run a version containing that change. Use **Test connection** in plugin setup to confirm support before enabling refresh.

The reader needs firmware with browser plugins, native `sleep.enter` event downloads, and transparent PNG sleep overlays. These features may require development firmware. Cover overlays additionally need the **Cover + Transparent** sleep setting; **Transparent** overlays the retained page, and **Custom** displays the full-page wallpaper. **Cover + Custom** switches between the cover and wallpaper rather than combining them.

For manual reader installation, copy the **contents** of `stats-sleeper.crosspoint-plugin/` to `/.crosspoint/plugins/stats-sleeper/` on the SD card. Open the reader WebUI's Plugins page to configure it. Do not install tests, dependency directories, design docs, or the server worktree.

For a self-hosted server, update to upstream `main` containing PR #77, or a subsequent release containing it, using the [crosspoint-sync deployment instructions](https://github.com/crosspoint-reader/crosspoint-sync). Its startup migrations add `0049_sleep_backgrounds.sql`; run the updated code and migrations together. The service uses the pure JavaScript `pngjs` and `opentype.js` runtime dependencies, with bundled licensed fonts. Confirm authenticated `GET /api/v1/stats/sleep-image/status` returns `version: 1`, including your deployment prefix, before enabling the plugin. The upstream [API documentation](https://github.com/crosspoint-reader/crosspoint-sync/blob/main/docs/API.md#sleep-image-plugin-support) describes the complete endpoint contract. Existing annual goals require no new goal configuration model.

## Development

Node 22.13+ is required. From this repository:

```sh
npm ci
npm test
npm run validate
```

After building the companion server, include the integration test against its real routes with:

```sh
STATS_SLEEPER_SYNC_WORKTREE=.worktrees/crosspoint-sync npm test
```

Regenerate the sample journal previews after building the server:

```sh
node tools/render-journal-previews.mjs
```

From the companion sync worktree:

```sh
npm ci
npm test
npm run build
```

Renderer tests decode PNGs, inspect BMP headers/row padding, and bound high-resolution images below the firmware's 1 MB event-download cap. Plugin tests exercise real configuration/backup logic against a simulated SD filesystem and render the real setup UI in jsdom. A physical reader remains necessary to verify hardware rendering and firmware sleep/network behavior.

The public repository is [jcapayne/stats-sleeper.crosspoint-plugin](https://github.com/jcapayne/stats-sleeper.crosspoint-plugin). For Plugin Hub publication, preserve the single direct-child payload directory and explicit manifest file list, and publish an immutable stable `v0.1.0` release when ready. Every future runtime release needs a new version and tag. Do not claim hosted-server support until that endpoint is deployed.
