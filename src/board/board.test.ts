import { describe, it, expect } from "vitest";
import {
  boardCells,
  boardSummary,
  mergeBoardSettings,
  newService,
  resolveService,
  runtimeFor,
} from "./board.js";
import { DEFAULT_BOARD_DEFAULTS, EMPTY_RUNTIME, type BoardSettings } from "./types.js";

const service = (over: Partial<ReturnType<typeof newService>> = {}) => ({
  ...newService("Orders", "https://api.example.test/health"),
  ...over,
});

// ── resolveService ─────────────────────────────────────────────────────────

describe("resolveService", () => {
  it("takes the board's defaults when a service overrides nothing", () => {
    const resolved = resolveService(DEFAULT_BOARD_DEFAULTS, service());
    expect(resolved.timeoutMs).toBe(DEFAULT_BOARD_DEFAULTS.timeoutMs);
    expect(resolved.slowThresholdMs).toBe(DEFAULT_BOARD_DEFAULTS.slowThresholdMs);
    expect(resolved.redAfterFailures).toBe(DEFAULT_BOARD_DEFAULTS.redAfterFailures);
  });

  it("prefers an override over the default", () => {
    const resolved = resolveService(DEFAULT_BOARD_DEFAULTS, service({ timeoutMs: 12000 }));
    expect(resolved.timeoutMs).toBe(12000);
  });

  it("treats an empty body-match override as a real value, not as inherit", () => {
    // "" means "do not check the body", which a service must be able to say even when the board
    // default asks for a match. Only null and undefined mean inherit.
    const defaults = { ...DEFAULT_BOARD_DEFAULTS, expectedBodyContains: "ok" };
    expect(resolveService(defaults, service({ expectedBodyContains: "" })).expectedBodyContains)
      .toBe("");
    expect(resolveService(defaults, service()).expectedBodyContains).toBe("ok");
  });

  it("keeps a false override for the snippet toggle", () => {
    const defaults = { ...DEFAULT_BOARD_DEFAULTS, showBodySnippetInHistory: true };
    expect(resolveService(defaults, service({ showBodySnippetInHistory: false }))
      .showBodySnippetInHistory).toBe(false);
  });

  it("coerces numbers that arrived as strings from a saved profile", () => {
    const resolved = resolveService(
      DEFAULT_BOARD_DEFAULTS,
      service({ timeoutMs: "8000" as unknown as number })
    );
    expect(resolved.timeoutMs).toBe(8000);
  });

  it("falls back when an override is nonsense rather than checking with it", () => {
    const resolved = resolveService(
      DEFAULT_BOARD_DEFAULTS,
      service({ timeoutMs: "banana" as unknown as number })
    );
    expect(resolved.timeoutMs).toBe(DEFAULT_BOARD_DEFAULTS.timeoutMs);
  });

  it("carries the service's own runtime into the resolved settings", () => {
    const resolved = resolveService(DEFAULT_BOARD_DEFAULTS, service(), {
      ...EMPTY_RUNTIME,
      consecutiveFailures: 2,
      currentState: "warning",
    });
    expect(resolved.consecutiveFailures).toBe(2);
    expect(resolved.currentState).toBe("warning");
  });
});

// ── mergeBoardSettings ─────────────────────────────────────────────────────

describe("mergeBoardSettings", () => {
  it("produces a usable board from nothing at all", () => {
    const board = mergeBoardSettings(undefined);
    expect(board.services).toEqual([]);
    expect(board.runtime).toEqual({});
    expect(board.defaults.timeoutMs).toBe(DEFAULT_BOARD_DEFAULTS.timeoutMs);
  });

  it("gives every service a runtime, even one saved without one", () => {
    const svc = service();
    const board = mergeBoardSettings({ services: [svc] } as Partial<BoardSettings>);
    expect(runtimeFor(board, svc.id).history).toEqual([]);
  });

  it("drops runtime belonging to services that no longer exist", () => {
    // Otherwise deleted services accumulate history in settings forever, invisibly.
    const svc = service();
    const board = mergeBoardSettings({
      services: [svc],
      runtime: { [svc.id]: { ...EMPTY_RUNTIME }, ghost: { ...EMPTY_RUNTIME } },
    } as Partial<BoardSettings>);
    expect(Object.keys(board.runtime)).toEqual([svc.id]);
  });

  it("keeps partial defaults and fills in the rest", () => {
    const board = mergeBoardSettings({ defaults: { timeoutMs: 9000 } } as Partial<BoardSettings>);
    expect(board.defaults.timeoutMs).toBe(9000);
    expect(board.defaults.expectedStatusCode).toBe(DEFAULT_BOARD_DEFAULTS.expectedStatusCode);
  });
});

// ── the key face ───────────────────────────────────────────────────────────

describe("boardCells", () => {
  it("reports each service's state in list order", () => {
    const a = service({ name: "A" });
    const b = service({ name: "B" });
    const board = mergeBoardSettings({ services: [a, b] } as Partial<BoardSettings>);
    board.runtime[a.id].currentState = "healthy";
    board.runtime[b.id].currentState = "down";
    expect(boardCells(board)).toEqual(["healthy", "down"]);
  });

  it("shows a service with no URL as a configuration error, not as unknown", () => {
    const board = mergeBoardSettings({
      services: [service({ url: "  " })],
    } as Partial<BoardSettings>);
    expect(boardCells(board)).toEqual(["config-error"]);
  });

  it("returns nothing for an empty board, leaving the grid to draw empty slots", () => {
    expect(boardCells(mergeBoardSettings(undefined))).toEqual([]);
  });
});

describe("boardSummary", () => {
  it("counts anything failing or misconfigured", () => {
    const [a, b, c] = [service(), service(), service({ url: "" })];
    const board = mergeBoardSettings({ services: [a, b, c] } as Partial<BoardSettings>);
    board.runtime[a.id].currentState = "healthy";
    board.runtime[b.id].currentState = "down";
    expect(boardSummary(board)).toEqual({ total: 3, failing: 2 });
  });

  it("does not count slow as failing — it answered, just not quickly", () => {
    const a = service();
    const board = mergeBoardSettings({ services: [a] } as Partial<BoardSettings>);
    board.runtime[a.id].currentState = "slow";
    expect(boardSummary(board).failing).toBe(0);
  });
});
