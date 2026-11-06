# Implementation and verification notes

Implemented locally on 2026-11-06. Both repositories use branch `codex/stats-sleeper`; commits are authored as `jcapayne <7683622+jcapayne@users.noreply.github.com>`.

## Source baselines

- Server: upstream `e7ace2c2c1e04a18bb622b0739a04f15c35af6e0`. Local main and the jcapayne fork's main were fast-forwarded to this revision before implementation.
- Firmware API/source inspected: CrossPoint develop `5d731041325bc871e99439d5e6db647695e6c733`. SleepActivity, PluginEvents, plugin-host, Bitmap and BmpToBmpConverter downloaded source files were checked against their Git blob hashes in the inspected source tree.
- Server worktree: `.worktrees/crosspoint-sync`, attached to the existing `/Users/jpayne/src/crosspoint-sync` repository. Its original dirty `codex/ios-shortcuts` checkout was not switched or edited.

## Decisions made during implementation

- Initialized the plugin Git repository during setup rather than at packaging time so changes could be tracked from the start. This has no effect on runtime behavior.
- Reused the canonical annual completion calculation and existing streak model instead of refactoring the larger overview route. This keeps sleep rendering independent of metadata-network requests and minimizes changes to existing APIs; the existing goal/overview tests remain green.
- Used the firmware-provided `api.dir` and documented `/rename` endpoint. `/move` accepts a destination directory rather than a new filename. Firmware API and hardware support remain requirements; neither is emulated on the reader.
- Delivered server changes on the explicitly requested real repository branch rather than duplicating them into a patch file. They remain separate from the installable plugin and need review/deployment in that repository.
- Shipped an inactive device handler, with setup enabling it after configuration. Installed config survives updates, but users must reapply “Save, refresh & enable” after every plugin update. This is the existing-API tradeoff for avoiding first-install network events before setup.
- Always require explicit replacement consent and retain displaced root images. A remembered destination path cannot establish ownership after a user manually restores artwork. Manual refresh therefore needs the replacement checkbox; the latest six backup paths are recorded while all older backup files remain on SD.
- Generate native 2-bit, four-shade BMPs for Custom, with PNG browser previews. Firmware treats these as screen-ready at the matching configured resolution and avoids accumulating converted-image cache entries. Incorrectly configured dimensions can still cause firmware scaling/conversion. Cleanup of existing firmware-wide caches is outside the plugin's scope.
- No hosted-service deployment, feature-branch publication, release publication, or physical-reader claims are included. The hosted service requires deployment of the new endpoint, and hardware rendering/sleep/network behavior still needs reader testing.

## Independent review and fixes

A fresh reviewer inspected both changes and firmware compatibility. Two important issue classes were corrected with tests that reproduced them first:

1. PNG allocation limits could be bypassed by a second IHDR or excessive interlaced IDAT inflation. Full chunk validation and bounded scanline inflation now precede decoding; invalid uploads preserve the previous background. Valid interlaced PNGs remain supported.
2. Restored original artwork could be mistaken for plugin output by pathname. Every displaced file is now retained, including the documented restore → re-enable sequence.

A short-landscape clipping regression was also reproduced and corrected by bounding panel scale by both width and height.

## Verification

- Server: 74 files, 1,035 tests pass; TypeScript build passes.
- Plugin: 12 tests pass, including the real setup UI in jsdom, simulated SD rollback/restoration, and integration with the actual migrated service routes under a URL prefix.
- Payload validator and Git whitespace checks pass. The ZIP contains exactly the five manifest-declared runtime files, no credentials or development material.
- Progress and goal-celebration images were rendered and visually inspected. Common portrait and short landscape dimensions, native BMP layout/palette, transparent PNG output, and high-resolution encoded size are covered.
- Hardware-only behavior remains unverified: actual display waveforms, Wi-Fi timing, low-battery gating and interrupted SD operations.

## Deferred minor

A setup failure after successfully staging an image can leave a root-level `stats-sleeper-pending-…` file. Original-artwork backups remain safe. The installed README explains how to remove that pending file in File Manager; automatic cleanup is deferred.

## Local-testing follow-ups

- Fixed the inherited `0044` → `0048` reading-goals migration rename compatibility, preserving existing goals and refusing unexpected schemas. The original failure was reproduced before the repair. The server remains on `codex/stats-sleeper`.
- Added the user-selected journal treatments to both modes: bundled licensed Lora serif fonts, rounded fine borders, numeric columns, and an annual-goal seal tilted ten degrees across the border. Custom frames uploaded artwork or an original open-book illustration; compact/landscape mode stays in bounds. The reference image was not copied into any runtime asset.
- Rendering remains pure JavaScript with no native font/graphics dependencies or runtime font downloads. The source and compiled builds resolve the same bundled font paths. Font licenses ship with the server assets.
- Updated verification: 75 server files / 1,041 tests pass, plus 12 plugin tests including real service integration, TypeScript build, manifest validator, and whitespace checks. A fresh review reran the renderer/layout tests and swept supported dimensions/placements without finding overflow.
- Built local Docker image `crosspoint-sync:stats-sleeper-journal`; isolated read-only/no-network container renders at 1200×1600 produced an 86,052-byte overlay PNG and a 480,070-byte native 2-bit BMP. No existing container, volume, or running service was changed.
- Preview examples use sample account data and original geometric sample artwork. Regenerate them with `node tools/render-journal-previews.mjs` after building the companion server.
