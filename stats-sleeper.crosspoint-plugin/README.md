# Stats Sleeper

Your reading year on your CrossPoint sleep screen: books finished, annual goal progress, a goal celebration, current-book progress, and your reading streak.

## Requirements

- CrossPoint firmware with browser plugins, `sleep.enter` event downloads, and transparent PNG sleep overlays. These features may be in development firmware; manual installation alone does not add firmware support.
- A crosspoint-sync deployment containing the Stats Sleeper image endpoint. The public hosted service works only after its maintainers deploy that change. Older self-hosted servers must also be updated. The plugin reports unsupported servers during the connection test.
- Your sync username and KOSync authentication key, plus the reader's screen dimensions.

## Setup

1. Open your reader's WebUI, then Plugins → Stats Sleeper.
2. Enter the server URL, including any self-hosted prefix, and your sync username/key. The hosted URL is `https://sync.crosspointreader.com`.
3. Enter the actual screen width and height. The initial 480×800 values are defaults, not hardware detection. Choose your timezone, metrics, and panel position.
4. Test the connection and preview. Annual goals come from your account's existing goal settings. Without a goal, the goal bar and celebration are hidden.
5. For Custom wallpapers, optionally upload PNG, JPEG, or WebP artwork. The browser converts and resizes it before storing it on your sync account. The plain-background button removes that account background for all its readers.
6. Select the explicit replacement checkbox if you already have a sleep image, including a previously generated one. Save, refresh & enable preserves the displaced file as a root-level `stats-sleeper-original-…` backup and activates native sleep refresh. This protects originals you may have manually restored since the previous setup.
7. Choose the matching sleep mode on the reader. The plugin does not change this setting for you.

The authentication key is the lowercase 32-character MD5 of your sync password, matching the KOSync protocol. Calculate it locally without putting the password in command history, for example:

```sh
python3 -c "import getpass,hashlib; print(hashlib.md5(getpass.getpass('Sync password: ').encode()).hexdigest())"
```

Treat the resulting key like your password. It is saved in `config.json` on the SD card. People with access to the card or the trusted WebUI may be able to read it. Never commit this configuration. Use HTTPS; HTTP sends the key unencrypted and requires explicit acceptance in setup.

## Sleep modes

- **Cover + Transparent:** recommended. The transparent PNG panel overlays the current cover.
- **Transparent:** the same panel overlays the retained screen/page.
- **Custom:** a complete BMP wallpaper composites the stats onto the account background (or a plain light background). It uses the firmware's native four gray shades and, at the configured screen size, bypasses its conversion cache. Browser previews use PNG because the native 2-bit BMP is reader-specific.
- **Cover + Custom:** firmware shows the generated wallpaper on its custom branch; sleeping from a book shows its cover alone. It does not overlay stats on that cover.

Current-book percentage comes directly from the reader when sleeping from a book. It is omitted when unavailable, including in the browser preview. It never changes sync progress or marks a book complete. Annual totals reflect what has actually reached the sync server, so an unsynced completion may appear on a later refresh. The goal celebration stays visible while the current year's goal is met or exceeded.

## Refresh, offline behavior, and updates

Native sleep refresh works without an open browser. Firmware may join Wi-Fi briefly at sleep; it owns battery gating, timeout, and retry behavior. On supported firmware, failed downloads preserve the previous complete image. The cached image stays visible offline and may therefore show older totals or the last year's panel until a successful refresh.

The root files `/sleep-overlay.png` and `/sleep.bmp` take priority over wallpaper directories. An existing `/sleep-overlay.bmp` also takes priority over PNG, so setup backs it up after your explicit replacement choice. Existing artwork directories are never removed.

After **every plugin update**, open setup and choose **Save, refresh & enable** again. Your `config.json` is retained, but the shipped `device.json` is deliberately inactive until setup reapplies the handler. This avoids enabling network activity before the first setup.

To stop automatic refresh, uninstall the plugin or replace its `device.json` with the inactive version from the release. To restore artwork, first stop the handler, move the generated root image aside with File Manager, then rename the desired `stats-sleeper-original-…` backup to its original filename. Restore an original overlay BMP as well if one existed. The six most recent backup names are displayed after saving and recorded in `config.json`; older backup files remain on the SD card and are never automatically deleted. Uploaded account backgrounds remain on the server until removed in setup or the account's reading data/account is deleted.

Known limitation: if setup fails after staging a downloaded image, a root-level `stats-sleeper-pending-…` image may remain. It is safe to remove that pending image in File Manager after setup has stopped. It is separate from your original-artwork backups.

Browser preview and background upload require browser access to the sync server and its API CORS support. HTTPS pages cannot contact plain HTTP servers in many browsers. Native sleep downloads use the reader's network connection instead. Server redirects are rejected for browser requests; configure the final URL.
