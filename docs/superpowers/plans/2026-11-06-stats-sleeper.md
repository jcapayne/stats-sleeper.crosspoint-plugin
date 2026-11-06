# Stats Sleeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a Plugin Hub-compatible reading-stats sleep plugin and the corresponding authenticated crosspoint-sync image service.

**Architecture:** The browser plugin configures a native `sleep.enter` download. The sync service generates either a transparent PNG panel or a background-composited, low-bit-depth BMP using account stats and goals. No firmware changes or browser session are needed during sleep.

**Tech Stack:** Plain browser JavaScript and JSON; existing Hono/TypeScript/SQLite service; `pngjs` for bounded PNG decoding/encoding; Node's test runner for plugin tests and Vitest for service tests.

**Spec:** `docs/superpowers/specs/2026-11-06-stats-sleeper-design.md`

## Global Constraints

- Plugin ID `stats-sleeper`; initial version `0.1.0`; exactly one direct-child installable payload directory.
- Firmware sleep download limit: 1 MB; preserve native staged download and retry behavior.
- Cover + Transparent is recommended; Custom uses a complete wallpaper; Cover + Custom keeps its existing conditional behavior.
- Support configurable server base URLs including path prefixes, with credentials only in headers.
- Reuse account reading goals; do not mutate reading history from image requests.
- Worktree: `/Users/jpayne/src/stats-sleeper.crosspoint-plugin/.worktrees/crosspoint-sync`; branch `codex/stats-sleeper`; base `e7ace2c2c1e04a18bb622b0739a04f15c35af6e0`.
- Original `/Users/jpayne/src/crosspoint-sync` working tree and index must remain untouched.
- Commits use `jcapayne <7683622+jcapayne@users.noreply.github.com>`; verify `jcapayne` authentication before pushes. Never force-push.
- Do not deploy the hosted service or publish releases during implementation.

## Review Focus

- An old queued sleep event must not manufacture new completions; event percentage is display-only.
- Missing templates, percentages, and goals must hide their metrics instead of displaying misleading zeroes.
- Output for common high-resolution readers must remain below 1 MB, including incompressible background artwork.
- Existing `/sleep.bmp` and `/sleep-overlay.png` must not be overwritten without an explicit replacement choice.
- Cross-account background access, account deletion, oversized PNG headers, and failed uploads must not expose or replace stored artwork.

## File boundaries

Server files below are relative to the sync worktree. Plugin files are relative to this repository root.

- `src/models/sleep-image.ts`: option validation, timezone, account metrics, and background persistence.
- `src/render/sleep-image.ts`, `src/render/sleep-font.ts`: raster panel, bitmap font, transparent PNG, and native 2-bit BMP encoding.
- `src/routes/v1/sleep-image.ts`: authenticated capabilities, render, and background endpoints.
- `src/routes/v1/stats.ts`: expose the existing account overview as an internal callable helper without changing its HTTP response.
- `migrations/0049_sleep_backgrounds.sql`: account-owned normalized PNG storage (adjust number only if base changes).
- `src/app.ts`, `src/routes/account.ts`: route registration and presentation-data cleanup.
- `test/sleep-image.test.ts`, `test/sleep-image-render.test.ts`: service integration and binary format tests.
- `stats-sleeper.crosspoint-plugin/{manifest.json,device.json,plugin.js,README.md}`: installable plugin only.
- `tests/plugin.test.mjs`, `tools/validate-plugin.mjs`, root `README.md`, `.gitignore`: development checks and instructions.

### Task 1: Shared stats and validated image data

**Interfaces:** `accountOverview(db, userId, tz, days)` returns the existing unfiltered account digest. `sleepMetrics(db, userId, timezone, percent)` returns `{year, finished, target, currentPercent, streak}`. `parseSleepOptions(query)` returns a validated image description or a typed validation error.

- [x] Add failing tests proving overview parity, existing-goal reuse, local-year boundaries, DST offsets, absent goals, and absent/unresolved/invalid current percentages.
- [x] Run `node node_modules/vitest/vitest.mjs run test/sleep-image.test.ts` and confirm failure for the missing interfaces.
- [x] Extract only the unfiltered overview computation needed by both routes; preserve filters, grouping, existing output, and tests. Do not trigger external metadata requests while rendering a sleep image.
- [x] Validate mode (`overlay` or `custom`), placement (`top` or `bottom`), metric allowlist, IANA timezone, dimensions 240–1600 per axis, and at most 2,000,000 pixels. Current percentage is read from `X-Sleep-Percent`; invalid/unresolved values are omitted.
- [x] Use the existing reading-goal model for the current year and its canonical finished count; preserve actual counts above goal. With no goal, use the overview's finished-this-year count.
- [x] Run the targeted tests plus `test/stats-overview.test.ts` and `test/reading-goals.test.ts`; commit this independently testable refactor as jcapayne.

### Task 2: Render compact, readable sleep images

**Interfaces:** `renderSleepImage(metrics, options, background?)` returns `{bytes: Buffer, contentType: 'image/png' | 'image/bmp'}`. `normalizeBackground(bytes)` returns a validated, bounded PNG or a typed input error.

- [x] Write failing tests for PNG dimensions/alpha, opaque readable panel, goal absent/unreached/reached/exceeded, top/bottom placement, missing metrics, native 2-bit BMP row padding/palette, and output below 1,048,576 bytes at 1200×1600 with a noisy background.
- [x] Install `pngjs` and its TypeScript declarations using the lockfile; no native graphics dependencies. Inspect PNG signature/IHDR and bound decoded pixels before decoding. Limit upload bytes to 8 MB and dimensions to the rendering limits.
- [x] Implement a small deterministic bitmap font, high-contrast panel, progress bars, and static star/trophy motif. Use a plain white Custom background by default and crop uploaded artwork to fill the requested output.
- [x] Encode Custom output as a native 2-bit grayscale BMP and Overlay as PNG with transparent surroundings. Verify encoded size before returning any response.
- [x] Run renderer tests and TypeScript build. Generate and inspect overlay/custom examples at 480×800 and 1200×1600; commit as jcapayne.

### Task 3: Authenticated rendering and background storage

**Interfaces:** `GET /api/v1/stats/sleep-image/status` returns `{version: 1, background: boolean}`; `GET /api/v1/stats/sleep-image` returns an image; `PUT/GET/DELETE /api/v1/stats/sleep-image/background` manages the signed-in account's normalized PNG. All use existing session-or-key authentication.

- [x] Add failing integration tests for missing/wrong auth, account separation, base-path deployment, private/no-store responses, invalid options, oversized/invalid images, failed upload preservation, and deleting account data/backgrounds.
- [x] Add `sleep_backgrounds` keyed by user ID with a cascading foreign key. Treat this as presentation data, separate from portable reading history; explicitly clear it when reading data is wiped while keeping the account.
- [x] Register routes with the existing authenticated v1 router, bounded upload middleware, and appropriate content types. Return actionable JSON errors before a successful image response; no redirects and no remote background fetching.
- [x] Support firmware relay setup and direct authenticated CORS image/background requests from the setup browser; allow `X-Sleep-Percent` in API CORS headers. Keep cookie behavior consistent with existing CORS policy.
- [x] Run targeted tests, the server suite, and TypeScript build; document the wire contract in `docs/API.md`; commit as jcapayne.

### Task 4: Plugin configuration, preview, and native sleep refresh

**Interfaces:** flat persisted config contains `image_url`, `dest`, `username`, `auth_key`, and setup preferences within the firmware config limit. Native `device.json` uses `{cfg.image_url}`, `{cfg.dest}`, account-auth headers, and `X-Sleep-Percent: {event.percent}`. Runtime config is not a release file.

- [x] Inspect current firmware settings, file-operation payloads, and plugin relative config resolution before implementing; do not assume undocumented APIs.
- [x] Add failing Node tests with a mocked CrossPoint host covering server URLs with prefixes, invalid URLs, auth headers, UTF-8 base64 persistence, config-size bounds, unsupported servers, and sleep event interpolation.
- [x] Build the setup form with explicit username/auth key, resolution, timezone, mode, metric toggles, placement, HTTP warning, and SD credential warning. Default to hosted URL and Cover + Transparent instructions.
- [x] Add connection/status check, authenticated image preview, optional uploaded image converted to bounded PNG in the browser, remove-background control, and native API-based refresh. Use direct authenticated browser requests for binary previews/uploads so image bytes are not passed through the small text relay. Explain CORS/mixed-content errors without exposing keys.
- [x] Detect existing destination images and require an explicit replace choice; preserve a backup through verified firmware file operations before writing. Never delete other wallpapers or silently change the firmware sleep mode. Save a new working config only after validation and required conflict handling succeed.
- [x] For first installation, write an initial small inert `device.json` without an active download handler; setup writes the enabled runtime handler only after configuration is complete. Include the template behavior in tests and document update handling so installed users can reapply configuration after an update.
- [x] Run plugin tests, review the actual persisted event/config files, and check setup against a realistic browser DOM. Keep runtime files independent of build tooling.

### Task 5: Packaging, end-to-end checks, and review

**Interfaces:** `node tools/validate-plugin.mjs` validates one direct-child payload, manifest version, safe explicit file list, and required entry points. Root docs describe development, installation, service deployment, supported sleep modes, and restore behavior.

- [x] Initialize the plugin Git repository if still absent, ignoring `.worktrees/`, dependencies, generated examples, credentials, and runtime configuration. Set the same repository-local jcapayne identity.
- [x] Add the manifest validator and meaningful fixture checks for unsafe/missing file entries. Include all shipped runtime assets and exclude all development/server material from the payload.
- [x] Exercise setup, upload, render, refresh, goal celebration, and prefix-path behavior against a local updated service. Inspect final images and compare decoded output formats with firmware support. Clearly list hardware-only checks not performed.
- [x] Run plugin tests/validator, targeted server tests, full server tests, TypeScript build, and `git diff --check` in both repositories. Inspect the final diff and remove accidental/generated files.
- [x] Use `superpowers:requesting-code-review` for a whole-change review; resolve actionable findings and rerun affected checks. Commit only task-owned files as jcapayne. Keep hosted deployment and release publication out of scope.

## Baseline and self-review

After fetching upstream, local main, origin/main, upstream/main, and the feature branch all resolve to `e7ace2c2c1e04a18bb622b0739a04f15c35af6e0`. Baseline: 72 server test files / 1,015 tests pass; TypeScript build passes. Use Node 24 at `/Users/jpayne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`; the default shell does not resolve npm reliably. Obtain npm via its explicit installed CLI path if needed.

Spec coverage: tasks 1–3 cover stats/goal reuse, images, timezone, backgrounds and service deployment contract; task 4 covers setup, native refresh and user artwork protection; task 5 covers Hub layout, documentation, verification and independent review. Review-focus cases map to tasks 1, 2, 3 and 4. The user approved the design and implementation handoff. Execution is native in this chat, with one independent whole-change review.

Final verification and implementation decisions are recorded in `docs/IMPLEMENTATION_NOTES.md`. All five tasks are complete; hosted deployment and physical-reader validation remain outside the verified local result.
