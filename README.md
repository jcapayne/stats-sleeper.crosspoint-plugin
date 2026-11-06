# Stats Sleeper for CrossPoint

A native-plugin sleep-image overlay backed by crosspoint-sync. The sync service renders the image; the reader downloads it before sleep. No firmware changes are required.

The plugin supports Cover + Transparent overlays and complete Custom wallpapers. It shows books finished this year, the existing annual goal, goal celebrations, current-book percentage, and reading streaks. See [the installable guide](stats-sleeper.crosspoint-plugin/README.md) for setup, credentials, supported sleep modes, offline behavior, and artwork restoration.

## Status and installation

Version `0.1.0` is local development work, not a published Plugin Hub release. The corresponding server branch is `codex/stats-sleeper` in the isolated crosspoint-sync worktree at `.worktrees/crosspoint-sync`, based on upstream `e7ace2c2c1e04a18bb622b0739a04f15c35af6e0`. Nothing has been deployed to `sync.crosspointreader.com`.

For manual reader installation, copy the **contents** of `stats-sleeper.crosspoint-plugin/` to `/.crosspoint/plugins/stats-sleeper/` on the SD card. Open the reader WebUI's Plugins page to configure it. Do not install tests, dependency directories, design docs, or the server worktree.

For a self-hosted server, build/deploy the companion server branch using that repository's normal Docker/deployment instructions. Its startup migrations add `0049_sleep_backgrounds.sql`; run the updated code and migrations together. The service adds only the pure JavaScript `pngjs` runtime dependency. Confirm authenticated `GET /api/v1/stats/sleep-image/status` returns `version: 1`, including your deployment prefix, before enabling the plugin. The branch's `docs/API.md` describes the complete endpoint contract. Existing annual goals require no new goal configuration model.

## Development

Node 22.13+ is required. From this repository:

```sh
npm ci
npm test
npm run validate
```

From the companion sync worktree:

```sh
npm ci
npm test
npm run build
```

Renderer tests decode PNGs, inspect BMP headers/row padding, and bound high-resolution images below the firmware's 1 MB event-download cap. Plugin tests exercise real configuration/backup logic against a simulated SD filesystem and render the real setup UI in jsdom. A physical reader remains necessary to verify hardware rendering and firmware sleep/network behavior.

For publication, create a public repository with topic `crosspoint-plugin`, preserve the single direct-child payload directory and explicit manifest file list, and publish an immutable stable `v0.1.0` release. Every future runtime release needs a new version and tag. Do not claim hosted-server support until that endpoint is deployed.
