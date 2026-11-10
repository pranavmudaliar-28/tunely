# Tunely for Android TV

Native Android TV app for Tunely: the same free live-TV directory as the web app (https://tunely-tv.vercel.app),
read from the public API (https://tunely-api-sfpe.onrender.com). Kotlin, Jetpack Compose for TV and Media3 ExoPlayer.

This is a standalone Gradle project. It is not part of the pnpm/Turborepo workspace, and `pnpm` commands ignore it.

## What it does

- **Home:** Favorites (stored on the device) first, then "Most watched now" (`/v1/trending`), "Live now" (live, best
  first) and one rail per category with at least 6 live channels, in the web home's order (popular categories first,
  shopping last). Rails load as they scroll into view.
- **Browse:** Categories and Languages list every option that has live channels, most first. Each opens a paged grid
  of its live channels, best first.
- **Search:** a text field that opens the TV's on-screen keyboard; results update as you type (all statuses, with
  live channels ranked first by the API, so an off-air channel searched by name still shows up).
- **Player** (fullscreen):
  - D-pad up/down (and CH+/CH-) = previous/next channel in the list you opened it from, wrapping around and skipping
    channels that aren't live.
  - OK shows an overlay: channel name, Now & Next from the channel's `schedule` (now, time left and next start time,
    worked out on the device clock and refreshed every 30 s), and actions: add/remove favorite, try next stream, next
    channel. Back closes the overlay, then the player.
  - Tries the channel's verified streams in order, then shows the error with "Try next channel", "Try again" and "Back".
    States: loading, playing, offline, geo-blocked, unsupported (plus "couldn't reach Tunely", closed and no stream).
  - Sends one playback report per stream attempt (`platform: "androidtv"`, result, error type, time to first frame).
  - Stops the stream when the app goes to the background and starts a fresh attempt when it comes back.
- Every element can be reached with the D-pad and shows focus clearly: cards scale to 110% with a 3 dp white ring,
  buttons invert to light, scale up and get an accent ring, the search field gets a white ring.

## Setup

Requirements: JDK 17 and the Android SDK (platform 37, `platforms;android-37.0`). Gradle comes through the wrapper.

```sh
cd apps/android-tv
# local.properties (git-ignored) points Gradle at the SDK:
#   sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk     (Windows)
#   sdk.dir=/home/<you>/Android/Sdk                           (Linux/macOS), or set ANDROID_HOME instead
./gradlew assembleDebug testDebugUnitTest lintDebug
```

The debug APK lands in `app/build/outputs/apk/debug/app-debug.apk`. Install it on a TV or emulator with
`adb install -r app/build/outputs/apk/debug/app-debug.apk`. The app only declares a `LEANBACK_LAUNCHER` entry, so on a
phone emulator start it with `adb shell am start -n app.tunely.tv/.MainActivity`.

### Scripts

| Command | What it does |
| --- | --- |
| `./gradlew assembleDebug` | Debug APK |
| `./gradlew testDebugUnitTest` | JVM unit tests (no device needed) |
| `./gradlew lintDebug` | Android lint (report in `app/build/reports/`) |
| `./gradlew assembleRelease` | Release APK, R8-minified, **unsigned** (sign it with your own keystore; no keys are in the repo) |

### Configuration (Gradle properties)

| Property | Default | Use |
| --- | --- | --- |
| `tunely.apiUrl` | `https://tunely-api-sfpe.onrender.com` | API origin baked into `BuildConfig.API_URL`. For a local API from the emulator: `./gradlew assembleDebug -Ptunely.apiUrl=http://10.0.2.2:4000` |

Release builds refuse a non-HTTPS API URL at startup. There are no secrets and no environment variables.

CI: `.github/workflows/android-tv.yml` runs the same three tasks on pushes and pull requests that touch
`apps/android-tv/**` (or the workflow itself).

## Code map

```
app/src/main/kotlin/app/tunely/tv/
  MainActivity.kt        screen stack (Home + layers opened on top of it)
  data/Models.kt         API shapes (kotlinx.serialization, every field defaulted)
  data/Safe.kt           validation of untrusted API values (ids, URLs, headers, lengths, times)
  data/TunelyApi.kt      OkHttp client, 5-min in-memory response cache, playback reports
  data/Schedule.kt       Now & Next and "time left"
  data/Library.kt        DataStore: favorites and first-use day
  player/Playback.kt     stream choice and fallback state, error classification, channel up/down
  player/Report.kt       playback report and visitor-age bucket
  player/WatchScreen.kt  ExoPlayer, key handling, overlay and state panels
  ui/                    theme tokens, shared components, Home, Browse, Search
app/src/test/            JVM tests; fixtures in resources/fixtures are real API responses (7 Nov 2026)
```

## Privacy and safety

- Video is played straight from the broadcaster's URL by ExoPlayer. Nothing is proxied, re-hosted, recorded or
  downloaded beyond what the player buffers to play.
- Only `http`/`https` URLs with a host, no whitespace or control characters and at most 2048 characters are played or
  loaded as logos (`safeUrl`). Channel ids must match `[\w.@-]{1,200}`; text is trimmed, stripped of control characters
  and length-capped; stream `Referer`/`User-Agent` values must be printable ASCII (a stream with a bad one is dropped);
  schedule entries need parseable times; responses over 4 MB are rejected.
- Playback reports carry a random session id made at app start and kept only in memory, plus the coarse visitor-age
  bucket. The first-use day stays in DataStore on the device. No device id, advertising id, account or IP is read or
  stored. `allowBackup` is off (no cloud backup); Android 12+ may still copy app data on a device-to-device transfer.
- Every request (API, logos, and streams unless iptv-org names a user agent for one) sends
  `TunelyTV/<version> (Android TV; +https://tunely-tv.vercel.app)` instead of Android's default, which includes the
  device model.
- No analytics, crash reporting, ads or Firebase. The only permission is `INTERNET`.

## Versions

Pinned exactly (latest stable on Maven Central / Google Maven on 7 Nov 2026):

| Component | Version |
| --- | --- |
| Gradle (wrapper, SHA-256 pinned) | 9.9.0 |
| Android Gradle Plugin | 9.5.1 |
| Kotlin (+ Compose compiler, serialization plugins) | 2.4.21 |
| Compose BOM | 2026.09.00 |
| androidx.tv:tv-material | 1.1.0 |
| androidx.activity:activity-compose | 1.13.0 |
| Media3 (exoplayer, exoplayer-hls) | 1.11.1 |
| DataStore preferences | 1.3.0 |
| OkHttp | 5.5.1 |
| kotlinx-serialization-json | 1.12.0 |
| Coil 3 (coil-compose, coil-network-okhttp) | 3.6.3 |
| JUnit | 4.13.2 |

compileSdk 37 (the current Compose, Coil and OkHttp releases require it), targetSdk 36, minSdk 26.

## Decisions

- **Cleartext HTTP is allowed app-wide** (`network_security_config.xml`). Many broadcasters serve streams and logos
  over plain http from hosts we can't list in advance, and we only link to them. The app's own API calls are
  HTTPS-only in release builds (checked in `TunelyApi`), and only system CAs are trusted.
- **Which streams the TV tries:** `nativePlayable && score >= 50`, in the API's order. The browser needs
  `webPlayable` (HTTPS + CORS, no special headers); ExoPlayer needs neither, so http streams and streams that need a
  `Referer` or `User-Agent` (sent as given by iptv-org) also play. All verified streams are HLS (the checker parses the
  playlist), so every stream goes through `HlsMediaSource` regardless of its URL. Unverified streams are not tried
  (the web's "Try to play" isn't ported).
- **"Live" still means the web's definition** (from the API's `status`): rails, browse grids and channel up/down use
  live channels only. A channel that is only playable over http shows as offline in the directory even though the TV
  could play it; changing that needs an API change, not a client one.
- **Error types:** HTTP 403/451 = `geo_blocked`; other HTTP errors and network failures = `offline`; Media3 decoder
  init/format errors = `unsupported_codec`; network or load timeout (10 s without playback, as on the web) =
  `timeout`; parsing/decoding/audio errors = `media`. `browser_blocked` only for a cleartext refusal, which our network
  config prevents. When every stream fails the most specific error is shown (same priority list as the web).
  "Behind live window" is not an error: the player jumps back to the live edge.
- **Time to first frame** is measured from attaching the stream to ExoPlayer's first `isPlaying = true` (the web's
  `playing` event). That also works for audio-only streams.
- **One ExoPlayer per player screen**, stopped and given a new media source on every channel change, fallback or
  retry, and released when the screen closes (the native equivalent of destroying the hls.js instance).
- **Screens are full-screen Compose `Dialog` layers over Home** instead of a navigation library. Each layer is its own
  window, so D-pad focus can't wander into the screen underneath, and Back returns to the previous screen with its
  scroll position and focused card intact. No extra dependency.
- **Favorites hold channel ids only** (newest first, up to 50, the API's `ids` limit) and the rail fetches them fresh,
  so statuses are current. Favorites that went off air still show, marked with their status.
- **Session id per app launch**, in memory only: the closest match to the web's per-tab `sessionStorage` id.
- **targetSdk 36, not 37:** Android 17's behaviour changes haven't been tested; lint's `OldTargetApi` warning is
  expected until they are.
- **A named User-Agent** for API, logo and stream requests: Wikimedia (which hosts many channel logos) answers 403 to
  OkHttp's default agent, and Android's default stream agent exposes the device model. Our health checker also uses a
  non-browser agent, so verified streams accept it. Coil shares the API's OkHttp client.
- **60 s API read timeout:** the API is on Render's free plan, which sleeps when idle and holds the first requests
  while it wakes. A shorter timeout would leave Home empty on the first launch after a quiet spell.
- **The player handles the Back key itself** (overlay first, then exit). Compose otherwise uses Back to move focus out
  of the overlay's button row, so the first press seemed to do nothing. The Categories/Languages grid avoids focus
  groups for the same reason.
- **minSdk 26** (Android 8.0): `java.time` without desugaring and adaptive icons without PNG fallbacks. Android TV
  devices older than 8.0 are rare.
- **System fonts**, not Inter: bundling fonts would add weight, and the system font already covers Indian scripts
  (Noto). Colours, 8 dp card radius and the 4 dp grid follow the CLAUDE.md tokens; the focus ring is white, as on the
  web's dark theme.
- **Banner and icon are vector drawables** (an original mark: a screen with a play button in the accent colour, and a
  monoline wordmark), so no PNGs are committed. The banner is 160x90 dp, i.e. 320x180 px at xhdpi.
- **Not ported from the web:** country rails (local/India), the hero carousel, related channels, quality/audio/caption
  pickers, continue watching, Cast/AirPlay, ads. The related endpoint isn't needed because the player is always
  opened from a list.

## Tested, and not tested

Smoke-tested on 10 Nov 2026 on an emulator (Android 15 phone image `google_apis` x86_64 with the `tv_1080p`
hardware profile; there is no TV system image on the build machine), debug and R8 release builds, against the
production API, driving it with `adb shell input keyevent` D-pad events: Home rails and logos load; D-pad moves focus
with visible scale and ring; OK on a card plays the channel fullscreen (Bloomberg TV, ABC); OK opens the overlay with
Now & Next; Back closes the overlay, then the player, returning to Home with the same card focused; Down changes to
the next channel in the rail; "Add to favorites" puts a Favorites rail first on Home; Categories → category grid →
Back works; Search opens the on-screen keyboard and results update while typing.

Not tested:

- Real Android TV hardware and remote: Google TV / leanback launcher (banner rendering, LEANBACK_LAUNCHER entry),
  the TV keyboard (Gboard for TV) in Search, CH+/CH- keys, overscan and focus visibility from a sofa.
- Error paths against real failures (geo-blocked, unsupported codec, timeout), the fallback to a second stream, and
  real TTFF numbers. That logic is unit-tested only.
- Whether playback reports are accepted by the API (they're fire-and-forget; the JSON is checked against the schema
  in unit tests).
