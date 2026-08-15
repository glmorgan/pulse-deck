import { describe, it, expect } from "vitest";
import { renderBoardIcon, BOARD_CAPACITY, type CellState } from "./boardIcon.js";

const SIZE = 144;

/** The icon is a data URI, so every assertion works from the SVG inside it. */
function svgOf(cells: CellState[]): string {
  const uri = renderBoardIcon(cells);
  const base64 = uri.replace("data:image/svg+xml;base64,", "");
  return Buffer.from(base64, "base64").toString("utf8");
}

function fills(cells: CellState[]): string[] {
  return [...svgOf(cells).matchAll(/<rect[^>]*fill="(#[0-9a-f]{6})"/gi)]
    .map((m) => m[1])
    // The first rect is the key background, not a cell.
    .slice(1);
}

interface Box { x: number; y: number; w: number; h: number }

/** The background rect carries no x or y, so requiring them here picks out the cells alone. */
function boxes(cells: CellState[]): Box[] {
  return [...svgOf(cells).matchAll(
    /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
  )].map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
}

function board(n: number): CellState[] {
  return Array<CellState>(n).fill("healthy");
}

const distinct = (values: number[]): number => new Set(values).size;

/** An unfilled slot, which is the only fill a board of `healthy` services can otherwise produce. */
const EMPTY = "#242424";

describe("renderBoardIcon", () => {
  it("produces a base64 SVG data URI, which is what setImage takes", () => {
    expect(renderBoardIcon(["healthy"])).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
  });

  it("draws one cell per service", () => {
    for (const n of [1, 2, 3, 5, 7, 11, BOARD_CAPACITY]) {
      expect(fills(board(n)).filter((f) => f !== EMPTY)).toHaveLength(n);
    }
  });

  it("fills out a grid the count does not divide into with unfilled slots", () => {
    // Five is a 3×2. The sixth slot is drawn as an outline rather than left as a hole, so the
    // grid stays a grid and the spare slot says what it is.
    expect(boxes(board(5))).toHaveLength(6);
    expect(fills(board(5)).filter((f) => f === EMPTY)).toHaveLength(1);
    expect(boxes(board(7))).toHaveLength(9);
    expect(boxes(board(11))).toHaveLength(12);
  });

  it("does not move a cell when the next service takes a spare slot", () => {
    // The reason the spare slot is drawn where it falls rather than the short row being centred:
    // adding a service inside the same grid must not shift the cells already on the key.
    for (const n of [5, 7, 8, 10, 11]) {
      expect(boxes(board(n + 1)).slice(0, n)).toEqual(boxes(board(n)).slice(0, n));
    }
  });

  it("keeps a service in the same row and column from five services to the cap", () => {
    // The whole reason the cap is twelve rather than sixteen. `ceil(sqrt(n))` would widen to four
    // columns at ten, and a column change re-lays every cell, so a service would move for a reason
    // that has nothing to do with it. Here the cells resize as rows are added, but the service at
    // index i stays at column i%3 and row floor(i/3) for every count on the way to a full board.
    for (let n = 5; n <= BOARD_CAPACITY; n++) {
      const drawn = boxes(board(n));
      const xs = [...new Set(drawn.map((c) => c.x))].sort((a, b) => a - b);
      const ys = [...new Set(drawn.map((c) => c.y))].sort((a, b) => a - b);
      expect(xs).toHaveLength(3);
      drawn.forEach((cell, i) => {
        expect(xs.indexOf(cell.x)).toBe(i % 3);
        expect(ys.indexOf(cell.y)).toBe(Math.floor(i / 3));
      });
    }
  });

  it("draws an empty board as the 3×3 outline, having no count to fit a grid to", () => {
    expect(boxes([])).toHaveLength(9);
    expect(distinct(boxes([]).map((c) => c.x))).toBe(3);
    expect(new Set(fills([])).size).toBe(1);
  });

  it("gives a single service the whole face", () => {
    const [only] = boxes(board(1));
    expect(only.w).toBe(only.h);
    expect(only.x + only.w / 2).toBeCloseTo(SIZE / 2);
    expect(only.w).toBeGreaterThan(SIZE * 0.8);
  });

  it("splits the face into full-width bars for two and three", () => {
    for (const n of [2, 3]) {
      const drawn = boxes(board(n));
      expect(distinct(drawn.map((c) => c.x))).toBe(1);
      expect(distinct(drawn.map((c) => c.y))).toBe(n);
      // A bar, not a square: this is the case the fixed grid used to draw as corner dots.
      expect(drawn[0].w).toBeGreaterThan(drawn[0].h);
    }
  });

  it("grows to 2×2, then 3×3, then a full 3×4", () => {
    for (const [n, cols, rows] of [[4, 2, 2], [9, 3, 3], [BOARD_CAPACITY, 3, 4]] as const) {
      const drawn = boxes(board(n));
      expect(distinct(drawn.map((c) => c.x))).toBe(cols);
      expect(distinct(drawn.map((c) => c.y))).toBe(rows);
    }
  });

  it("keeps every cell inside the key face at every count", () => {
    for (let n = 0; n <= BOARD_CAPACITY; n++) {
      for (const c of boxes(board(n))) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(SIZE);
        expect(c.y + c.h).toBeLessThanOrEqual(SIZE);
      }
    }
  });

  it("draws warning and down in the same red, since the key carries four colours", () => {
    // Deliberate: orange against amber was unreadable at cell size. How long something has been
    // failing is a question for the window, not for a small square.
    expect(fills(["warning"])[0]).toBe(fills(["down"])[0]);
  });

  it("keeps healthy, slow and failing distinct from each other", () => {
    const seen = new Set([fills(["healthy"])[0], fills(["slow"])[0], fills(["down"])[0]]);
    expect(seen.size).toBe(3);
  });

  it("treats never-checked and misconfigured as the same grey", () => {
    expect(fills(["unknown"])[0]).toBe(fills(["config-error"])[0]);
  });

  it("ignores services beyond the cap rather than overflowing the grid", () => {
    expect(boxes(board(20))).toHaveLength(BOARD_CAPACITY);
  });
});
