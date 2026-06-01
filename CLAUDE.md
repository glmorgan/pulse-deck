# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run build        # One-time build → com.glenmorgan.pulsedeck.sdPlugin/plugin.js
npm run watch        # Build and watch; rebuilds automatically on save
npm test             # Run unit tests (vitest)
npm run test:watch   # Run tests in watch mode
npx streamdeck pack com.glenmorgan.pulsedeck.sdPlugin --force  # Create distributable .streamDeckPlugin file
```

**Symlink for development:**
```bash
ln -s "$(pwd)/com.glenmorgan.pulsedeck.sdPlugin" \
  "$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/"
```

After any rebuild, restart Stream Deck to reload the plugin process.

Tests cover pure functions only (`stateEvaluator`, `history`, `timerManager`). Manual testing requires the Stream Deck app running with the plugin symlinked above.

## Architecture

Elgato Stream Deck plugin built with `@elgato/streamdeck` SDK v2. The plugin runs as a Node.js 20 process that communicates with the Stream Deck app over WebSocket.

**Entry point:** `src/plugin.ts` — registers the `HealthCheckAction`, calls `streamDeck.connect()`.

**Build output:** Rollup bundles `src/` into a single `com.glenmorgan.pulsedeck.sdPlugin/plugin.js`.

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
    popup.ts                  macOS osascript dialog for long-press history
    timerManager.ts           Per-key interval timer helpers
    iconGenerator.ts          Maps ButtonState → icon file path
```

## Action: Health Check

`HealthCheckAction` extends `SingletonAction<HealthCheckSettings>`. Per-key state is tracked in `instances: Map<actionId, KeyInstance>`.

**Key press behaviour:**
- Short press → immediate health check (ignores if check already in progress)
- Long press (>500ms) → shows history popup via `osascript`
- Auto-interval → background check on configured frequency

**Check flow:** validate config → set checking icon → fetch with AbortController timeout → compare status code → optionally check body → evaluate state → append to history → update icon and title → persist settings.

**Settings persistence:** `setSettings()` is called after every check to persist history and state. All numeric fields (`expectedStatusCode`, `timeoutMs`, `slowThresholdMs`, `amberAfterFailures`, `redAfterFailures`) are coerced to numbers in `mergeWithDefaults` because `sdpi-components` saves text field values as strings.

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
