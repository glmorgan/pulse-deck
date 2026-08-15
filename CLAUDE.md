# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run build        # One-time build → com.glenmorgan.pulsedeck.sdPlugin/plugin.js
npm run build:native # Build the history window host → …sdPlugin/bin/pulse-host (macOS, universal)
npm run watch        # Build and watch; rebuilds automatically on save
npm test             # Run unit tests (vitest)
npm run test:watch   # Run tests in watch mode
npm run typecheck    # tsc --noEmit — rollup emits a bundle despite type errors, so run this too
npm run pack         # Create the distributable .streamDeckPlugin file
npm run release      # typecheck → test → build → build:native → pack
```

**Symlink for development:**
```bash
ln -s "$(pwd)/com.glenmorgan.pulsedeck.sdPlugin" \
  "$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/"
```

After any rebuild, restart Stream Deck to reload the plugin process.

Tests cover pure functions (`stateEvaluator`, `history`, `timerManager`, `snapshot`) plus the history window's page, which is parsed rather than opened — see "History window" below. Manual testing requires the Stream Deck app running with the plugin symlinked above.

## Architecture

Elgato Stream Deck plugin built with `@elgato/streamdeck` SDK v2. The plugin runs as a Node.js 20 process that communicates with the Stream Deck app over WebSocket.

**Entry point:** `src/plugin.ts` — registers the `HealthCheckAction`, calls `streamDeck.connect()`.

**Build output:** Rollup bundles `src/` into a single `com.glenmorgan.pulsedeck.sdPlugin/plugin.js`.
`native/build.sh` adds `com.glenmorgan.pulsedeck.sdPlugin/bin/pulse-host`, which a plain
`npm run build` does not produce — hence the browser fallback below.

**Plugin ID:** `com.glenmorgan.pulsedeck`

## Source files

```
src/
  plugin.ts                   Entry point
  types.ts                    Shared types, ButtonState, HealthCheckSettings, defaults
  actions/
    healthCheckAction.ts      Main action — lifecycle, key press, long press, timer
  modules/
    healthChecker.ts          HTTP GET with AbortController timeout
    stateEvaluator.ts         State machine logic and config validation
    history.ts                60-check rolling history, uptime ratio, popup text
    snapshot.ts               Everything the history window shows, as plain data
    historyWindow.ts          Local HTTP server, the window's page, host spawning
    popup.ts                  macOS osascript dialog — the fallback when no host runs
    timerManager.ts           Per-key interval timer helpers
    iconGenerator.ts          Maps ButtonState → icon file path
native/
  pulse-host.swift            Native window host (WKWebView in a non-activating NSPanel)
  build.sh                    Builds it universal and ad-hoc signs it into sdPlugin/bin/
```

## Action: Health Check

`HealthCheckAction` extends `SingletonAction<HealthCheckSettings>`. Per-key state is tracked in `instances: Map<actionId, KeyInstance>`.

**Key press behaviour:**
- Short press → immediate health check (ignores if check already in progress)
- Long press (>500ms) → opens the history window (see below)
- Auto-interval → background check on configured frequency

**Check flow:** validate config → set checking icon → fetch with AbortController timeout → compare status code → optionally check body → evaluate state → append to history → update icon and title → persist settings.

**Settings persistence:** `setSettings()` is called after every check to persist history and state. All numeric fields (`expectedStatusCode`, `timeoutMs`, `slowThresholdMs`, `amberAfterFailures`, `redAfterFailures`) are coerced to numbers in `mergeWithDefaults` because `sdpi-components` saves text field values as strings.

## History window

A long press opens a real window instead of an `osascript` dialog. The shape follows
`quick-clips/docs/native-picker.md`, which is the reference for anything that goes wrong here:

```
plugin ──▶ HTTP server on 127.0.0.1:0 ──▶ native host (WKWebView) shows the page
   ▲                                              │
   └──────── page polls /message for a snapshot ──┘
```

- **Hosts, in order:** `bin/pulse-host`, then any Chromium-family browser, then the osascript
  dialog. `findHosts()` returns them all because a host can be present yet unlaunchable (a
  quarantined unsigned binary is the usual case), so `openHistory` works down the list. `streamdeck
  pack` stores no permission bits, so a packed install's host arrives without its exec bit and
  `findHosts` restores it with `chmod 0755` before giving up.
- **Security:** a random per-invocation token gates every route before any routing; refused
  requests are 403. The server exposes only the page and `/message`, and the page reaches the DOM
  through `textContent`, never markup.
- **Two clocks:** the page polls every 2s for a fresh snapshot, which deliberately does *not*
  re-arm the idle timeout — only real interaction pings. Polling that re-armed it would keep a
  forgotten window alive forever.
- **The page is one template literal.** A stray backtick ends it early and the window then opens
  completely blank, because the body stays hidden until the script marks it ready. `renderHistoryHtml`
  is exported so `historyWindow.test.ts` can `new Function()` every script block it emits; run
  `npm run typecheck` too, since rollup emits a bundle despite type errors.
- **Chart encoding:** response time is one series (the accent blue); slow and failed are status
  colours. Failures are drawn *filled to full height* rather than as a short column — a connection
  refused in 3ms would otherwise read as the fastest check on the chart — and being the only mark
  that reaches the top is a cue that survives greyscale. The columns fill 60 fixed slots from the
  right, so a column keeps its width as history accumulates. The table under the chart is its
  accessible twin: every value is there.
- **Palette:** the Quick Clips picker's tokens verbatim (`--bg #333333`, `--card #262626`,
  `--card-line #515151`, accent `#6d9eeb`), so the two windows read as one plugin. Dark only, and
  the native host pins the window to `.darkAqua` to match. Do not reintroduce a light mode without
  re-validating the chart colours against the new surface.
- **Table:** filter (All / Healthy / Slow / Failed, with counts) and sortable columns. Both states
  live in page variables, never in the DOM, because the table is rebuilt from scratch on every
  poll. The Detail column is hidden unless a visible row has text — it is empty for every passing
  check unless body snippets are on — and a spacer column absorbs the leftover width so the value
  columns keep their rhythm either way.
- **Stat tiles:** uptime, median, slow-response count and consecutive failures. Deliberately *not*
  a 95th percentile: over 60 spot checks, nearest-rank p95 is the third-slowest reading and on a
  young history it is simply the slowest, which the tile already showed underneath it.

## Button states

| State | Icon | Condition |
|-------|------|-----------|
| `unknown` | config | No check run yet or no URL configured |
| `checking` | loading | Request in progress |
| `healthy` | success | Check passed, response under slow threshold |
| `slow` | warn | Check passed, response over slow threshold |
| `warning` | warn | Latest check failed, below red threshold |
| `down` | failure | Consecutive failures ≥ red threshold |
| `config-error` | config | Missing or invalid URL |

## Property Inspector

`com.glenmorgan.pulsedeck.sdPlugin/ui/index.html` — uses `sdpi-components.js` v4 web components. Each field uses a `setting=` attribute to automatically bind to Stream Deck settings. No custom WebSocket or JS required.

## Icons

File-based PNGs in `com.glenmorgan.pulsedeck.sdPlugin/imgs/`. The SDK resolves `@2x` variants automatically on Retina displays.

```
imgs/plugin/
  marketplace.png / @2x      Plugin icon (288×288 / 576×576)
  category.png / @2x         Category icon
imgs/actions/healthcheck/
  success.png / @2x          Healthy state
  warn.png / @2x             Slow and Warning states
  failure.png / @2x          Down state
  loading.png / @2x          Checking state
  config.png / @2x           Unknown and Config Error states
  action.svg                 Fallback action icon
```
