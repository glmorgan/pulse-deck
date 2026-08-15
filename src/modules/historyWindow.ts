import type { HistorySnapshot } from "./snapshot.js";
import { findHosts, serveWindow } from "./windowHost.js";

/**
 * A real window for the long-press history, in place of the osascript dialog.
 *
 * The shape is the one described in quick-clips/docs/native-picker.md: the plugin serves a page
 * on an ephemeral 127.0.0.1 port and spawns a native host that shows it in a WKWebView, falling
 * back to a Chromium `--app=` window and finally to the osascript dialog the caller already has.
 * The plumbing for all of that lives in `windowHost`, which the board window shares.
 *
 * The plugin never talks to the host after spawning it. The page polls this server for a fresh
 * snapshot, so a background check that lands while the window is open shows up without anything
 * being pushed to it.
 */

export type HistoryWindowOptions = {
  /** Read afresh on every poll, so the window follows the key's live state. */
  getSnapshot: () => HistorySnapshot;
  /** Runs a check on demand. Omit it and the window is read-only. */
  onRunCheck?: () => Promise<void>;
  /** Hands back a closer, so the caller can dismiss the window when its key goes away. */
  onOpen?: (close: () => void) => void;
  /** Diagnostics: host stderr, page errors, refused requests. */
  onWarn?: (message: string) => void;
  /** Abandon the window after this long *without interaction*. Polling does not count. */
  timeoutMs?: number;
  width?: number;
  height?: number;
};

/** Re-exported so callers keep importing their window's own module rather than the plumbing. */
export { findHosts };

/** Content-area size. Wide enough for 60 columns at a readable width, tall enough for both cards. */
const WINDOW_WIDTH = 900;
const WINDOW_HEIGHT = 740;
/** Fraction of leftover vertical space above the window; 0.5 is dead centre, lower sits higher. */
const VERTICAL_BIAS = 0.35;
/**
 * How long the window may sit *idle* before closing itself. Re-armed by interaction only: the
 * page's own polling would otherwise hold it open forever, which is how an orphan window happens.
 */
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
/** How often the page asks for a fresh snapshot. Fast enough to feel live, cheap enough to ignore. */
const POLL_MS = 2_000;

/**
 * Serialises data for a `<script>` block. `<` must be escaped or a `</script>` inside a body
 * snippet or an error message would end the block early.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Escapes text for an HTML text node or attribute. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Lucide's `refresh-cw`, used as published. ISC licence — https://lucide.dev
 *
 * Stroke width is 2.4 rather than the set's own 2, because the glyph is drawn for a 24px render
 * and this one is 15px; at the published weight the arcs go wispy next to a semibold label.
 * `currentColor` lets it take the button's own ink — the page background on the accent fill, the
 * muted grey while disabled.
 */
const REFRESH_SVG =
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"`
  + ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>`
  + `<path d="M21 3v5h-5"/>`
  + `<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>`
  + `<path d="M8 16H3v5"/></svg>`;

/**
 * Builds the page.
 *
 * Exported as a test seam. This is one large template literal holding HTML, CSS and the client
 * script, and a stray backtick in it ends the string early — sometimes as a compile error, and
 * sometimes as a page whose script cannot parse, which shows as a window that is simply blank
 * because the body stays hidden until the script marks it ready. `historyWindow.test.ts` parses
 * what this produces, so that is caught by `npm test` rather than by opening the window.
 *
 * Only the initial snapshot is embedded; every later render is driven by polled JSON, and all of
 * it reaches the DOM through `textContent` rather than markup.
 */
export function renderHistoryHtml(
  snapshot: HistorySnapshot,
  token: string,
  options: {
    width?: number;
    height?: number;
    canCheck: boolean;
    pollMs?: number;
    /**
     * Rendered inside another window's pane rather than as a window of its own.
     *
     * The board shows this view for a selected service, and owns the chrome around it: its own
     * header names the service and carries the controls, so this page drops its header and
     * footer and keeps the tiles, the chart and the table. It also stops trying to size a window
     * it does not own, and stops treating Escape as "close everything".
     */
    embedded?: boolean;
    /** Identifies which service the page is asking about, when embedded in a board. */
    scope?: string;
  }
): string {
  const winW = options.width ?? WINDOW_WIDTH;
  const winH = options.height ?? WINDOW_HEIGHT;
  const pollMs = options.pollMs ?? POLL_MS;

  return `<!doctype html>
<html lang="en" style="background:#333333">
<head>
<meta charset="utf-8" />
<!--
  Declared here as well as in the stylesheet: a fresh document paints its base canvas before any
  CSS is applied, which showed as a white flash each time the board swapped one service's frame
  for another. The inline background and the colour-scheme hint both land at parse time.
-->
<meta name="color-scheme" content="dark" />
<title>${escapeHtml(snapshot.serviceName)} — PulseDeck</title>
<script>
/*
 * Runs before the body is parsed, so a browser window is sized and placed ahead of first paint.
 *
 * Chrome ignores --window-size whenever it is already running, so the window opens at whatever
 * size it feels like and the chart would lay out once at that width before reflowing. The body
 * stays hidden until the resize lands; the page background is on <html>, which stays visible, so
 * the gap reads as an empty themed window rather than a white flash.
 */
(function () {
  var W = ${winW}, H = ${winH};
  var EMBEDDED = ${options.embedded ? "true" : "false"};
  var root = document.documentElement;
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.add('ready');
  }
  // The native host creates the window already sized and placed, and resizeTo() there would size
  // the *outer* frame and cost the content the height of the title bar.
  // An embedded page is a frame inside someone else's window: there is nothing to size, and
  // resizeTo would either be ignored or, worse, resize the host window around it.
  if (window.__nativeHost || EMBEDDED) { reveal(); return; }
  try {
    var chromeW = Math.max(0, window.outerWidth - window.innerWidth);
    var chromeH = Math.max(0, window.outerHeight - window.innerHeight);
    var outerW = W + chromeW, outerH = H + chromeH;
    window.resizeTo(outerW, outerH);
    // availLeft/availTop are the origin of the display this window landed on, so this centres on
    // that monitor rather than assuming the primary one.
    window.moveTo(
      Math.round((screen.availWidth - outerW) / 2) + (screen.availLeft || 0),
      Math.round((screen.availHeight - outerH) * ${VERTICAL_BIAS}) + (screen.availTop || 0)
    );
  } catch (e) {
    reveal();
  }
  // resizeTo is a request, not a synchronous change, so wait for it to land.
  window.addEventListener('resize', function onResize() {
    window.removeEventListener('resize', onResize);
    requestAnimationFrame(reveal);
  });
  setTimeout(reveal, 250);
})();
</script>
<style>
  /*
   * The Quick Clips picker's palette, verbatim, so the two windows read as the same plugin
   * family. Dark only, the same deliberate choice that page makes: these are transient panels
   * floating over the Stream Deck app, which is itself dark, and the native host pins the window
   * to .darkAqua so its title bar matches.
   */
  :root {
    color-scheme: dark;
    --bg: #333333;
    /* Translucent form of --bg so the sticky header reads as the same surface */
    --header: rgba(51,51,51,.92);
    --line: rgba(255,255,255,.08);
    --fg: #f4f4f6;
    --fg-dim: #8b8b93;
    --fg-faint: #62626b;
    --card: #262626;
    --card-line: #515151;
    --hover: rgba(255,255,255,.04);
    --kbd: rgba(255,255,255,.09);
    --shadow: 0 1px 2px rgba(0,0,0,.3);
    --shadow-lift: 0 6px 18px rgba(0,0,0,.45);
    --accent: #6d9eeb;

    /*
     * Chart marks. Response time is one series and takes the picker's own accent; slow and
     * failed are status colours, which mean a state and are never used for a series. Same three
     * hues validated earlier for colour-blind separation — this blue is a lighter step of it,
     * so it clears the darker card surface by more, not less.
     */
    --ok: var(--accent);
    --slow: #fab219;
    --fail: #d03b3b;
    --good: #4cc94c;
    --serious: #ec835a;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  /* Background lives on <html> so the window is themed even while <body> is hidden. */
  html { background: var(--bg); }
  /* Content stays hidden until the window has been sized — see the head script. */
  html:not(.ready) body { visibility: hidden; }
  body {
    margin: 0;
    font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased;
    -webkit-user-select: none; user-select: none;
    display: flex; flex-direction: column; overflow: hidden;
  }
  /* One content column with the picker's gutters, shared by every band of the window. */
  .wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 22px; }
  main {
    flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 11px;
    padding: 12px 0 13px; overflow: hidden;
  }

  /* ── header ─────────────────────────────────────────────────────────── */
  /*
   * No hairline under the header, unlike the picker's.
   *
   * That rule earns its place there because the list scrolls underneath it and the line is what
   * separates moving content from a fixed bar. Here nothing scrolls under it — the cards are the
   * separation — so it was just a line across the window.
   */
  header { flex: 0 0 auto; background: var(--header); }
  header .wrap { display: flex; align-items: center; gap: 16px; padding-top: 12px; padding-bottom: 12px; }
  .id { min-width: 0; flex: 1 1 auto; }
  h1 {
    margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .meta {
    margin: 2px 0 0; color: var(--fg-dim); font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    -webkit-user-select: text; user-select: text;
  }
  /* Status reads as a dot plus a word — the colour never carries the state on its own. */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
    color: var(--fg-dim); margin-bottom: 4px;
  }
  .dot {
    display: inline-block; flex: none;
    width: 9px; height: 9px; border-radius: 50%; background: var(--fg-faint);
  }
  .pill[data-state="healthy"] .dot { background: var(--good); }
  .pill[data-state="slow"] .dot { background: var(--slow); }
  .pill[data-state="warning"] .dot { background: var(--serious); }
  .pill[data-state="down"] .dot { background: var(--fail); }
  .pill[data-state="checking"] .dot { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .3; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none !important; } }

  /* The picker's primary button: accent fill, page colour for the label. */
  button {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--bg);
    background: var(--accent); border: 0; border-radius: 7px;
    padding: 6px 12px; cursor: pointer; flex: 0 0 auto;
    display: inline-flex; align-items: center; gap: 6px;
  }
  button:hover:not(:disabled) { filter: brightness(1.08); }
  button:disabled { background: var(--card-line); color: var(--fg-faint); cursor: default; }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* The arrow turns while a check is in flight — the button is only ever disabled then, so the
     state it animates from is exactly the one being reported. */
  button:disabled svg { animation: spin .9s linear infinite; transform-origin: 50% 50%; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { button:disabled svg { animation: none; } }

  /* ── tiles ──────────────────────────────────────────────────────────── */
  .tiles { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .tile {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 9px 13px 10px;
  }
  /*
   * The label is an h2, the same as the card headings, so the window has one heading level
   * rather than two that can drift apart. Only the ink differs: at full strength it tied with
   * the value beneath it for the eye, and in a stat tile the number has to come first. The card
   * headings can carry full strength because they are the only text on the card.
   */
  .tile .label { margin: 0; color: var(--fg-dim); }
  .tile .value {
    font-size: 24px; font-weight: 600; letter-spacing: -.02em; margin-top: 1px; color: var(--fg);
  }
  .tile .value .unit { font-size: 12px; font-weight: 500; color: var(--fg-dim); margin-left: 3px; }
  .tile .sub { font-size: 11px; color: var(--fg-faint); margin-top: 1px; }

  /* ── cards ──────────────────────────────────────────────────────────── */
  .card {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow);
    padding: 11px 14px 9px; display: flex; flex-direction: column; min-height: 0;
  }
  /* The plot is a fixed height, so the card must not be flexed down to fit the table below it —
     without this the chart collapsed to its header and the table took the whole window. */
  .chart-card { flex: 0 0 auto; }
  .card-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0; }
  .sub { font-size: 11px; color: var(--fg-faint); font-weight: 400; }
  .spacer { flex: 1; }

  .legend { display: flex; gap: 12px; font-size: 11px; color: var(--fg-dim); }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .key { display: inline-block; width: 9px; height: 9px; border-radius: 2px; }
  .key.ok { background: var(--ok); }
  .key.slow { background: var(--slow); }
  .key.fail { background: var(--fail); }
  /* The threshold rule is annotated here rather than in the plot, where its label would sit on
     top of whichever columns happen to reach that height. */
  .key.thresh {
    width: 14px; height: 0; border-radius: 0;
    border-top: 2px dashed var(--slow); align-self: center;
  }

  .plot { position: relative; height: 184px; }
  .plot svg { display: block; width: 100%; height: 100%; }
  .empty {
    display: flex; align-items: center; justify-content: center; height: 100%;
    color: var(--fg-faint); font-size: 12px;
  }

  .tip {
    position: absolute; pointer-events: none; opacity: 0; transition: opacity .08s;
    background: var(--bg); border: 1px solid var(--card-line); border-radius: 8px;
    box-shadow: var(--shadow-lift);
    padding: 7px 9px; font-size: 11.5px; line-height: 1.5; white-space: nowrap; z-index: 2;
  }
  .tip.on { opacity: 1; }
  .tip .t-head { font-weight: 600; display: flex; align-items: center; gap: 6px; color: var(--fg); }
  .tip .t-row { color: var(--fg-dim); font-variant-numeric: tabular-nums; }
  .tip .t-err { color: var(--fg-dim); max-width: 260px; white-space: normal; }

  /* ── table ──────────────────────────────────────────────────────────── */
  .table-card { flex: 1 1 auto; min-height: 0; }
  .scroll { overflow-y: auto; min-height: 0; margin: 0 -4px; padding: 0 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  /* The segmented filter, in the picker's secondary-button idiom rather than the accent one:
     these narrow a list, they do not perform the window's action. */
  .seg { display: flex; gap: 2px; }
  .seg button {
    font: inherit; font-size: 11px; font-weight: 500; color: var(--fg-dim);
    background: transparent; border: 0; border-radius: 6px;
    padding: 3px 8px; cursor: pointer;
  }
  .seg button:hover { background: var(--kbd); color: var(--fg); }
  .seg button.on { background: var(--kbd); color: var(--fg); }
  .seg button b { font-weight: 600; color: var(--fg-faint); margin-left: 2px; }
  .seg button.on b { color: var(--fg-dim); }
  /* Nothing to filter to, so the control says so by fading rather than by disappearing and
     shifting the header around it. */
  .seg button[disabled] { opacity: .4; pointer-events: none; }

  /* Column headers are buttons so sorting is reachable by keyboard, not just by click. */
  .sortbtn {
    font: inherit; font-size: 11px; font-weight: 500; color: var(--fg-faint);
    background: none; border: 0; padding: 0; cursor: pointer;
    display: inline-flex; align-items: center; gap: 3px;
  }
  .sortbtn:hover { color: var(--fg-dim); }
  .sortbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
  .sortbtn i { font-style: normal; font-size: 9px; color: var(--fg-dim); }

  /* nowrap everywhere: once the spacer takes the slack, the value columns are sized by their
     content, and a wrapping timestamp turns every row two lines tall. */
  th, td { white-space: nowrap; }
  th {
    text-align: left; font-weight: 500; color: var(--fg-faint); font-size: 11px;
    padding: 0 24px 5px 0; position: sticky; top: 0; background: var(--card);
  }
  td {
    padding: 4px 24px 4px 0; border-top: 1px solid var(--line);
    font-variant-numeric: tabular-nums; color: var(--fg-dim);
  }
  tr:hover td { background: var(--hover); }
  td.result { color: var(--fg); }
  td .res { display: inline-flex; align-items: center; gap: 6px; }
  td .res .dot { width: 7px; height: 7px; }
  td.detail {
    color: var(--fg-faint);
    /* max-width:0 with a percentage width is what lets a table cell ellipsise at all; without
       it the cell grows to fit and the text runs out of the card. */
    max-width: 0; width: 55%;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    -webkit-user-select: text; user-select: text;
  }
  /*
   * The column only exists when something has been written to it.
   *
   * Detail is empty for every passing check unless body snippets are turned on, so a healthy
   * service reserved more than half the table for a blank column and squeezed the four that had
   * values into the left edge. The class is set per render, so the column appears the moment a
   * check fails.
   */
  table:not(.has-detail) .detail { display: none; }
  /*
   * Column rhythm when there is no Detail column.
   *
   * Two failure modes to sit between: a table at width:100% spreads its slack over every column
   * and throws the four short ones into the corners of the card, while letting a spacer swallow
   * all of it crams them against the left edge. Fixed proportions give them an even rhythm over
   * about half the card, and the spacer takes only the remainder. These apply solely when Detail
   * is hidden — when it is present it is the column that should absorb the leftover width.
   */
  table:not(.has-detail) .c-time { width: 16%; }
  table:not(.has-detail) .c-result { width: 12%; }
  table:not(.has-detail) .c-code { width: 10%; }
  table:not(.has-detail) .c-resp { width: 14%; }
  table.has-detail .pad { display: none; }
  .pad { padding: 0; }
  td.blank { color: var(--fg-faint); }
  td.num, th.num { text-align: right; }

  /* ── footer ─────────────────────────────────────────────────────────── */
  /* The picker's hint strip: same height, same key chips, same muted voice. */
  footer { flex: 0 0 auto; background: var(--header); }
  footer .wrap { display: flex; align-items: center; gap: 16px; height: 38px; }
  footer span {
    display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fg-faint);
  }
  footer .keys { margin-left: auto; gap: 12px; }
  kbd {
    display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px;
    background: var(--kbd); border-radius: 4px; font: inherit; font-size: 10px; color: var(--fg-dim);
  }
${options.embedded ? `
  /*
   * Embedded, the host window owns the margins.
   *
   * These gutters exist so the page has breathing room against a window edge; inside a pane that
   * already has its own padding they are a second inset, and the tiles and chart sat short of the
   * heading above them and the button to their right. The frame is given the width it should
   * fill, so the page fills it.
   */
  .wrap { padding: 0; max-width: none; }
  main { padding: 0; }
` : ""}
</style>
</head>
<body>
${options.embedded ? "" : `<header>
  <div class="wrap">
    <div class="id">
      <span class="pill" id="pill"><span class="dot"></span><span id="pill-label"></span></span>
      <h1 id="name"></h1>
      <p class="meta" id="meta"></p>
    </div>
    ${options.canCheck
      ? `<button id="check">${REFRESH_SVG}<span id="check-label">Check now</span></button>`
      : ""}
  </div>
</header>`}

<main class="wrap">
<section class="tiles" id="tiles"></section>

<section class="card chart-card">
  <div class="card-head">
    <h2>Response time</h2>
    <span class="sub" id="chart-sub"></span>
    <span class="spacer"></span>
    <div class="legend" id="legend">
      <span><i class="key ok"></i>OK</span>
      <span><i class="key slow"></i>Slow</span>
      <span><i class="key fail"></i>Failed</span>
      <span><i class="key thresh"></i><span id="legend-thresh"></span></span>
    </div>
  </div>
  <div class="plot" id="plot">
    <div class="tip" id="tip" role="status"></div>
  </div>
</section>

<section class="card table-card">
  <div class="card-head">
    <h2>Recent checks</h2>
    <span class="sub" id="table-sub"></span>
    <span class="spacer"></span>
    <div class="seg" id="filter" role="group" aria-label="Filter checks">
      <button type="button" data-f="all">All <b></b></button>
      <button type="button" data-f="healthy">Healthy <b></b></button>
      <button type="button" data-f="slow">Slow <b></b></button>
      <button type="button" data-f="failed">Failed <b></b></button>
    </div>
  </div>
  <div class="scroll">
    <table id="checks">
      <thead><tr>
        <th class="c-time"><button type="button" class="sortbtn" data-s="time">Time<i></i></button></th>
        <th class="c-result"><button type="button" class="sortbtn" data-s="result">Result<i></i></button></th>
        <th class="c-code"><button type="button" class="sortbtn" data-s="code">Code<i></i></button></th>
        <th class="num c-resp"><button type="button" class="sortbtn" data-s="response">Response<i></i></button></th>
        <th class="detail">Detail</th><th class="pad"></th>
      </tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
</section>
</main>

${options.embedded ? "" : `<footer>
  <div class="wrap">
    <span id="foot"></span>
    <span class="keys">
      <span><kbd>R</kbd> check now</span>
      <span><kbd>esc</kbd> close</span>
    </span>
  </div>
</footer>`}

<script>
(function () {
  'use strict';
  var TOKEN = ${embedJson(token)};
  var POLL_MS = ${pollMs};
  var CAN_CHECK = ${options.canCheck ? "true" : "false"};
  var EMBEDDED = ${options.embedded ? "true" : "false"};
  /** Sent with every message so a board knows which service is asking. */
  var SCOPE = ${embedJson(options.scope ?? null)};
  var data = ${embedJson(snapshot)};

  /* Report page-side failures to the plugin log; a broken render is otherwise silent. */
  window.addEventListener('error', function (e) {
    post('error', { message: String(e.message) + ' @' + e.lineno + ':' + e.colno });
  });

  function post(type, extra) {
    var body = { type: type };
    if (SCOPE !== null) body.scope = SCOPE;
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch('/message?t=' + encodeURIComponent(TOKEN), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  /* ── formatting ──────────────────────────────────────────────────────── */

  function ms(value) {
    if (value === null || value === undefined) return '—';
    if (value >= 10000) return (value / 1000).toFixed(1) + ' s';
    return value + ' ms';
  }

  function clockOf(iso) {
    var d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function dayOf(iso) {
    var d = new Date(iso);
    var today = new Date();
    if (d.toDateString() === today.toDateString()) return '';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function agoOf(iso) {
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
    return Math.round(seconds / 86400) + 'd ago';
  }

  /** OK, over the slow threshold, or failed — the only three the chart and table distinguish. */
  function kindOf(check) {
    if (!check.ok) return 'fail';
    if (check.responseTimeMs > data.slowThresholdMs) return 'slow';
    return 'ok';
  }

  var KIND_LABEL = { ok: 'OK', slow: 'Slow', fail: 'Failed' };

  function detailOf(check) {
    if (check.error) return check.error;
    if (check.bodySnippet) return check.bodySnippet;
    if (check.ok) return '';
    return 'Unexpected response';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /* ── header, tiles, table ────────────────────────────────────────────── */

  function paintHeader() {
    // Embedded, the board owns the header and the footer; there is nothing here to paint.
    if (EMBEDDED) return;
    document.getElementById('name').textContent = data.serviceName;
    var pill = document.getElementById('pill');
    pill.setAttribute('data-state', data.state);
    document.getElementById('pill-label').textContent = data.stateLabel;

    var meta = data.endpointUrl || 'No endpoint configured';
    meta += ' · ' + data.checkFrequency;
    if (data.lastCheckedAt) meta += ' · checked ' + agoOf(data.lastCheckedAt);
    document.getElementById('meta').textContent = meta;

    var foot = 'Expects HTTP ' + data.expectedStatusCode
      + ' · timeout ' + ms(data.timeoutMs)
      + ' · slow over ' + ms(data.slowThresholdMs);
    document.getElementById('foot').textContent = foot;
  }

  function tile(label, value, unit, sub) {
    var node = el('div', 'tile');
    node.appendChild(el('h2', 'label', label));
    var v = el('div', 'value', value);
    if (unit) v.appendChild(el('span', 'unit', unit));
    node.appendChild(v);
    node.appendChild(el('div', 'sub', sub));
    return node;
  }

  function paintTiles() {
    var s = data.stats;
    var tiles = document.getElementById('tiles');
    tiles.textContent = '';

    tiles.appendChild(tile(
      'Uptime',
      s.uptimePct === null ? '—' : String(s.uptimePct),
      s.uptimePct === null ? '' : '%',
      s.total ? s.ok + ' of ' + s.total + ' checks' : 'no checks yet'
    ));
    tiles.appendChild(tile(
      'Median response',
      s.median === null ? '—' : String(s.median),
      s.median === null ? '' : 'ms',
      s.latencySamples ? 'across ' + s.latencySamples + ' successful' : 'no successful checks'
    ));
    tiles.appendChild(tile(
      'Slow responses',
      s.total ? String(s.overThreshold) : '—',
      '',
      s.total ? 'over ' + ms(data.slowThresholdMs)
              + (s.slowest === null ? '' : ' · slowest ' + ms(s.slowest))
              : 'no checks yet'
    ));
    tiles.appendChild(tile(
      'Failures in a row',
      String(data.consecutiveFailures),
      '',
      s.failed + ' failed in this window'
    ));
  }

  /*
   * Which rows to show and in what order.
   *
   * Held here rather than read back off the DOM, because the table is rebuilt from scratch every
   * time a check lands — anything kept in the markup would be reset by the next poll.
   */
  var filter = 'all';
  var sortKey = 'time';
  var sortDir = -1;  // -1 newest/slowest first, 1 the other way

  /** Severity order, so ascending reads healthy → slow → failed. */
  var KIND_RANK = { ok: 0, slow: 1, fail: 2 };

  var SORT_LABEL = {
    'time:-1': 'newest first', 'time:1': 'oldest first',
    'response:-1': 'slowest first', 'response:1': 'fastest first',
    'result:-1': 'failures first', 'result:1': 'healthy first',
    'code:-1': 'highest status first', 'code:1': 'lowest status first'
  };

  var EMPTY_FOR = {
    all: 'Nothing recorded yet.',
    healthy: 'No healthy checks in this window.',
    slow: 'No slow responses in this window.',
    failed: 'No failures in this window.'
  };

  function valueFor(check, key) {
    if (key === 'time') return new Date(check.timestamp).getTime();
    if (key === 'response') return check.responseTimeMs;
    if (key === 'result') return KIND_RANK[kindOf(check)];
    return check.statusCode;  // may be null — see the comparator
  }

  function compare(a, b) {
    var x = valueFor(a, sortKey), y = valueFor(b, sortKey);
    // A failure with no status code sorts to the bottom whichever way the column points:
    // "no answer" is not a low number, and floating it to the top would bury the codes.
    if (x === null && y === null) x = y = 0;
    else if (x === null) return 1;
    else if (y === null) return -1;
    if (x !== y) return (x < y ? -1 : 1) * sortDir;
    // Stable within ties, and newest-first is the order to fall back to.
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }

  function paintFilter() {
    var counts = { all: data.checks.length, healthy: 0, slow: 0, failed: 0 };
    for (var i = 0; i < data.checks.length; i++) {
      var kind = kindOf(data.checks[i]);
      if (kind === 'ok') counts.healthy++;
      else if (kind === 'slow') counts.slow++;
      else counts.failed++;
    }
    var buttons = document.getElementById('filter').children;
    for (var b = 0; b < buttons.length; b++) {
      var name = buttons[b].getAttribute('data-f');
      buttons[b].classList.toggle('on', name === filter);
      buttons[b].querySelector('b').textContent = String(counts[name]);
      // Never disable the filter currently in force, or there is no way back out of it.
      buttons[b].disabled = counts[name] === 0 && name !== filter;
    }
  }

  function paintSortIndicators() {
    var heads = document.querySelectorAll('.sortbtn');
    for (var i = 0; i < heads.length; i++) {
      var key = heads[i].getAttribute('data-s');
      var active = key === sortKey;
      heads[i].querySelector('i').textContent = active ? (sortDir === 1 ? '↑' : '↓') : '';
      heads[i].parentNode.setAttribute('aria-sort',
        active ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
    }
  }

  function paintTable() {
    var rows = document.getElementById('rows');
    var scroller = document.querySelector('.scroll');
    /*
     * Emptying the tbody collapses the scroller, which drops scrollTop to 0 — so a check landing
     * while you were reading older rows yanked the list back to the top. Captured before the
     * rebuild and restored after it.
     */
    var scrollTop = scroller ? scroller.scrollTop : 0;
    rows.textContent = '';

    paintFilter();
    paintSortIndicators();

    var recent = data.checks.filter(function (check) {
      if (filter === 'all') return true;
      var kind = kindOf(check);
      return filter === 'healthy' ? kind === 'ok'
           : filter === 'slow' ? kind === 'slow'
           : kind === 'fail';
    }).sort(compare);

    var sub = recent.length ? (SORT_LABEL[sortKey + ':' + sortDir] || '') : '';
    if (filter !== 'all' && recent.length) {
      sub = recent.length + ' of ' + data.checks.length + ' · ' + sub;
    }
    document.getElementById('table-sub').textContent = sub;

    // Reserve the Detail column only when a row on screen has something to put in it.
    var anyDetail = false;
    for (var d = 0; d < recent.length; d++) {
      if (detailOf(recent[d])) { anyDetail = true; break; }
    }
    document.getElementById('checks').classList.toggle('has-detail', anyDetail);

    if (!recent.length) {
      var blank = document.createElement('tr');
      // Not class "detail" — that column is hidden when empty, which is exactly this case, and
      // the placeholder would have gone with it.
      var cell = el('td', 'blank', EMPTY_FOR[filter]);
      cell.colSpan = 6;
      blank.appendChild(cell);
      rows.appendChild(blank);
      return;
    }

    for (var i = 0; i < recent.length; i++) {
      var check = recent[i];
      var kind = kindOf(check);
      var tr = document.createElement('tr');

      var day = dayOf(check.timestamp);
      tr.appendChild(el('td', 'c-time', (day ? day + ' ' : '') + clockOf(check.timestamp)));

      var result = el('td', 'result c-result');
      var res = el('span', 'res');
      var dot = el('i', 'dot');
      dot.style.background = 'var(--' + kind + ')';
      res.appendChild(dot);
      res.appendChild(el('span', null, KIND_LABEL[kind]));
      result.appendChild(res);
      tr.appendChild(result);

      tr.appendChild(el('td', 'c-code', check.statusCode === null ? '—' : String(check.statusCode)));
      tr.appendChild(el('td', 'num c-resp', ms(check.responseTimeMs)));
      var detail = el('td', 'detail', detailOf(check));
      detail.title = detailOf(check);
      tr.appendChild(detail);
      tr.appendChild(el('td', 'pad'));

      rows.appendChild(tr);
    }

    if (scroller) scroller.scrollTop = scrollTop;
  }

  (function bindTableControls() {
    document.getElementById('filter').addEventListener('click', function (e) {
      var button = e.target.closest('button[data-f]');
      if (!button) return;
      filter = button.getAttribute('data-f');
      paintTable();
    });

    document.querySelector('thead').addEventListener('click', function (e) {
      var button = e.target.closest('.sortbtn');
      if (!button) return;
      var key = button.getAttribute('data-s');
      // Same column flips direction; a new column starts at the way round that reads first for
      // it — newest, slowest, worst — since that is what anyone clicking it is looking for.
      if (key === sortKey) sortDir = -sortDir;
      else { sortKey = key; sortDir = -1; }
      paintTable();
    });
  })();

  /* ── chart ───────────────────────────────────────────────────────────── */

  // Left pad holds the widest tick label, which carries the unit — "1000 ms" clipped at 46.
  var PAD_L = 58, PAD_R = 14, PAD_T = 10, PAD_B = 20;
  var MAX_BAR = 24, GAP = 2, RADIUS = 4;
  /**
   * The chart always draws the same number of slots the history holds at most, and fills them
   * from the right.
   *
   * Scaling the columns to however many checks exist made seven of them 24px wide and 100px
   * apart, floating in the middle of the plot. Fixed slots keep a column the same width from the
   * first check onwards, and the empty left-hand side honestly says the window is not full yet.
   */
  var SLOTS = 60;

  /** Rounds an axis maximum up to a clean 1/2/5 x 10^n, so ticks read as round numbers. */
  function niceMax(value) {
    if (!(value > 0)) return 100;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var scaled = value / magnitude;
    var step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
    return step * magnitude;
  }

  /** A column with a rounded data-end and square feet at the baseline. */
  function barPath(x, y, w, base) {
    var h = base - y;
    var r = Math.min(RADIUS, w / 2, h);
    if (h <= 0) return '';
    if (r <= 0.5) return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'Z';
    return 'M' + x + ' ' + base
      + 'V' + (y + r)
      + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r)
      + 'h' + (w - 2 * r)
      + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r
      + 'V' + base + 'Z';
  }

  var geometry = null;  // kept for hit-testing on hover

  function paintChart() {
    var host = document.getElementById('plot');
    var tip = document.getElementById('tip');
    var old = host.querySelector('svg');
    if (old) host.removeChild(old);
    var oldEmpty = host.querySelector('.empty');
    if (oldEmpty) host.removeChild(oldEmpty);

    var checks = data.checks;
    document.getElementById('legend-thresh').textContent = 'slow over ' + ms(data.slowThresholdMs);
    document.getElementById('legend').style.visibility = checks.length ? 'visible' : 'hidden';
    if (!checks.length) {
      geometry = null;
      tip.classList.remove('on');
      var note = el('div', 'empty', CAN_CHECK
        ? 'No checks yet — press Check now to run one.'
        : 'No checks yet.');
      host.appendChild(note);
      document.getElementById('chart-sub').textContent = '';
      return;
    }

    var W = host.clientWidth || ${winW - 64};
    var H = host.clientHeight || 184;
    var plotW = W - PAD_L - PAD_R;
    var plotH = H - PAD_T - PAD_B;
    var base = PAD_T + plotH;

    var oks = [];
    for (var i = 0; i < checks.length; i++) if (checks[i].ok) oks.push(checks[i].responseTimeMs);
    // The threshold is part of the scale so its line is always on screen, even when every check
    // came back far below it.
    var top = niceMax(Math.max(oks.length ? Math.max.apply(null, oks) : 0, data.slowThresholdMs));
    var slots = Math.max(checks.length, SLOTS);
    var band = plotW / slots;
    var barW = Math.max(2, Math.min(MAX_BAR, band - GAP));
    // Newest against the right edge, so the newest check is always in the same place.
    var offset = slots - checks.length;

    function yOf(value) { return PAD_T + plotH - (Math.min(value, top) / top) * plotH; }

    var svg = '';
    // Colours go in a style attribute, never a presentation attribute: var() is substituted for
    // CSS declarations only, so fill="var(--ok)" renders as black.
    var TICK_TEXT = 'style="fill:var(--fg-dim);font-variant-numeric:tabular-nums" font-size="10"';
    var LABEL_TEXT = 'style="fill:var(--fg-dim)" font-size="10"';

    // Gridlines: solid hairlines one step off the surface, carrying the values the columns are
    // not directly labelled with.
    var ticks = [0, 0.25, 0.5, 0.75, 1];
    for (var t = 0; t < ticks.length; t++) {
      var value = top * ticks[t];
      var y = yOf(value);
      svg += '<line x1="' + PAD_L + '" y1="' + y + '" x2="' + (W - PAD_R) + '" y2="' + y
        + '" style="stroke:var(--' + (ticks[t] === 0 ? 'card-line' : 'line') + ');stroke-width:1" />';
      // The unit rides the top tick rather than a separate label, which collided with it. Long
      // axes go to thousands so the label cannot outgrow the left pad.
      var tick = value >= 10000 ? Math.round(value / 1000) + 'k' : String(Math.round(value));
      svg += '<text x="' + (PAD_L - 8) + '" y="' + (y + 4) + '" text-anchor="end" ' + TICK_TEXT
        + '>' + tick + (ticks[t] === 1 ? ' ms' : '') + '</text>';
    }

    // The slow threshold. Dashed, because it is a threshold and not a gridline. Its value is
    // named in the legend, where no column can ever be drawn over the words.
    var ty = yOf(data.slowThresholdMs);
    svg += '<line x1="' + PAD_L + '" y1="' + ty + '" x2="' + (W - PAD_R) + '" y2="' + ty
      + '" style="stroke:var(--slow);stroke-width:1.25;stroke-dasharray:4 4;opacity:.75" />';

    // Hover cursor sits behind the columns so it never tints them.
    svg += '<rect id="cursor" x="0" y="' + PAD_T + '" width="0" height="' + plotH
      + '" style="fill:var(--hover)" rx="3" />';

    for (var c = 0; c < checks.length; c++) {
      var check = checks[c];
      var x = PAD_L + (offset + c) * band + (band - barW) / 2;
      var kind = kindOf(check);
      if (kind === 'fail') {
        /*
         * A failure has no response time worth plotting — a refused connection comes back in
         * three milliseconds, which as a column would read as the fastest check on the chart. So
         * it is drawn filled to full height instead.
         *
         * That carries the meaning on its own: it is the only mark that ever reaches the top, so
         * the cue survives greyscale, forced-colors and any colour blindness, and the legend and
         * the table's Failed label do the naming. An earlier version outlined the column and put
         * a cross at the cap — both were needed to make a hollow rectangle read as a failure
         * rather than as a gap, and both became noise once it was filled.
         */
        svg += '<rect x="' + x + '" y="' + PAD_T + '" width="' + barW + '" height="' + plotH
          + '" rx="2" style="fill:var(--fail)" />';
      } else {
        var y = yOf(check.responseTimeMs);
        svg += '<path d="' + barPath(x, y, barW, base) + '" style="fill:var(--' + kind + ')" />';
      }
    }

    // Selective x labels: the ends of the window, which is what orients the reader. Everything
    // else is one hover or one table row away.
    // Under the first column it belongs to, not at the axis origin, which on a part-full window
    // would put the oldest check's time a long way from the oldest check. Dropped entirely when
    // the two ends are close enough for the labels to overlap — a handful of checks span a few
    // minutes, and two times printed over each other are worse than one.
    var firstX = PAD_L + offset * band;
    if ((W - PAD_R) - firstX > 150) {
      svg += '<text x="' + firstX + '" y="' + (H - 5) + '" ' + LABEL_TEXT + '>'
        + clockOf(checks[0].timestamp) + '</text>';
    }
    svg += '<text x="' + (W - PAD_R) + '" y="' + (H - 5) + '" text-anchor="end" ' + LABEL_TEXT
      + '>' + clockOf(checks[checks.length - 1].timestamp) + '</text>';

    var node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label',
      'Response time of the last ' + checks.length + ' checks. '
      + 'Full values are listed in the recent checks table below.');
    node.innerHTML = svg;
    host.insertBefore(node, tip);

    geometry = { band: band, count: checks.length, offset: offset, left: PAD_L, W: W };
    document.getElementById('chart-sub').textContent =
      'last ' + checks.length + (checks.length === 1 ? ' check' : ' checks');
  }

  /* ── hover ───────────────────────────────────────────────────────────── */

  function indexAt(clientX) {
    var host = document.getElementById('plot');
    if (!geometry) return -1;
    var rect = host.getBoundingClientRect();
    // The SVG is stretched to the element's box, so page pixels and viewBox units differ.
    var scale = geometry.W / rect.width;
    var x = (clientX - rect.left) * scale;
    if (x < geometry.left || x > geometry.W) return -1;
    // Empty slots on the left of a part-full window answer -1 rather than the oldest check.
    var index = Math.floor((x - geometry.left) / geometry.band) - geometry.offset;
    return index >= 0 && index < geometry.count ? index : -1;
  }

  function showTip(index, clientX) {
    var host = document.getElementById('plot');
    var tip = document.getElementById('tip');
    var cursor = host.querySelector('#cursor');
    var check = data.checks[index];
    if (!check) return hideTip();

    var kind = kindOf(check);
    tip.textContent = '';
    var head = el('div', 't-head');
    var dot = el('i', 'dot');
    dot.style.background = 'var(--' + kind + ')';
    dot.style.width = '8px'; dot.style.height = '8px'; dot.style.borderRadius = '50%';
    dot.style.display = 'inline-block';
    head.appendChild(dot);
    var day = dayOf(check.timestamp);
    head.appendChild(el('span', null, KIND_LABEL[kind] + ' · ' + (day ? day + ' ' : '') + clockOf(check.timestamp)));
    tip.appendChild(head);
    tip.appendChild(el('div', 't-row',
      (check.statusCode === null ? 'no response' : 'HTTP ' + check.statusCode)
      + ' · ' + ms(check.responseTimeMs)));
    var detail = detailOf(check);
    if (detail) tip.appendChild(el('div', 't-err', detail));

    if (cursor) {
      cursor.setAttribute('x', String(geometry.left + (geometry.offset + index) * geometry.band));
      cursor.setAttribute('width', String(geometry.band));
    }

    tip.classList.add('on');
    var rect = host.getBoundingClientRect();
    var x = clientX - rect.left;
    var width = tip.offsetWidth;
    // Keep it inside the plot rather than letting it spill past the card edge.
    tip.style.left = Math.max(0, Math.min(x - width / 2, rect.width - width)) + 'px';
    tip.style.top = '6px';
  }

  function hideTip() {
    var tip = document.getElementById('tip');
    tip.classList.remove('on');
    var cursor = document.querySelector('#cursor');
    if (cursor) cursor.setAttribute('width', '0');
  }

  /** Where the pointer last was over the plot, so a repaint can re-resolve what it points at. */
  var hoverX = null;

  (function bindHover() {
    var host = document.getElementById('plot');
    host.addEventListener('mousemove', function (e) {
      hoverX = e.clientX;
      var index = indexAt(e.clientX);
      if (index < 0) return hideTip();
      showTip(index, e.clientX);
    });
    host.addEventListener('mouseleave', function () {
      hoverX = null;
      hideTip();
    });
  })();

  /**
   * Puts the tooltip back over whatever is now under the pointer.
   *
   * The chart's SVG is replaced wholesale on every repaint, so an open tooltip was left showing
   * the previous render's text — and pointing at a column that had shifted, since a new check
   * moves every one of them left by a slot. Re-resolving from the pointer position rather than
   * from the old index is what keeps it honest.
   */
  function restoreTip() {
    if (hoverX === null || !document.getElementById('tip').classList.contains('on')) return;
    var index = indexAt(hoverX);
    if (index < 0) hideTip();
    else showTip(index, hoverX);
  }

  /* ── painting and refresh ────────────────────────────────────────────── */

  function paint() {
    paintHeader();
    paintTiles();
    paintChart();
    paintTable();
    restoreTip();
  }

  /**
   * What a repaint is worth doing for.
   *
   * The snapshot is rebuilt on every poll, so it always differs by its own timestamp. Repainting
   * on that alone would rebuild the table twice a second underneath the cursor and drop any
   * text selection with it.
   */
  function signature(d) {
    return [d.state, d.lastCheckedAt, d.checks.length, d.consecutiveFailures,
            d.serviceName, d.endpointUrl, d.slowThresholdMs, d.stats.ok].join('|');
  }
  var lastSignature = signature(data);

  function apply(next) {
    if (!next) return;
    var changed = signature(next) !== lastSignature;
    data = next;
    lastSignature = signature(next);
    if (changed) paint();
    else paintHeader();  // the relative "checked 40s ago" still moves on
  }

  var checking = false;
  function runCheck() {
    if (!CAN_CHECK || checking) return;
    checking = true;
    var button = document.getElementById('check');
    // The label is its own element: setting textContent on the button would take the icon with
    // it, and it would not come back.
    var label = document.getElementById('check-label');
    if (button) { button.disabled = true; label.textContent = 'Checking…'; }
    post('check').then(function (reply) {
      apply(reply.data);
    }).then(function () {
      checking = false;
      if (button) { button.disabled = false; label.textContent = 'Check now'; }
    });
  }

  if (CAN_CHECK) {
    document.getElementById('check').addEventListener('click', runCheck);
  }

  document.addEventListener('keydown', function (e) {
    // Embedded, closing is the host window's business: this page's Escape would otherwise
    // shut the whole board.
    if (e.key === 'Escape' && !EMBEDDED) { post('close'); window.close(); return; }
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) runCheck();
  });

  /*
   * Two separate clocks.
   *
   * Polling must not hold the window open, or the idle timeout can never fire and a forgotten
   * window lives forever. So the poll is a plain read, and only real interaction pings.
   */
  setInterval(function () {
    if (checking) return;
    post('poll').then(function (reply) { apply(reply.data); });
  }, POLL_MS);

  var lastPing = 0;
  function touch() {
    var now = Date.now();
    if (now - lastPing < 5000) return;
    lastPing = now;
    post('ping');
  }
  document.addEventListener('keydown', touch, true);
  document.addEventListener('pointerdown', touch, true);
  document.addEventListener('wheel', touch, true);

  // Same reasoning: an embedded frame unloads whenever the selection changes, which must not
  // be reported as the window closing.
  if (!EMBEDDED) {
    window.addEventListener('beforeunload', function () { post('close'); });
  }
  window.addEventListener('resize', function () { paintChart(); });

  paint();
})();
</script>
</body>
</html>`;
}

/**
 * Shows the history window and resolves when it closes.
 *
 * The server, the token gate, the host spawn and the launch/close distinction all live in
 * `windowHost`; what is left here is the page and the two messages this window has of its own.
 */
export async function showHistoryWindow(
  hostPath: string,
  options: HistoryWindowOptions
): Promise<void> {
  return serveWindow(hostPath, {
    width: options.width ?? WINDOW_WIDTH,
    height: options.height ?? WINDOW_HEIGHT,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    onWarn: options.onWarn,
    onOpen: options.onOpen,
    renderPage: (token) =>
      renderHistoryHtml(options.getSnapshot(), token, {
        width: options.width ?? WINDOW_WIDTH,
        height: options.height ?? WINDOW_HEIGHT,
        canCheck: !!options.onRunCheck,
      }),
    onMessage: async (message) => {
      // A read, deliberately not an interaction: see the page's comment about the two clocks.
      if (message.type === "poll") return { data: options.getSnapshot() };

      if (message.type === "check") {
        const run = options.onRunCheck;
        if (run) {
          try {
            await run();
          } catch (error: unknown) {
            // The window stays up and shows whatever the key holds; a failed manual check is
            // already visible as the key's state.
            options.onWarn?.(`history window check failed: ${
              error instanceof Error ? error.message : String(error)}`);
          }
        }
        return { data: options.getSnapshot() };
      }

      return {};
    },
  });
}
