import { findHosts, serveWindow } from "../modules/windowHost.js";
import type { HistorySnapshot } from "../modules/snapshot.js";
import type { BoardOverview } from "./boardSnapshot.js";
import type { BoardDefaults, ServiceConfig } from "./types.js";

/**
 * The board manager window: the list of services on the left, and whatever is selected on the
 * right. Configuration lives here rather than in the Property Inspector, which holds one button.
 *
 * Shares its plumbing with the history window through `windowHost`, and its palette and furniture
 * with the Quick Clips picker, so all three read as one plugin.
 *
 * **Stage 3 of the board work:** the shell, the list, and the All overview. Selecting a service
 * shows a summary and says the full view is coming; add, edit, delete, reordering and board
 * settings are stage 5.
 */

export type BoardWindowOptions = {
  /** Read afresh on every poll, so the window follows the board's live state. */
  getOverview: () => BoardOverview;
  /** Runs a round of checks across every service. */
  onCheckAll?: () => Promise<void>;
  /** Checks one service, for the button beside a selected service's name. */
  onCheckService?: (id: string) => Promise<void>;
  /**
   * The full single-service view, as a page to embed.
   *
   * Returns the very page the history window serves, in embedded mode: the tiles, chart and
   * table are one implementation used by both windows rather than two that drift. Null for an id
   * this board does not have, which the route turns into a 404 rather than rendering something.
   */
  getServicePage?: (id: string, token: string) => string | null;
  /**
   * One service's full snapshot, for the embedded view's own polling.
   *
   * The frame speaks the history window's protocol — the same page, so the same messages — and
   * tags every one with its service id. Without this the frame's poll would be answered with the
   * board overview, which is not the shape it expects.
   */
  getServiceSnapshot?: (id: string) => HistorySnapshot | null;

  /**
   * Mutations. Each one throws to explain why it could not happen, which the window shows in the
   * form rather than closing it — losing a half-typed service to a failed save would be worse
   * than an inline message.
   */
  onAddService?: (draft: ServiceDraft) => Promise<string>;
  onUpdateService?: (id: string, draft: ServiceDraft) => Promise<void>;
  onDeleteService?: (id: string) => Promise<void>;
  /** Restores the last deleted service and returns its id, so the window can select it again. */
  onUndoDelete?: () => Promise<string>;
  onMoveService?: (id: string, delta: number) => Promise<void>;
  onUpdateBoard?: (update: BoardUpdate) => Promise<void>;
  onOpen?: (close: () => void) => void;
  onWarn?: (message: string) => void;
  timeoutMs?: number;
  width?: number;
  height?: number;
};

/** What the add and edit forms send. Everything but name and URL may be null, meaning inherit. */
export type ServiceDraft = Omit<ServiceConfig, "id">;

export type BoardUpdate = {
  boardName?: string;
  defaults?: Partial<BoardDefaults>;
};

/** Wider than the history window: the same content, plus a list rail beside it. */
const WINDOW_WIDTH = 1080;
/**
 * Four rows of cards already fit here, which is a full board at three across.
 *
 * This was briefly raised to 900 on the assumption that the fourth row would not fit. Measured on
 * a real eleven-service board instead: four rows and their gaps are about 613px, the header above
 * the grid about 72px and the footer about 30px, so roughly 715 of the 740. Raising it bought
 * nothing and left 215px of empty space under the last row. Leave it alone without measuring.
 */
const WINDOW_HEIGHT = 740;
const VERTICAL_BIAS = 0.35;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const POLL_MS = 2_000;

export { findHosts };

/** Serialises for a `<script>` block; `<` must be escaped or a `</script>` inside data ends it. */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lucide `refresh-cw`, ISC — the same mark the history window's Check now button carries. */
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
 * Exported as a test seam, for the same reason the history window's is: this is one large
 * template literal, and a stray backtick in it produces a page whose script cannot parse, which
 * shows as a window that opens completely blank.
 */
export function renderBoardHtml(
  overview: BoardOverview,
  token: string,
  options: { width?: number; height?: number; pollMs?: number } = {}
): string {
  const winW = options.width ?? WINDOW_WIDTH;
  const winH = options.height ?? WINDOW_HEIGHT;
  const pollMs = options.pollMs ?? POLL_MS;

  return `<!doctype html>
<html lang="en" style="background:#333333">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="dark" />
<title>${escapeHtml(overview.boardName)} — PulseDeck</title>
<script>
/* Sizes and places a browser window ahead of first paint; the native host needs none of it. */
(function () {
  var W = ${winW}, H = ${winH};
  var root = document.documentElement;
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    root.classList.add('ready');
  }
  if (window.__nativeHost) { reveal(); return; }
  try {
    var chromeW = Math.max(0, window.outerWidth - window.innerWidth);
    var chromeH = Math.max(0, window.outerHeight - window.innerHeight);
    var outerW = W + chromeW, outerH = H + chromeH;
    window.resizeTo(outerW, outerH);
    window.moveTo(
      Math.round((screen.availWidth - outerW) / 2) + (screen.availLeft || 0),
      Math.round((screen.availHeight - outerH) * ${VERTICAL_BIAS}) + (screen.availTop || 0)
    );
  } catch (e) {
    reveal();
  }
  window.addEventListener('resize', function onResize() {
    window.removeEventListener('resize', onResize);
    requestAnimationFrame(reveal);
  });
  setTimeout(reveal, 250);
})();
</script>
<style>
  /* The Quick Clips picker's palette, as the history window uses. */
  :root {
    color-scheme: dark;
    --bg: #333333;
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

    --ok: var(--accent);
    --good: #4cc94c;
    /* The healthy card's edge: --good at about 45% over the window, so it reads as green without
       eight of them competing with the two that are red. */
    --good-line: #3e763e;
    /*
     * Slow, warning and down are three points on one continuum, so they are separated on two
     * axes rather than one.
     *
     * The first attempt put warning at #e07a2c, which read as a shade of the amber next to it:
     * 15 degrees of hue apart and, measured, the same lightness to within a point and a half.
     * Hue alone cannot carry yellow, orange and red — pushing them apart on the wheel only walks
     * each one into its neighbour.
     *
     * So slow moved toward a true yellow and up in lightness, warning moved toward red and down
     * in lightness. That is about 25 degrees of hue and 11 points of lightness between them, and
     * warning now sits darker than both of its neighbours, which is a cue of its own.
     */
    --slow: #f0cc35;
    --warn: #d1621b;
    --fail: #d03b3b;
  }

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  html { background: var(--bg); }
  html:not(.ready) body { visibility: hidden; }
  body {
    margin: 0;
    font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    background: var(--bg); color: var(--fg);
    -webkit-font-smoothing: antialiased;
    -webkit-user-select: none; user-select: none;
    display: flex; overflow: hidden;
  }

  /* ── rail ───────────────────────────────────────────────────────────── */
  .rail {
    flex: 0 0 236px; display: flex; flex-direction: column; min-height: 0;
    padding: 16px 12px 12px 16px; gap: 10px;
    /*
     * min-width:0 is what makes the basis binding.
     *
     * A flex item defaults to min-width:auto, which means "never narrower than my content" — and
     * the rows inside are nowrap, so a long service name has no minimum at all. The rail grew to
     * fit the longest name and stole the width from the pane beside it, rather than the name
     * truncating. Every ellipsis below depends on this line.
     */
    min-width: 0;
  }
  .board-name {
    font-size: 15px; font-weight: 600; letter-spacing: -.015em; margin: 0 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .board-sub { font-size: 11px; color: var(--fg-faint); margin: 2px 4px 0; }
  .list { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .row {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 7px 9px; border-radius: 8px; border: 0; background: transparent;
    color: var(--fg); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer;
  }
  .row:hover { background: var(--hover); }
  .row.on { background: var(--kbd); }
  .row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .row .label { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .count { font-size: 11px; color: var(--fg-faint); font-variant-numeric: tabular-nums; }
  .dot {
    display: inline-block; flex: none;
    width: 9px; height: 9px; border-radius: 50%; background: var(--fg-faint);
  }
  .dot[data-state="healthy"] { background: var(--good); }
  .dot[data-state="slow"] { background: var(--slow); }
  .dot[data-state="warning"] { background: var(--warn); }
  .dot[data-state="down"] { background: var(--fail); }
  .rail-foot { display: flex; flex-direction: column; gap: 2px; }
  .row.muted { color: var(--fg-dim); }

  /* ── detail ─────────────────────────────────────────────────────────── */
  main {
    flex: 1 1 auto; min-width: 0; min-height: 0;
    display: flex; flex-direction: column; padding: 16px 18px 12px 8px; gap: 12px;
  }
  .head { display: flex; align-items: center; gap: 14px; }
  .head .titles { flex: 1 1 auto; min-width: 0; }
  h1 {
    margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.015em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .head .sub {
    font-size: 12px; color: var(--fg-dim); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    /* Selectable so a URL can be copied out of it, as it is on the history window's own header. */
    -webkit-user-select: text; user-select: text;
  }
  button.primary {
    font: inherit; font-size: 12px; font-weight: 600; color: var(--bg);
    background: var(--accent); border: 0; border-radius: 7px;
    padding: 6px 12px; cursor: pointer; flex: 0 0 auto;
    display: inline-flex; align-items: center; gap: 6px;
  }
  button.primary:hover:not(:disabled) { filter: brightness(1.08); }
  button.primary:disabled { background: var(--card-line); color: var(--fg-faint); cursor: default; }
  button.primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.primary:disabled svg { animation: spin .9s linear infinite; transform-origin: 50% 50%; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { button.primary:disabled svg { animation: none; } }

  .frame { flex: 1 1 auto; min-height: 0; display: flex; position: relative; }
  /*
   * The incoming frame loads underneath the outgoing one.
   *
   * A fresh document paints its own canvas white before its stylesheet applies, and no colour on
   * the iframe element can cover that — the flash is inside the frame, not behind it. So the new
   * one is laid over the old at zero opacity and only swapped in once it has loaded, which means
   * the pane is never showing a document mid-paint.
   */
  iframe.loading { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
  .grid {
    flex: 1 1 auto; min-height: 0; overflow-y: auto;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; align-content: start;
  }
  .cardbtn {
    text-align: left; font: inherit; color: var(--fg); cursor: pointer;
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 11px 13px 10px;
    display: flex; flex-direction: column; gap: 3px; min-width: 0;
    /*
     * A floor, not a fixed height, and the whole of it is spent on the gap above the footing,
     * because margin-top:auto is what absorbs the slack.
     *
     * The card's own content comes to about 134. At 148 the four rows plus their gaps overran the
     * pane by a few pixels and the grid took a scrollbar, which cost more height again. 140 keeps
     * a little air above the rule and leaves four rows about twenty pixels clear. Set here rather
     * than as grid-auto-rows so a board of five gets the same card as a board of twelve instead
     * of three enormous ones.
     */
    min-height: 140px;
  }
  .cardbtn:hover { background: var(--hover); }
  .cardbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .cardbtn .name {
    font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cardbtn .state { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--fg-dim); }
  .cardbtn .figure {
    font-size: 20px; font-weight: 600; letter-spacing: -.02em; margin-top: 1px;
  }
  .cardbtn .figure .unit { font-size: 11px; font-weight: 500; color: var(--fg-dim); margin-left: 3px; }
  /*
   * The footing sits at the bottom of the card, not under the figure.
   *
   * margin-top:auto is what spends the height rather than padding it: the state and the figure
   * stay at the top where they are read first, the three figures line up across the whole grid,
   * and the space between them is the card breathing instead of a gap left over.
   */
  .cardbtn .stats {
    margin-top: auto; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.07);
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  }
  .cardbtn .stat { min-width: 0; }
  .cardbtn .stat .k {
    font-size: 9.5px; letter-spacing: .07em; text-transform: uppercase; color: var(--fg-faint);
  }
  .cardbtn .stat .v {
    font-size: 13px; font-weight: 600; color: var(--fg-dim); font-variant-numeric: tabular-nums;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cardbtn .stat .v .u { font-size: 10px; font-weight: 500; color: var(--fg-faint); margin-left: 2px; }
  /*
   * Every state carries its colour, but not at the same volume.
   *
   * Healthy was deliberately left grey while the cards still had sparklines: colouring all of
   * them made a wall of green, and the eye had to find the one that differed by hue alone. Taking
   * the sparklines out took most of the colour with them, and a view where nothing is coloured
   * asks you to read every card to learn that everything is fine.
   *
   * So healthy gets a green edge at about half the strength of the others, and only the
   * exceptions tint their face. Trouble still wins on brightness and on fill, which is two
   * channels against one.
   */
  .cardbtn[data-state="healthy"] { border-color: var(--good-line); }
  .cardbtn[data-state="slow"] { border-color: var(--slow); }
  /*
   * Warning is its own colour here, and shares red with down on the key face.
   *
   * That is not an inconsistency to tidy up later. The key collapses them because a cell is about
   * 14px and a fifth hue between amber and red is guesswork at that size, worse for anyone
   * red/green colourblind. A card is 240px wide with the word "Warning" written on it, so the
   * colour is confirming a label rather than carrying the whole message alone.
   *
   * Warning keeps the tinted face, because it is a failure: the difference from down is that it
   * has not yet failed enough times in a row to be believed. So hue separates them and fill still
   * marks both as trouble, which is what keeps the pair apart from slow.
   */
  .cardbtn[data-state="warning"] { border-color: var(--warn); background: #2f2a20; }
  .cardbtn[data-state="warning"]:hover { background: #363023; }
  /*
   * A configuration error keeps the default grey, with never-checked and mid-check.
   *
   * It was red, which made it the only state whose colour described the service rather than what
   * the checker found — nothing is wrong with the endpoint, we never asked it anything. Red also
   * put it in the same bucket as a real outage on a board where the outage is what you are
   * looking for. The key face already drew it grey, so this is the window catching up.
   */
  .cardbtn[data-state="down"] { border-color: var(--fail); background: #2f2323; }
  .cardbtn[data-state="down"]:hover { background: #352626; }
  .cardbtn svg { display: block; width: 100%; height: 26px; margin-top: 4px; }

  .empty {
    flex: 1 1 auto; display: flex; align-items: center; justify-content: center;
    color: var(--fg-faint); font-size: 12px; text-align: center; padding: 30px;
  }
  /*
   * The selected service's view is the history window's own page in a frame.
   *
   * A frame rather than a copy of its markup: the chart, the tooltip, the filter and the sort are
   * a few hundred lines that are already written and tested, and a second implementation of them
   * would drift within a week. It is same-origin, so it shares nothing but the server.
   */
  iframe {
    flex: 1 1 auto; min-height: 0; width: 100%;
    border: 0; border-radius: 11px;
    /* The element's own colour, so the gap between one document unloading and the next painting
       is the page colour rather than the browser's white canvas. */
    background: var(--bg); color-scheme: dark;
  }
  .panel {
    background: var(--card); border: 2px solid var(--card-line); border-radius: 11px;
    box-shadow: var(--shadow); padding: 13px 15px 12px;
  }
  .panel h2 { font-size: 13px; font-weight: 600; margin: 0 0 6px; }
  .panel p { margin: 0 0 4px; color: var(--fg-dim); font-size: 12px; }
  .panel .url { color: var(--fg-faint); -webkit-user-select: text; user-select: text; }

  /* ── forms ──────────────────────────────────────────────────────────── */
  .form { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding-right: 4px; }
  /*
   * Three fixed columns, not a flex row.
   *
   * As flex, the hint sat after the input and took whatever width its text needed, so the input
   * ended wherever that text began: "shown on the card and in the list" made the Name box narrow
   * and "board: 1" made Amber after wide. Every input in a form was a different length, for a
   * reason that had nothing to do with what goes in it. A fixed hint column ends that.
   */
  .field {
    display: grid; grid-template-columns: 132px minmax(0, 1fr) 196px;
    align-items: center; gap: 12px; margin-bottom: 9px;
  }
  .field label { font-size: 12px; color: var(--fg-dim); text-align: right; }
  .field input[type="text"], .field select {
    width: 100%; min-width: 0; font: inherit; font-size: 12.5px; color: var(--fg);
    background: var(--card); border: 1px solid var(--card-line); border-radius: 7px;
    padding: 6px 9px; outline: none;
  }
  .field input:focus, .field select:focus { border-color: var(--accent); }
  .field .hint { font-size: 11px; color: var(--fg-faint); }
  /* The checkbox row keeps the old flex, because its hint is a sentence that belongs beside the
     box rather than in the narrow column the other hints share. */
  .field.check { display: flex; align-items: center; gap: 12px; }
  .field.check label { flex: 0 0 132px; }
  .field.check input { margin: 0; }

  /*
   * The numbers go in a grid of their own.
   *
   * Six of them each took a full row to hold three digits, which made the overrides section as
   * tall as the rest of the form put together and left a 500px box for the value 200. Three
   * across turns six rows into two, and a fixed column means all six are the same width as each
   * other whatever their label or hint says.
   *
   * Indented to 144px so the column starts where every other input in the form starts.
   */
  /*
   * The row exists so the grid inside it lands in the input column exactly.
   *
   * Indenting by a matching 144px got the left edge right and left the right edge 20px past every
   * other input, because three fixed columns plus their gaps do not add up to a column sized by
   * what is left over. Reusing the same three-column track and placing the grid in the second one
   * makes both edges follow the form instead of being guessed at.
   */
  .numrow {
    display: grid; grid-template-columns: 132px minmax(0, 1fr) 196px;
    gap: 12px; margin-bottom: 4px;
  }
  .numgrid {
    grid-column: 2;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 14px;
  }
  .numgrid .field { display: block; margin: 0; }
  .numgrid .field label { display: block; text-align: left; margin-bottom: 4px; }
  .numgrid .field input[type="text"] { width: 100%; }
  .numgrid .field .hint { display: block; margin-top: 4px; }
  details { margin: 14px 0 4px; }
  summary {
    cursor: pointer; font-size: 12px; color: var(--fg-dim); margin-bottom: 10px;
    padding-left: 132px;
  }
  summary:hover { color: var(--fg); }
  .form-actions {
    display: flex; align-items: center; gap: 8px; margin: 16px 0 4px;
    padding-left: 144px; padding-right: 208px;
  }
  /* Delete sits away from Cancel. Adjacent, the destructive button is one slip from the one you
     press to back out, and they are the two you reach for in the same frame of mind. */
  .form-actions .danger { margin-left: auto; }
  button.ghost {
    font: inherit; font-size: 12px; color: var(--fg-dim);
    background: transparent; border: 1px solid var(--card-line); border-radius: 7px;
    padding: 6px 12px; cursor: pointer;
  }
  button.ghost:hover { background: var(--kbd); color: var(--fg); }
  button.ghost.danger:hover { color: var(--fail); }
  button.ghost:focus-visible, button.primary:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  .error { color: #ff8080; font-size: 11.5px; padding-left: 144px; min-height: 15px; }

  /* A notice, in the footer's line rather than over the content it is about. */
  .notice { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--fg-dim); }
  .notice button {
    font: inherit; font-size: 11px; color: var(--accent);
    background: transparent; border: 0; padding: 0; cursor: pointer; text-decoration: underline;
  }

  /*
   * Reordering lives on the row, because the row's order is what it changes.
   *
   * Hidden with visibility rather than display, so the controls keep their box and the row does
   * not change size as the pointer crosses it — the label would otherwise reflow and the whole
   * list would twitch as you moved down it.
   */
  .row .moves { display: flex; visibility: hidden; gap: 1px; flex: 0 0 auto; }
  .row:hover .moves, .row.on .moves { visibility: visible; }
  .row .moves span {
    width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center;
    color: var(--fg-faint); font-size: 9px;
  }
  .row .moves span:hover { background: var(--kbd); color: var(--fg); }
  .row .moves span.off { opacity: .25; pointer-events: none; }

  footer { flex: 0 0 auto; display: flex; align-items: center; gap: 16px; height: 30px; }
  footer span { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--fg-faint); }
  footer .keys { margin-left: auto; gap: 12px; }
  kbd {
    display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px;
    background: var(--kbd); border-radius: 4px; font: inherit; font-size: 10px; color: var(--fg-dim);
  }
</style>
</head>
<body>
<nav class="rail">
  <div>
    <h2 class="board-name" id="board-name"></h2>
    <p class="board-sub" id="board-sub"></p>
  </div>
  <div class="list" id="list"></div>
  <div class="rail-foot">
    <button type="button" class="row muted" id="add"><span class="label">Add service</span></button>
    <button type="button" class="row muted" id="settings"><span class="label">Board settings</span></button>
  </div>
</nav>

<main>
  <div class="head">
    <div class="titles">
      <h1 id="title"></h1>
      <div class="sub" id="subtitle"></div>
    </div>
    <button type="button" class="ghost" id="edit" hidden>Edit</button>
    <button type="button" class="primary" id="check">${REFRESH_SVG}<span id="check-label">Check all</span></button>
  </div>
  <div id="detail" class="grid"></div>
  <footer>
    <span id="foot"></span>
    <span class="notice" id="notice" hidden></span>
    <span class="keys"><span><kbd>esc</kbd> close</span></span>
  </footer>
</main>

<script>
(function () {
  'use strict';
  var TOKEN = ${embedJson(token)};
  var POLL_MS = ${pollMs};
  var data = ${embedJson(overview)};
  /** null means the All view; otherwise the id of the selected service. */
  var selected = null;
  /** 'list' shows the selection; the others are the forms, which sit over it. */
  var view = 'list';

  window.addEventListener('error', function (e) {
    post('error', { message: String(e.message) + ' @' + e.lineno + ':' + e.colno });
  });

  function post(type, extra) {
    var body = { type: type };
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch('/message?t=' + encodeURIComponent(TOKEN), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).catch(function () { return {}; });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function ms(value) {
    if (value === null || value === undefined) return '—';
    if (value >= 10000) return (value / 1000).toFixed(1) + ' s';
    return value + ' ms';
  }

  /** One figure in a card's footing: the label above it, matching the service view's tiles. */
  function statCell(label, value, unit) {
    var cell = el('div', 'stat');
    cell.appendChild(el('div', 'k', label));
    var v = el('div', 'v', String(value));
    if (unit && value !== '—') v.appendChild(el('span', 'u', unit));
    cell.appendChild(v);
    return cell;
  }

  /** The most recent check on the board, which is when the last round landed. */
  function newestCheck(services) {
    var newest = null;
    for (var i = 0; i < services.length; i++) {
      var at = services[i].lastCheckedAt;
      if (at && (newest === null || new Date(at).getTime() > new Date(newest).getTime())) newest = at;
    }
    return newest;
  }

  function agoOf(iso) {
    if (!iso) return 'never checked';
    var seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.round(seconds / 3600) + 'h ago';
    return Math.round(seconds / 86400) + 'd ago';
  }

  function serviceById(id) {
    for (var i = 0; i < data.services.length; i++) {
      if (data.services[i].id === id) return data.services[i];
    }
    return null;
  }

  /* ── rail ────────────────────────────────────────────────────────────── */

  function paintRail() {
    document.getElementById('board-name').textContent = data.boardName;
    var sub = data.total === 0 ? 'no services yet'
      : data.total + (data.total === 1 ? ' service · ' : ' services · ') + data.frequency;
    document.getElementById('board-sub').textContent = sub;

    var add = document.getElementById('add');
    add.disabled = data.total >= data.capacity;
    add.querySelector('.label').textContent =
      data.total >= data.capacity ? 'Board full (' + data.capacity + ')' : 'Add service';

    var list = document.getElementById('list');
    list.textContent = '';

    var all = el('button', 'row' + (selected === null ? ' on' : ''));
    all.type = 'button';
    all.appendChild(el('span', 'label', 'All services'));
    all.appendChild(el('span', 'count', String(data.total)));
    all.addEventListener('click', function () { select(null); });
    list.appendChild(all);

    for (var i = 0; i < data.services.length; i++) {
      (function (service, index) {
        var row = el('button', 'row' + (selected === service.id ? ' on' : ''));
        row.type = 'button';
        var dot = el('i', 'dot');
        dot.setAttribute('data-state', service.state);
        row.appendChild(dot);
        var label = el('span', 'label', service.name);
        // Truncation hides text, so the whole name stays available on hover.
        label.title = service.name;
        row.appendChild(label);

        /*
         * Up and down live on the row because the row's position is what they change, and that
         * position is the cell the service occupies on the key — top-left is the first row.
         */
        var moves = el('span', 'moves');
        moves.appendChild(moveControl('\u25B2', service.id, -1, index === 0));
        moves.appendChild(moveControl('\u25BC', service.id, 1, index === data.services.length - 1));
        row.appendChild(moves);

        row.addEventListener('click', function () { select(service.id); });
        list.appendChild(row);
      })(data.services[i], i);
    }
  }

  /*
   * The header line, refreshed on its own because one part of it moves without the data moving.
   *
   * "checked 42s ago" is a clock, and apply() repaints only when the board's signature changes,
   * so between two checks a minute apart the clock sat still and then jumped a minute. Putting
   * the elapsed time into the signature instead would force a full repaint every few seconds
   * purely to retype a string, and would fight the guard that stops an open form being rebuilt.
   */
  function paintSummary() {
    document.getElementById('title').textContent = 'All services';
    var parts = [];
    if (data.total === 0) parts.push('nothing configured yet');
    else {
      // Counted, not inferred. This was total minus failing, which called a slow service healthy
      // and slow at once, so a board of eleven read "9 of 11 healthy · 1 slow · 2 failing".
      parts.push(data.healthy + ' of ' + data.total + ' healthy');
      if (data.slow) parts.push(data.slow + ' slow');
      if (data.failing) parts.push(data.failing + ' failing');
      // Said separately, or a service with no URL would be counted nowhere and show as a grey
      // card the summary never mentions.
      if (data.misconfigured) parts.push(data.misconfigured + ' not configured');
    }
    // One clock for the board, because there is one round.
    var freshest = newestCheck(data.services);
    if (freshest) parts.push('checked ' + agoOf(freshest));
    document.getElementById('subtitle').textContent = parts.join(' · ');
  }

  function moveControl(glyph, id, delta, disabled) {
    var control = el('span', disabled ? 'off' : '', glyph);
    control.setAttribute('role', 'button');
    control.title = delta < 0 ? 'Move up' : 'Move down';
    control.addEventListener('click', function (e) {
      // The row is a button and a click on the control would select it as well.
      e.stopPropagation();
      if (disabled) return;
      post('move-service', { id: id, delta: delta }).then(refresh);
    });
    return control;
  }

  /* ── sparkline ───────────────────────────────────────────────────────── */

  /**
   * One card's response times. Failures are drawn as full-height marks rather than as their
   * elapsed time, the same rule the history chart follows: a refused connection returns in
   * three milliseconds and would otherwise read as the fastest check on the card.
   */
  function sparkSvg(points) {
    if (!points.length) return '';
    var W = 160, H = 26, gap = 1.5;
    var band = W / points.length;
    var barW = Math.max(1.2, band - gap);
    var top = 0;
    for (var i = 0; i < points.length; i++) {
      if (points[i].state !== 'fail' && points[i].ms > top) top = points[i].ms;
    }
    if (top <= 0) top = 1;
    var svg = '';
    for (var j = 0; j < points.length; j++) {
      var x = j * band;
      var point = points[j];
      var failed = point.state === 'fail';
      var h = failed ? H : Math.max(1.5, (Math.min(point.ms, top) / top) * (H - 2));
      var y = H - h;
      // The same three colours the chart and the key use, so a bar means the same thing wherever
      // it appears: a slow check is amber here as well as on the card's own state line.
      var fill = failed ? 'var(--fail)' : point.state === 'slow' ? 'var(--slow)' : 'var(--ok)';
      svg += '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barW.toFixed(2)
        + '" height="' + h.toFixed(2) + '" rx="1" style="fill:' + fill + '" />';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">'
      + svg + '</svg>';
  }

  /* ── detail ──────────────────────────────────────────────────────────── */

  function paintAll() {
    document.getElementById('edit').hidden = true;
    var detail = document.getElementById('detail');
    detail.className = 'grid';
    detail.textContent = '';

    paintSummary();

    if (!data.services.length) {
      var note = el('div', 'empty',
        'No services on this board yet. Add them from the key\\u2019s Property Inspector for now — '
        + 'adding them here is the next piece of work.');
      detail.className = '';
      detail.appendChild(note);
      return;
    }

    for (var i = 0; i < data.services.length; i++) {
      (function (service) {
        var card = el('button', 'cardbtn');
        card.type = 'button';
        card.title = service.name;
        card.appendChild(el('div', 'name', service.name));

        var state = el('div', 'state');
        var dot = el('i', 'dot');
        dot.setAttribute('data-state', service.state);
        state.appendChild(dot);
        /*
         * No timestamp on the card.
         *
         * It appeared only when a service was more than fifteen seconds behind the newest check,
         * which is a rule nobody can see: from the outside some cards carry a time and others do
         * not, for no reason the window ever states. And it was a relative time on a view that
         * repaints only when the data changes, so it sat frozen between checks. The board's one
         * clock is in the header, where it now ticks.
         */
        state.appendChild(el('span', null, service.stateLabel));
        card.appendChild(state);

        // Config error is not here: it has no failures to count, having never been checked, so it
        // takes the latency branch below and shows a dash like anything else with no reading.
        var failing = service.state === 'down' || service.state === 'warning';
        var figure;
        if (failing && service.consecutiveFailures > 0) {
          // A failing service's latency is the time it took to fail, which is not a number worth
          // leading with. How many checks in a row have failed is.
          figure = el('div', 'figure', String(service.consecutiveFailures));
          figure.appendChild(el('span', 'unit',
            service.consecutiveFailures === 1 ? 'failure' : 'failures in a row'));
        } else {
          figure = el('div', 'figure',
            service.lastResponseTimeMs === null ? '—' : String(service.lastResponseTimeMs));
          if (service.lastResponseTimeMs !== null) figure.appendChild(el('span', 'unit', 'ms'));
        }
        card.appendChild(figure);

        card.setAttribute('data-state', service.state);

        /*
         * The meta line says only what deviates.
         *
         * "100% up" is six identical lines on a healthy board and says nothing; below 100 it is
         * often the most interesting thing on the card, which is how a service reading Healthy at
         * 67% up gets noticed. The timestamp moved to the header, because one round means one
         * clock, and it comes back per card only when this service is out of step with the round
         * — which is a real fault worth showing, not the timer ticking.
         */
        /*
         * The footing: three figures over the same window of checks, on every card.
         *
         * Uptime is here unconditionally. Hiding it at 100% was a mistake worth recording: it
         * saved a line on the cards that needed no attention and took the figure away from the
         * ones that did, because a reader cannot tell "100%" from "not shown" without knowing the
         * rule. A column of percentages is also comparable down the grid, which a column of
         * sometimes-percentages is not.
         *
         * Median is what gives the big number meaning. 1193ms means something different against a
         * median of 240 than against a median of 1150, and the card could not say which.
         */
        var stats = el('div', 'stats');
        stats.appendChild(statCell('uptime',
          service.uptimePct === null ? '—' : service.uptimePct + '%'));
        stats.appendChild(statCell('median',
          service.medianMs === null ? '—' : service.medianMs, 'ms'));
        stats.appendChild(statCell(service.slowChecks ? 'slow' : 'checks',
          service.slowChecks ? service.slowChecks + '/' + service.checks : service.checks));
        card.appendChild(stats);

        /*
         * The reason lives on hover, not on the card.
         *
         * As a line of its own it only appeared on failing cards, so those cards grew taller than
         * the rest and the row stopped reading as a grid — the layout moved to tell you something
         * the colour had already said. The service view is where the reason belongs in full.
         */
        if (service.lastError) card.title = service.name + ' — ' + service.lastError;

        /*
         * No sparkline here. It was the heaviest ink on the view and the least readable thing on
         * it: twenty-four bars in a 239px card is a texture, and the two things you can sense
         * from it — whether there is red in it, and whether it is spiky — are already on the card
         * as the uptime percentage and the state. What it adds over those is the *shape* of a
         * failure, flapping against hard-down, and that is what the service view is for, at a size
         * where it can be read and with the table underneath it. Eleven services put 264 marks on
         * screen to say something the numbers had already said.
         */

        card.addEventListener('click', function () { select(service.id); });
        detail.appendChild(card);
      })(data.services[i]);
    }
  }

  function paintService(id) {
    var service = serviceById(id);
    if (!service) return select(null);

    var title = document.getElementById('title');
    title.textContent = service.name;
    title.title = service.name;
    // The endpoint belongs in the header, as it is on a Health Check key: the name is whatever
    // someone typed, and the URL is the thing actually being checked.
    var subtitle = document.getElementById('subtitle');
    subtitle.textContent = service.stateLabel
      + ' · ' + (service.url || 'No URL configured')
      + ' · checked ' + agoOf(service.lastCheckedAt);
    subtitle.title = service.url;
    document.getElementById('edit').hidden = false;

    var detail = document.getElementById('detail');
    detail.className = 'frame';

    /*
     * Only rebuilt when the selection changes.
     *
     * The frame keeps its own state — scroll position, table filter, sort, an open tooltip — and
     * replacing it on every two-second poll would reset all of it under the cursor. It polls the
     * same server itself, so it stays current without being touched.
     */
    /*
     * Anything that is not a frame belongs to the view we are leaving — the card grid, or a form
     * — and goes now. Only frames survive this, because a frame is what the swap below is
     * comparing against; clearing them here would defeat the point of loading behind the old one.
     */
    var children = Array.prototype.slice.call(detail.children);
    for (var c = 0; c < children.length; c++) {
      if (children[c].tagName !== 'IFRAME') detail.removeChild(children[c]);
    }

    var current = detail.querySelector('iframe:not(.loading)');
    if (current && current.getAttribute('data-id') === id) return;

    /*
     * The incoming frame loads underneath the outgoing one, and they swap on load.
     *
     * A fresh document paints its own canvas before its stylesheet applies, which showed as a
     * white flash on every switch — no colour on the iframe element can cover that, because the
     * flash is inside the frame rather than behind it. Loading it at zero opacity over the top of
     * the previous one means the pane is never showing a document mid-paint.
     */
    var pending = detail.querySelector('iframe.loading');
    if (pending) detail.removeChild(pending);

    var next = document.createElement('iframe');
    next.className = 'loading';
    next.setAttribute('data-id', id);
    next.setAttribute('title', service.name);
    next.src = '/service?id=' + encodeURIComponent(id) + '&t=' + encodeURIComponent(TOKEN);

    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      next.className = '';
      if (current && current.parentNode) current.parentNode.removeChild(current);
    }
    next.addEventListener('load', swap);
    // If load never arrives, show it anyway rather than leaving the previous service on screen
    // under the new service's name.
    setTimeout(swap, 1500);
    detail.appendChild(next);
  }

  /* ── forms ───────────────────────────────────────────────────────────── */

  /*
   * What each setting does, on hover.
   *
   * These are the fields nobody can infer from a label: "Amber after" says nothing about what
   * happens below the threshold, and "Healthy after" is meaningless without knowing it counts
   * successes rather than checks. The alternative was a line of prose under every input, which is
   * six lines of text to answer a question asked once.
   */
  var TIPS = {
    expectedStatusCode: 'The HTTP status a check must return to count as a pass.',
    timeoutMs: 'How long to wait for a response before the check counts as failed.',
    slowThresholdMs: 'A check that passes but takes longer than this is Slow rather than Healthy.',
    amberAfterFailures: 'Consecutive failures before the service turns Warning. Below this, a '
      + 'failure leaves the state alone.',
    redAfterFailures: 'Consecutive failures before the service turns Down.',
    recoverAfterSuccesses: 'Consecutive successes before a failing service is believed again. '
      + '1 recovers on the first passing check.',
    expectedBodyContains: 'Text the response body must contain. Blank skips the body check.'
  };

  function field(label, hint) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('label', null, label));
    var input = document.createElement('input');
    input.type = 'text';
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el('span', 'hint', hint));
    return { wrap: wrap, input: input };
  }

  function selectField(label, options, value) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('label', null, label));
    var select = document.createElement('select');
    for (var i = 0; i < options.length; i++) {
      var option = document.createElement('option');
      option.value = options[i][0];
      option.textContent = options[i][1];
      if (options[i][0] === value) option.selected = true;
      select.appendChild(option);
    }
    wrap.appendChild(select);
    return { wrap: wrap, input: select };
  }

  function checkField(label, text, checked) {
    var wrap = el('div', 'field check');
    wrap.appendChild(el('label', null, label));
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    wrap.appendChild(input);
    wrap.appendChild(el('span', 'hint', text));
    return { wrap: wrap, input: input };
  }

  /** Blank means inherit, so an override reads as a number or as nothing at all. */
  function overrideValue(raw) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (text === '') return null;
    var value = Number(text);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function configById(id) {
    for (var i = 0; i < data.configs.length; i++) {
      if (data.configs[i].id === id) return data.configs[i];
    }
    return null;
  }

  /**
   * The add and edit form.
   *
   * Overrides are collapsed behind a disclosure and show the board's value as a placeholder, so
   * an empty field reads as "whatever the board says" rather than as unset. That is the whole
   * point of shared defaults: a board should not carry twelve copies of the same timeout.
   */
  function paintForm(id) {
    var editing = !!id;
    var config = editing ? configById(id) : null;
    if (editing && !config) return select(null);

    document.getElementById('title').textContent = editing ? 'Edit service' : 'Add service';
    document.getElementById('subtitle').textContent = editing
      ? 'Changes take effect on the next check, which runs as soon as you save.'
      : 'It is checked as soon as you add it.';
    document.getElementById('check').hidden = true;

    var detail = document.getElementById('detail');
    detail.className = 'form';
    detail.textContent = '';

    var name = field('Name', 'shown on the card and in the list');
    name.input.value = config ? config.name : '';
    name.input.placeholder = 'Optional — defaults to the host';
    var url = field('URL');
    url.input.value = config ? config.url : '';
    url.input.placeholder = 'https://api.example.com/health';
    detail.appendChild(name.wrap);
    detail.appendChild(url.wrap);

    var advanced = document.createElement('details');
    advanced.open = !!(config && hasOverrides(config));
    advanced.appendChild(el('summary', null, 'Overrides for this service'));

    var d = data.defaults;
    var status = field('Expected status');
    var timeout = field('Timeout (ms)');
    var slow = field('Slow over (ms)');
    var amber = field('Amber after');
    var red = field('Red after');
    var recover = field('Healthy after');
    var body = field('Body contains');
    var fields = [status, timeout, slow, amber, red, recover, body];
    var keys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                'redAfterFailures', 'recoverAfterSuccesses', 'expectedBodyContains'];
    for (var f = 0; f < fields.length; f++) {
      var key = keys[f];
      var stored = config ? config[key] : null;
      fields[f].input.value = stored === null || stored === undefined ? '' : String(stored);
      /*
       * The board's value *is* the placeholder, rather than the word "inherit" with the value
       * spelled out beside it.
       *
       * It puts the number where the number goes, and greyed against typed is already the
       * difference between inheriting and overriding, so the row needs no second line to say
       * which it is. That retired six hint lines from this form.
       */
      var inherited = d[key];
      fields[f].input.placeholder =
        inherited === '' || inherited === null || inherited === undefined
          ? 'not checked' : String(inherited);
      // No escape sequences in here, not even in this comment. Everything in this file is inside
      // a template literal, so an escaped newline becomes a real one: in a string it breaks the
      // quote across two lines, and in a comment it ends the comment and leaves the rest of the
      // sentence as code. The second one still parses, so the page test does not catch it.
      fields[f].wrap.title = TIPS[key]
        + '  Board default: ' + fields[f].input.placeholder + '. Leave blank to inherit it.';
    }
    var numrow = el('div', 'numrow');
    var numbers = el('div', 'numgrid');
    var numeric = [status, timeout, slow, amber, red, recover];
    for (var g = 0; g < numeric.length; g++) numbers.appendChild(numeric[g].wrap);
    numrow.appendChild(numbers);
    advanced.appendChild(numrow);
    advanced.appendChild(body.wrap);
    var snippet = checkField('Body snippet', 'store the response body in this service\u2019s history',
      config && config.showBodySnippetInHistory !== null
        ? config.showBodySnippetInHistory : d.showBodySnippetInHistory);
    advanced.appendChild(snippet.wrap);
    detail.appendChild(advanced);

    var error = el('div', 'error');
    var actions = el('div', 'form-actions');
    var save = el('button', 'primary', editing ? 'Save changes' : 'Add service');
    save.type = 'button';
    var cancel = el('button', 'ghost', 'Cancel');
    cancel.type = 'button';
    actions.appendChild(save);
    actions.appendChild(cancel);
    if (editing) {
      var remove = el('button', 'ghost danger', 'Delete');
      remove.type = 'button';
      remove.addEventListener('click', function () {
        post('delete-service', { id: id }).then(function () {
          select(null);
          refresh();
        });
      });
      actions.appendChild(remove);
    }
    detail.appendChild(actions);
    detail.appendChild(error);

    cancel.addEventListener('click', function () { select(editing ? id : null); });

    save.addEventListener('click', function () {
      var value = url.input.value.trim();
      if (!value) return fail('A URL is required.');
      // Deliberately string comparison rather than a regex: this page is a template literal, and
      // the backslashes in /^https?:\\/\\// are consumed by it — the pattern reached the browser
      // as /^https?:\/\// with its slashes unescaped, which is a different, broken expression.
      var lower = value.toLowerCase();
      if (lower.indexOf('http://') !== 0 && lower.indexOf('https://') !== 0) {
        return fail('The URL must start with http:// or https://.');
      }

      var draft = {
        name: name.input.value.trim(),
        url: value,
        expectedStatusCode: overrideValue(status.input.value),
        timeoutMs: overrideValue(timeout.input.value),
        slowThresholdMs: overrideValue(slow.input.value),
        amberAfterFailures: overrideValue(amber.input.value),
        redAfterFailures: overrideValue(red.input.value),
        recoverAfterSuccesses: overrideValue(recover.input.value),
        expectedBodyContains: body.input.value.trim() === '' ? null : body.input.value,
        showBodySnippetInHistory: snippet.input.checked
      };

      save.disabled = true;
      post(editing ? 'update-service' : 'add-service', { id: id, draft: draft })
        .then(function (reply) {
          save.disabled = false;
          if (reply.message) return fail(reply.message);
          apply(reply.data);
          select(editing ? id : (reply.id || null));
        });

      function fail(message) {
        error.textContent = message;
        return false;
      }
    });

    function fail(message) {
      error.textContent = message;
      return false;
    }
  }

  function hasOverrides(config) {
    var keys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                'redAfterFailures', 'recoverAfterSuccesses', 'expectedBodyContains',
                'showBodySnippetInHistory'];
    for (var i = 0; i < keys.length; i++) {
      if (config[keys[i]] !== null && config[keys[i]] !== undefined) return true;
    }
    return false;
  }

  /** The board's own settings: its name, its clock, and what every service inherits. */
  function paintSettings() {
    document.getElementById('title').textContent = 'Board settings';
    document.getElementById('subtitle').textContent =
      'Every service uses these unless it overrides them.';
    document.getElementById('check').hidden = true;

    var detail = document.getElementById('detail');
    detail.className = 'form';
    detail.textContent = '';

    var d = data.defaults;
    var name = field('Board name');
    name.input.value = data.boardName;
    var frequency = selectField('Check every', [
      ['manual', 'Manual only'], ['1m', 'Minute'], ['5m', '5 minutes'],
      ['10m', '10 minutes'], ['30m', '30 minutes'], ['1h', 'Hour']
    ], d.checkFrequency);
    var status = field('Expected status');
    status.input.value = String(d.expectedStatusCode);
    var timeout = field('Timeout (ms)');
    timeout.input.value = String(d.timeoutMs);
    var slow = field('Slow over (ms)');
    slow.input.value = String(d.slowThresholdMs);
    var amber = field('Amber after', 'failures');
    amber.input.value = String(d.amberAfterFailures);
    var red = field('Red after', 'failures');
    red.input.value = String(d.redAfterFailures);
    var recover = field('Healthy after', 'successes');
    recover.input.value = String(d.recoverAfterSuccesses);
    var body = field('Body contains', 'blank to skip the body');
    body.input.value = d.expectedBodyContains;
    var snippet = checkField('Body snippet', 'store response bodies in history',
      d.showBodySnippetInHistory);

    detail.appendChild(name.wrap);
    detail.appendChild(frequency.wrap);
    var numrow = el('div', 'numrow');
    var numbers = el('div', 'numgrid');
    var numeric = [status, timeout, slow, amber, red, recover];
    var numKeys = ['expectedStatusCode', 'timeoutMs', 'slowThresholdMs', 'amberAfterFailures',
                   'redAfterFailures', 'recoverAfterSuccesses'];
    for (var i = 0; i < numeric.length; i++) {
      numeric[i].wrap.title = TIPS[numKeys[i]];
      numbers.appendChild(numeric[i].wrap);
    }
    numrow.appendChild(numbers);
    detail.appendChild(numrow);
    body.wrap.title = TIPS.expectedBodyContains;
    detail.appendChild(body.wrap);
    detail.appendChild(snippet.wrap);

    var error = el('div', 'error');
    var actions = el('div', 'form-actions');
    var save = el('button', 'primary', 'Save settings');
    save.type = 'button';
    var cancel = el('button', 'ghost', 'Cancel');
    cancel.type = 'button';
    actions.appendChild(save);
    actions.appendChild(cancel);
    detail.appendChild(actions);
    detail.appendChild(error);

    cancel.addEventListener('click', function () { select(null); });
    save.addEventListener('click', function () {
      var update = {
        boardName: name.input.value.trim(),
        defaults: {
          checkFrequency: frequency.input.value,
          expectedStatusCode: overrideValue(status.input.value) || d.expectedStatusCode,
          timeoutMs: overrideValue(timeout.input.value) || d.timeoutMs,
          slowThresholdMs: overrideValue(slow.input.value) || d.slowThresholdMs,
          amberAfterFailures: overrideValue(amber.input.value) || d.amberAfterFailures,
          redAfterFailures: overrideValue(red.input.value) || d.redAfterFailures,
          recoverAfterSuccesses:
            overrideValue(recover.input.value) || d.recoverAfterSuccesses,
          expectedBodyContains: body.input.value,
          showBodySnippetInHistory: snippet.input.checked
        }
      };
      if (update.defaults.redAfterFailures < update.defaults.amberAfterFailures) {
        error.textContent = 'Red must be at least as many failures as amber.';
        return;
      }
      if (update.defaults.recoverAfterSuccesses < 1) {
        error.textContent = 'Healthy after must be at least one success.';
        return;
      }
      save.disabled = true;
      post('update-board', { update: update }).then(function (reply) {
        save.disabled = false;
        if (reply.message) { error.textContent = reply.message; return; }
        apply(reply.data);
        select(null);
      });
    });
  }

  function paintDetail() {
    var check = document.getElementById('check');
    check.hidden = false;
    if (view === 'add' || view === 'edit') paintForm(view === 'edit' ? selected : null);
    else if (view === 'settings') paintSettings();
    else if (selected === null) paintAll();
    else paintService(selected);
  }

  function paint() {
    paintRail();
    paintNotice();
    document.getElementById('edit').hidden = true;
    paintDetail();
    // One button, two jobs: it checks whatever is on screen, which is the whole board on All and
    // one service otherwise.
    document.getElementById('check-label').textContent =
      checking ? 'Checking…' : (selected === null ? 'Check all' : 'Check now');
    document.getElementById('check').disabled = checking || data.total === 0;
    document.getElementById('foot').textContent =
      data.total ? 'Checks run ' + data.frequency : '';
  }

  function select(id) {
    selected = id;
    view = 'list';
    paint();
  }

  function show(next) {
    view = next;
    paint();
  }

  /** Re-reads the board and repaints; used after a mutation, which never returns the overview. */
  function refresh() {
    return post('poll').then(function (reply) {
      if (reply.data) { data = reply.data; lastSignature = signature(data); paint(); }
    });
  }

  function paintNotice() {
    var notice = document.getElementById('notice');
    notice.textContent = '';
    if (!data.undo) { notice.hidden = true; return; }
    notice.hidden = false;
    notice.appendChild(el('span', null, 'Deleted ' + data.undo + '.'));
    var undo = el('button', null, 'Undo');
    undo.type = 'button';
    undo.addEventListener('click', function () {
      post('undo-delete').then(function (reply) {
        if (reply.message) return;
        if (reply.data) { data = reply.data; lastSignature = signature(data); }
        selected = reply.id || null;
        view = 'list';
        paint();
      });
    });
    notice.appendChild(undo);
    notice.hidden = false;
  }

  /* ── refresh ─────────────────────────────────────────────────────────── */

  function signature(d) {
    var parts = [d.boardName, d.total, d.failing, d.slow, d.frequency, d.undo,
                 JSON.stringify(d.defaults)];
    for (var i = 0; i < d.services.length; i++) {
      var s = d.services[i];
      parts.push(s.id, s.name, s.state, s.lastCheckedAt, s.checks);
      parts.push(JSON.stringify(d.configs[i] || null));
    }
    return parts.join('|');
  }
  var lastSignature = signature(data);

  function apply(next) {
    if (!next) return;
    var changed = signature(next) !== lastSignature;
    data = next;
    lastSignature = signature(next);
    // Ahead of the early return: the clock in the header is the one thing that moves while the
    // board stands still.
    if (view === 'list' && selected === null) paintSummary();
    if (!changed) return;
    /*
     * A form owns the pane for as long as it is open.
     *
     * The board keeps polling underneath it — a check landing every few seconds changes the
     * data, and repainting on that would rebuild the form and throw away whatever has been
     * typed into it. The rail and the notice still update, so the window stays live around the
     * edges.
     */
    if (view !== 'list') {
      paintRail();
      paintNotice();
      return;
    }
    paint();
  }

  var checking = false;
  function runCheck() {
    if (checking || data.total === 0) return;
    checking = true;
    var button = document.getElementById('check');
    var label = document.getElementById('check-label');
    button.disabled = true;
    label.textContent = 'Checking…';
    var request = selected === null
      ? post('check-all')
      : post('check-service', { id: selected });
    request.then(function (reply) {
      apply(reply.data);
    }).then(function () {
      checking = false;
      button.disabled = false;
      label.textContent = selected === null ? 'Check all' : 'Check now';
    });
  }

  document.getElementById('check').addEventListener('click', runCheck);
  document.getElementById('edit').addEventListener('click', function () { show('edit'); });
  document.getElementById('add').addEventListener('click', function () {
    if (data.total >= data.capacity) return;
    show('add');
  });
  document.getElementById('settings').addEventListener('click', function () { show('settings'); });

  /** Whether the keystroke belongs to a field the user is typing in. */
  function isTyping(e) {
    var target = e.target;
    if (!target) return false;
    var tag = (target.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea' || target.isContentEditable;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      // In a form, Escape cancels the form rather than the window: closing the whole board
      // because someone backed out of an edit is not what that key means here.
      if (view !== 'list') { select(selected); return; }
      post('close');
      window.close();
      return;
    }
    /*
     * Bare-letter shortcuts stop at the edge of a text field.
     *
     * Without this, typing a name containing "r" ran a round of checks — and the data that came
     * back repainted the pane, rebuilding the form and discarding what had been typed. Any
     * unmodified letter bound as a shortcut has this failure mode the moment a page grows a
     * field.
     */
    if (isTyping(e)) return;
    if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) runCheck();
  });

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

  window.addEventListener('beforeunload', function () { post('close'); });

  paint();
})();
</script>
</body>
</html>`;
}

/** Shows the board window and resolves when it closes. */
export async function showBoardWindow(
  hostPath: string,
  options: BoardWindowOptions
): Promise<void> {
  return serveWindow(hostPath, {
    width: options.width ?? WINDOW_WIDTH,
    height: options.height ?? WINDOW_HEIGHT,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    onWarn: options.onWarn,
    onOpen: options.onOpen,
    renderPage: (token) => renderBoardHtml(options.getOverview(), token, {
      width: options.width ?? WINDOW_WIDTH,
      height: options.height ?? WINDOW_HEIGHT,
    }),
    /**
     * The frame's page. Answered only for a service the board actually holds — the same rule the
     * picker follows for icons, so the page cannot ask for something it is not showing.
     */
    renderRoute: (pathname, params) => {
      if (pathname !== "/service") return null;
      const id = params.get("id");
      if (!id || !options.getServicePage) return null;
      return options.getServicePage(id, params.get("t") ?? "");
    },
    onMessage: async (message) => {
      if (message.type === "poll") {
        // A scoped poll comes from the embedded service view, not from the board itself.
        if (typeof message.scope === "string") {
          const snapshot = options.getServiceSnapshot?.(message.scope);
          return snapshot ? { data: snapshot } : {};
        }
        return { data: options.getOverview() };
      }

      if (message.type === "check-all") {
        await runSafely(options.onCheckAll?.(), options.onWarn, "board check");
        return { data: options.getOverview() };
      }

      if (message.type === "check-service" && typeof message.id === "string") {
        await runSafely(options.onCheckService?.(message.id), options.onWarn, "service check");
        return { data: options.getOverview() };
      }

      /*
       * Mutations report a failure rather than throwing it away: the message goes back to the
       * form, which keeps what was typed. Only a genuinely unknown message falls through.
       */
      if (message.type === "add-service" && options.onAddService) {
        const id = await options.onAddService(message.draft as never);
        return { data: options.getOverview(), id };
      }

      if (message.type === "update-service"
        && typeof message.id === "string" && options.onUpdateService) {
        await options.onUpdateService(message.id, message.draft as never);
        return { data: options.getOverview() };
      }

      if (message.type === "delete-service"
        && typeof message.id === "string" && options.onDeleteService) {
        await options.onDeleteService(message.id);
        return { data: options.getOverview() };
      }

      if (message.type === "undo-delete" && options.onUndoDelete) {
        const id = await options.onUndoDelete();
        return { data: options.getOverview(), id };
      }

      if (message.type === "move-service"
        && typeof message.id === "string" && typeof message.delta === "number"
        && options.onMoveService) {
        await options.onMoveService(message.id, message.delta);
        return { data: options.getOverview() };
      }

      if (message.type === "update-board" && options.onUpdateBoard) {
        await options.onUpdateBoard(message.update as never);
        return { data: options.getOverview() };
      }

      return {};
    },
  });
}

/** A failed check leaves the window up: the state it reports is already visible on the board. */
async function runSafely(
  work: Promise<void> | undefined,
  warn: ((message: string) => void) | undefined,
  label: string
): Promise<void> {
  if (!work) return;
  try {
    await work;
  } catch (error: unknown) {
    warn?.(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
