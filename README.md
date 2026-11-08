# Stats Sleeper for CrossPoint

A native-plugin sleep-image overlay backed by crosspoint-sync. The sync service renders the image; the reader downloads it before sleep. No firmware changes are required.

The plugin supports Cover + Transparent overlays and complete Custom wallpapers. It shows books finished this year, the existing annual goal, goal celebrations, current-book percentage, and reading streaks. See [the installable guide](stats-sleeper.crosspoint-plugin/README.md) for setup, credentials, supported sleep modes, offline behavior, and artwork restoration.

Both modes now use a reading-journal visual treatment: serif typography, fine borders, numeric columns, and a goal seal tilted across the bookplate. Custom includes framed artwork or an original line illustration. The image API parameters are unchanged.

## Status and installation

Version `0.1.0` is in development; no stable Plugin Hub release has been published. The companion authenticated image API is proposed in [crosspoint-sync PR #77](https://github.com/crosspoint-reader/crosspoint-sync/pull/77). Your hosted or self-hosted sync server must include that API before the plugin can work; setup checks support before enabling refresh.

For manual reader installation, copy the **contents** of `stats-sleeper.crosspoint-plugin/` to `/.crosspoint/plugins/stats-sleeper/` on the SD card. Open the reader WebUI's Plugins page to configure it. Do not install tests, dependency directories, design docs, or the server worktree.

For a self-hosted server, build/deploy the companion `codex/authenticated-stats-images` server branch using that repository's normal Docker/deployment instructions. Its startup migrations add `0049_sleep_backgrounds.sql`; run the updated code and migrations together. The service uses the pure JavaScript `pngjs` and `opentype.js` runtime dependencies, with bundled licensed fonts. Confirm authenticated `GET /api/v1/stats/sleep-image/status` returns `version: 1`, including your deployment prefix, before enabling the plugin. The branch's `docs/API.md` describes the complete endpoint contract. Existing annual goals require no new goal configuration model.

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
