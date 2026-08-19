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
    healthCheckAction.ts      Health Check — lifecycle, key press, long press, timer
    healthBoardAction.ts      Health Board — rounds, key icon, the manager window's callbacks
  board/
    types.ts                  ServiceConfig, BoardDefaults, BoardSettings, runtime
    board.ts                  resolveService, mergeBoardSettings, boardCells
    boardSnapshot.ts          Everything the manager window shows, as plain data
    boardWindow.ts            The manager window's page and routes
    transfer.ts               Boards as files: export, parse, defaults, headers
  modules/
    healthChecker.ts          HTTP GET with AbortController timeout
    stateEvaluator.ts         State machine logic and config validation
    history.ts                60-check rolling history, uptime ratio, popup text
    snapshot.ts               Everything the history window shows, as plain data
    windowHost.ts             Server, token gate and host spawning, shared by both windows
    historyWindow.ts          The single-service page; embeddable inside the board
    filePanel.ts              Save and open panels, through the native host
    popup.ts                  macOS osascript dialog — the fallback when no host runs
    timerManager.ts           Per-key interval timer helpers
    iconGenerator.ts          Maps ButtonState → icon file path
    boardIcon.ts              Board key face as an SVG data URI
native/
  pulse-host.swift            Native window host (WKWebView in a non-activating NSPanel)
  build.sh                    Builds it universal and ad-hoc signs it into sdPlugin/bin/
```

## Action: Health Check

`HealthCheckAction` extends `SingletonAction<HealthCheckSettings>`. Per-key state is tracked in `instances: Map<actionId, KeyInstance>`.

**Key press behaviour** — the same on both actions, deliberately:
- Short press → opens the window (history for a key, the board for a board)
- Long press (>500ms) → checks now (every service, on a board)
- Auto-interval → background check on the configured frequency, scheduled from the *last* check
  rather than from when the key appeared — `willAppear` fires on every folder and profile change,
  and re-checking on each one wasted requests and burned slots in the 60-record window

Looking is on the short press because it is the common act and the safe one: a stray tap opens a
window rather than sending a request to somebody else's service, which on a board would be one
request per service.

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

## Boards as files

`transfer.ts` writes and reads a board. Versioned JSON (`pulsedeck: 1`), configuration only:
services and the board's defaults, never runtime. History is per machine, is most of the settings
by size, and carries timestamps and error text from somebody's infrastructure.

- **Services keep inheriting.** A file records a service's overrides and nothing else, so `null`
  still means "use the board's". Flattening the defaults onto each service at export would make
  every imported service a frozen copy of its old board, which is the opposite of what defaults
  are for.
- **The inheritance question is answered at import**, because that is the only point where both
  boards are known. `differingDefaults` compares them; when something differs the window shows a
  table and offers to keep the file's values, which `pinDefaults` writes onto the imported
  services for the differing fields only. Default is to follow the destination board.
- **Frequency cannot travel.** The board checks its services in one round, so there is nowhere on
  a service to put one. It is shown as a difference and excluded from `PINNABLE`.
- **Header values are written by default**, because an export is usually a backup or a move to
  another machine and one missing its credentials is not a backup: it imports into a board that
  fails and says nothing about why. Unticking "Include header values" writes the names with empty
  values instead, for a file going to somebody else, and the import then names what has to be
  filled in. `exportBoard` defaults the same way, so there is one default rather than two.
- **Import rebuilds each service field by field** with a fresh id, so a hand-edited file cannot
  push unknown keys into persisted settings and importing the same file twice adds twice.

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
