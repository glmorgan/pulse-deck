# PulseDeck

PulseDeck is an Elgato Stream Deck plugin for monitoring HTTP health-check endpoints. It turns a key into a live service-status indicator and keeps a rolling history of response times, failures, and uptime.

Use a **Health Check** action for one endpoint or a **Health Board** to monitor up to twelve services on one key.

> PulseDeck 2.0 is currently alpha software. The native macOS window host is ad-hoc signed and is intended for local builds; packaged installs on another Mac may fall back to a browser window until the host is notarized.

## Features

- Monitor HTTP endpoints on a manual or scheduled interval
- Validate status codes and optional response-body text
- Set request timeouts, slow-response thresholds, and failure/recovery thresholds
- Send custom request headers
- View a rolling 60-check history with uptime and response-time statistics
- Monitor up to twelve endpoints from a single Health Board key
- Share defaults across board services, with per-service overrides
- Import and export board configuration as versioned JSON
- Distinct key states for healthy, slow, warning, down, checking, and configuration errors

## Requirements

- Elgato Stream Deck software 6.4 or newer
- macOS 10.15+ or Windows 10+
- Node.js 20 and npm to build from source
- macOS 12+ and the Xcode Command Line Tools to build the optional native window host

On systems where the native host is unavailable, PulseDeck opens its history and board views in a Chromium-family browser. The native host is currently macOS-only.

## Install from source

Clone the repository and install the dependencies:

```bash
git clone https://github.com/glmorgan/pulse-deck.git
cd pulse-deck
npm install
npm run build
```

On macOS, build the native window host as well:

```bash
npm run build:native
```

For local development, link the plugin directory into Stream Deck's plugin folder:

```bash
ln -s "$(pwd)/com.glenmorgan.pulsedeck.sdPlugin" \
  "$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/"
```

Restart the Stream Deck application after building or rebuilding the plugin.

To create an installable `.streamDeckPlugin` package instead, run:

```bash
npm run pack
```

## Usage

In Stream Deck, find **PulseDeck** in the actions list and drag one of its actions onto a key.

### Health Check

Configure the endpoint in the Property Inspector. At minimum, give the service a name and an HTTP or HTTPS URL. You can also configure the interval, expected status, timeout, slow threshold, response-body match, failure and recovery thresholds, and headers.

- Press the key to open its history window.
- Hold the key for more than 500 ms to run a check immediately.
- Scheduled checks run in the background at the configured interval.

### Health Board

Open the board from its key to add and arrange up to twelve services. Board defaults apply to every service unless that service overrides them.

- Press the key to open the board window.
- Hold the key for more than 500 ms to check every service immediately.
- Use the board window to edit services and import or export configuration.

Exported board files contain configuration but not runtime history. Header values are included by default and can be excluded during export.

> Request headers are stored as ordinary Stream Deck settings, not in a secrets store. Treat profiles and exported board files accordingly.

## Development

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run build` | Bundle the TypeScript plugin into `com.glenmorgan.pulsedeck.sdPlugin/plugin.js` |
| `npm run build:dev` | Build with source maps |
| `npm run build:native` | Build the universal macOS window host |
| `npm run watch` | Rebuild the plugin as source files change |
| `npm test` | Run the Vitest test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check without emitting files |
| `npm run pack` | Create a `.streamDeckPlugin` package |
| `npm run release` | Type-check, test, build, build the native host, and package |

Run both the type checker and tests before packaging:

```bash
npm run typecheck
npm test
```

## Project structure

```text
src/
  actions/       Stream Deck action lifecycle and input handling
  board/         Health Board model, window, snapshots, and file transfer
  modules/       HTTP checks, state evaluation, history, timers, and windows
  plugin.ts      Plugin entry point
native/          Swift source and build script for the macOS window host
com.glenmorgan.pulsedeck.sdPlugin/
  manifest.json  Stream Deck plugin manifest
  ui/            Property Inspector pages
  imgs/          Plugin and action artwork
  plugin.js      Generated plugin bundle
```

The plugin uses the Stream Deck SDK v2 and runs as a Node.js 20 process. Rollup produces the distributable JavaScript bundle, while the window views are served locally and protected by a random token for each invocation.

See [ROADMAP.md](ROADMAP.md) for planned work and the tradeoffs behind it.
