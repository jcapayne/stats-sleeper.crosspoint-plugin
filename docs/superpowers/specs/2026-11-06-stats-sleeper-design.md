# Stats Sleeper design

Date: 2026-11-06
Status: Approved; implemented in the local plugin and companion server branches

## Intent and agreed scope

Create a CrossPoint plugin that turns account reading stats into a pleasant sleep-screen panel. Use the existing plugin API, with a companion change to crosspoint-sync to render images. Support the hosted service and self-hosted instances through a configurable base URL, including URLs with a path prefix.

The user accepted Cover + Transparent as the recommended mode and Custom through a generated wallpaper. No firmware changes are part of this project.

## Approaches

1. A plugin plus firmware drawing hook would support every sleep mode, but requires firmware changes. The user ruled this out.
2. A plugin plus a sync-server image endpoint uses the existing sleep event download mechanism. This is the selected approach. It requires an updated sync deployment and inherits the firmware's sleep-mode behavior.
3. Browser-only generation could prepare a static image but cannot refresh autonomously at sleep. This does not meet the intended behavior.

## What users see

A compact, high-contrast panel near the bottom of the screen, with generous padding and a white backing for readability over artwork. Defaults are my proposal: annual finished-book count, annual goal bar and count when a goal exists, current-book percentage when supplied by the reader, and current reading streak. Users can hide individual metrics and choose top or bottom placement.

When the annual goal is reached, replace the ordinary goal treatment with a small trophy/star motif and “Goal reached!” while retaining the actual count, including counts above the target. This is a static e-paper celebration, visible while the goal remains reached. No animation or repeat notifications.

Cover + Transparent uses a transparent PNG with only the panel opaque. Custom uses a complete rendered PNG-compatible input converted to the firmware's supported custom BMP output, with the panel composited onto a selected background; a plain light background is available by default. Users can upload their own background through the setup UI. Source images are bounded and normalized on the sync server. The service does not fetch arbitrary background URLs.

Cover + Custom retains firmware behavior: the generated wallpaper appears on the custom branch; sleeping from a book displays its cover alone. Explain this in setup. Transparent mode can also overlay the retained page. An always-present panel across every sleep mode is outside scope.

## Plugin and configuration

Plugin ID: `stats-sleeper`. Installable payload is the direct child `stats-sleeper.crosspoint-plugin/`, containing `manifest.json`, `plugin.js`, `device.json`, an installable README, and any explicitly listed runtime assets. Tests, server patch, tools, and design documents stay outside the payload. Initial version: `0.1.0`.

The browser plugin uses `CrossPoint.registerPlugin` and firmware-provided APIs. Its setup form offers the sync base URL (default `https://sync.crosspointreader.com`), username and sync authentication key, device resolution, timezone, image mode, metrics, and panel placement. Explain how to obtain the account's KOSync authentication key. Do not require a plaintext password or read protected firmware credential stores. A connection test checks authentication and image-endpoint support, and produces an actionable message for older server versions.

Use existing account reading goals. Setup links users to the server's goal settings if no current-year target exists. Missing goals hide the goal bar and celebration; finished-book totals still appear. Creating a separate plugin goal is outside scope.

Persist only the required flat plugin configuration, within the firmware's config-size limit. Store it outside the release file list so updates do not reset it. Inform users that the authentication key is an account credential stored on the SD card. Send credentials in headers, never query strings. Warn before using plain HTTP for a self-hosted server.

Resolution is explicit in setup unless verified firmware status provides reliable dimensions. Timezone is initially taken from the setup browser as an IANA timezone and is configurable, so the server can calculate seasonal UTC offsets without reopening setup.

Provide a preview and “Refresh image” action. Keep the firmware's current sleep setting until the user chooses a supported mode; do not silently switch it. Show instructions for the appropriate sleep mode.

## Companion sync-server change

Proposed authenticated endpoint: `GET /api/v1/stats/sleep-image`. Final route naming is left to implementation if existing server conventions warrant it. Return image bytes directly, with the correct content type and private/no-store caching. Reuse the existing account authentication middleware, stats calculations, reading-goal model, and year/date semantics. Do not make internal HTTP requests back to the same service or duplicate finish-count rules.

Validated query options describe image mode, bounded dimensions, timezone, visible metrics, and placement. Rendering must remain under the firmware event download limit of 1 MB. Prefer compact PNG for alpha overlays and a low-bit-depth BMP for Custom. Do not use full-screen 32-bit BMPs, which exceed that limit at common reader resolutions. Bound dimensions, decoded background pixels, upload sizes, and rendering work.

An authenticated background upload/remove facility stores a normalized image scoped to the account, with a default when absent. It follows existing account-data deletion/export conventions as appropriate. File type and dimensions are checked from decoded bytes; arbitrary paths and remote fetches are not accepted. Rendering must work in the service's normal container and self-hosted deployment. Dependency selection and font implementation are left to the builder after inspecting existing tooling.

Pass the sleep event's live percentage in a request header rather than relying on the server's last synced book. Only accept finite values from 0 through 100. A missing or unresolved firmware template means no current-book metric. Avoid interpolating book paths into URLs: event substitutions do not safely encode query delimiters. Version one labels this metric “Current book” and does not require title matching or transmit book paths. Use the visible-page percentage, rather than pretending the bottom of a page has already been read.

The image request is read-only with respect to reading history. A 100% event does not mark a server book finished. Annual counts and goal completion reflect the latest data actually synced to the account; an unsynced completion may appear on a later refresh. Missing measured-time data is not shown as zero reading time.

Deliver the server change as a reviewable companion patch against a recorded upstream commit, with tests and deployment instructions outside the plugin payload. Do not deploy to the hosted service, push branches, or publish a release as part of local implementation. The hosted service requires upstream acceptance and deployment before automatic rendering works there.

## Sleep flow and failure behavior

1. Browser setup writes a small valid config and selects the destination for the chosen mode: `/sleep-overlay.png` or `/sleep.bmp`.
2. `device.json` declares a `sleep.enter` download using the configured URL and authentication headers. Native firmware downloads it before sleep rendering; no browser needs to remain open.
3. Wi-Fi bring-up, battery gating, timeouts, and retries remain firmware-owned. Do not promise an instant sleep transition: Wi-Fi connection can add delay.
4. Successful downloads supply the image for that sleep. The inspected develop implementation downloads into `.part`, checks success, and parks the old destination as `.bak` during replacement with rollback on rename failure. This preserves the previous image on network/HTTP failures without a new plugin API. Target and document firmware containing this behavior. Invalid image bytes returned with a success status remain the service's responsibility; validate rendered output before responding.

The root sleep filenames have priority and may already contain the user's artwork. Setup must detect conflicts and obtain an explicit replace choice before writing a generated image; where supported, preserve a backup and provide restore instructions. Never delete existing wallpaper directories. Changing modes must not silently remove unrelated user files.

## Verification and completion

Verify the manifest layout and safe explicit runtime file list; load the browser plugin against a representative firmware API mock; exercise setup, persistence, credential handling, prefixed server URLs, unsupported-server errors, and conflict handling.

Server checks cover authentication/account separation, goal absent/unreached/reached/exceeded, year boundaries and timezone offsets, missing/invalid event percentages, option bounds, upload limits and invalid image input, output dimensions/format/alpha/size, and account-scoped background storage. Reuse existing stats/goal tests and run appropriate upstream checks for the companion patch.

Render representative outputs and inspect them at intended screen sizes, including over a cover and a busy background. Hardware sleep and failed-download behavior need reader validation; report any hardware checks not performed. Do not describe the plugin as hosted-service-ready before the server endpoint is deployed.

## Sources inspected

- Plugin Hub agent guide and authoritative publishing contract, main branch.
- CrossPoint develop: `docs/sd-plugins.md`, `docs/plugin-events.md`, and `SleepActivity.cpp`.
- crosspoint-sync main: API reference, wallpaper UI, stats routes, and reading-goal model.

Record immutable upstream revisions when preparing implementation so later changes do not silently change the target contract.

## Builder review

An independent builder check found no important unanswered planning questions. Firmware source inspection also confirmed the staged sleep-download replacement behavior described above.
