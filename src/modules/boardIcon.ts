import type { ButtonState } from "../types.js";

/**
 * Draws the Health Board key face: one cell per service, in a grid sized to fit them.
 *
 * The existing action picks a PNG off disk per state, which cannot express a board's worth of
 * states at once. This builds an SVG and hands it over as a base64 data URI, so the key is
 * generated rather than chosen. `setImage` is documented as taking "a base64 encoded string with
 * the mime type declared (e.g. PNG, JPEG, etc.)" — SVG is neither confirmed nor denied there,
 * which is why this is the first thing built and put on a real device.
 *
 * Rendered at 144×144, the @2x key size, so it stays sharp on every Stream Deck.
 *
 * **The grid fits the count rather than staying a fixed 3×3.** A fixed grid kept a cell in the
 * same place for the life of a board, which is worth something, but it drew a two-service board
 * as two small squares in the corner of a mostly empty key.
 *
 * **Three columns from five services up, which is what makes a position worth reading.** The
 * obvious rule is `ceil(sqrt(n))`, and it was built that way first. It changes the column count
 * twice on the way to a full board, and a column change re-lays every cell, so a service moves
 * for reasons that have nothing to do with it. Holding at three means a service keeps its row and
 * column from five services to the cap; only the row height changes as the board fills. That is
 * what lets the window use the same three columns and have "the red one is bottom-left" carry
 * from the key to a name.
 */

/** A cell is a service's state, or a slot in the grid that no service has filled yet. */
export type CellState = ButtonState | "empty";

/**
 * Twelve services, three across, so a full board is a 3×4.
 *
 * Sixteen was built and rejected. Cell area is the face divided by the count however the grid is
 * turned, so a 4×4 cell came out around 14×14 device pixels on the key against the 3×4's 20×14,
 * and it cost the third column that everything above depends on. Twelve is also where the window
 * stops having to shrink a card to fit.
 */
export const BOARD_CAPACITY = 12;

const SIZE = 144;

/** A board with nothing on it: there is no count to fit a grid to, so it keeps the old 3×3. */
const EMPTY_GRID = { cols: 3, rows: 3 } as const;

/**
 * Four colours, no more: green, amber, red, grey.
 *
 * The window distinguishes five states, but a small cell cannot. Warning and down were adjacent
 * hues at similar lightness — orange against amber — and telling them apart at this size was
 * guesswork, worse for anyone red/green colourblind. So a failing check is red whether or not it
 * has passed the red threshold, and how long it has been failing is a question for the window.
 *
 * `checking` sits with the greys rather than getting a colour of its own: a key image is a still,
 * and the state lasts a few hundred milliseconds.
 */
const CELL_FILL: Record<CellState, string> = {
  healthy: "#4cc94c",
  slow: "#fab219",
  warning: "#d03b3b",
  down: "#d03b3b",
  checking: "#5a5a5a",
  unknown: "#4a4a4a",
  "config-error": "#4a4a4a",
  empty: "#242424",
};

/** Unfilled slots read as an outline rather than a filled cell, so they are not a state. */
const CELL_STROKE: Partial<Record<CellState, string>> = {
  empty: "#333333",
};

/** Columns and rows for a count of services, with the spacing that suits them. */
function gridFor(count: number): { cols: number; rows: number; pad: number; gap: number } {
  const { cols, rows } = shapeFor(count);
  // Four *either way*: a 3×4 is as tight as a 4×3, and at the roomier spacing the padding and the
  // corner radius eat about a fifth of what is left to colour. Keyed off columns alone this was
  // dead code under the old square rule, and wrong the moment the grid could be taller than wide.
  const tight = cols >= 4 || rows >= 4;
  return { cols, rows, pad: tight ? 8 : 10, gap: tight ? 5 : 8 };
}

function shapeFor(count: number): { cols: number; rows: number } {
  if (count <= 0) return { ...EMPTY_GRID };
  // Two and three are bars across the full width, not halves side by side. At key size a wide bar
  // is the more legible shape, and it is the one that reads as "this is all of them".
  if (count <= 3) return { cols: 1, rows: count };
  // Four is the one count that earns its own shape: three across would draw it as a row of three
  // and a lone cell with two spares, where a 2×2 fills the face. It costs one re-lay at the fifth
  // service, which is early enough that the board is still readable by name.
  if (count === 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: Math.ceil(count / 3) };
}

/** SVG takes floats, but two decimals keeps the markup readable when something looks wrong. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function renderBoardIcon(cells: CellState[]): string {
  const shown = cells.slice(0, BOARD_CAPACITY);
  const { cols, rows, pad, gap } = gridFor(shown.length);
  // Counts that do not divide into their grid (5, 7, 10, 13) leave the remainder as outlines,
  // which is the same slot the empty board is made of. Centring the short row instead was tried
  // and is worse on the thing that matters more than balance: filling a spare slot moves nothing,
  // where re-centring a row shifts every cell already in it.
  const slots: CellState[] = [...shown];
  while (slots.length < cols * rows) slots.push("empty");

  const cellW = (SIZE - pad * 2 - gap * (cols - 1)) / cols;
  const cellH = (SIZE - pad * 2 - gap * (rows - 1)) / rows;
  // Scaled off the cell rather than fixed, or the radius that suits a 36px square swallows a 28px
  // one and rounds a full-face cell into a lozenge. Lands on 7 for a 3×3, which is where it was.
  const radius = Math.max(4, Math.min(14, Math.round(Math.min(cellW, cellH) / 5)));

  let rects = "";
  for (let i = 0; i < slots.length; i++) {
    const x = round2(pad + (i % cols) * (cellW + gap));
    const y = round2(pad + Math.floor(i / cols) * (cellH + gap));
    const state = slots[i];
    const stroke = CELL_STROKE[state];
    rects += `<rect x="${x}" y="${y}" width="${round2(cellW)}" height="${round2(cellH)}"`
      + ` rx="${radius}"`
      + ` fill="${CELL_FILL[state]}"`
      + (stroke ? ` stroke="${stroke}" stroke-width="2"` : "")
      + ` />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"`
    + ` viewBox="0 0 ${SIZE} ${SIZE}">`
    + `<rect width="${SIZE}" height="${SIZE}" fill="#1c1c1c" />`
    + rects
    + `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
