import { describe, it, expect } from "vitest";
import { appendRecord, uptimeRatio, averageLatency, formatHistoryPopup } from "./history.js";
import type { CheckRecord } from "../types.js";

const makeRecord = (ok: boolean, responseTimeMs = 100): CheckRecord => ({
  timestamp: new Date().toISOString(),
  ok,
  state: ok ? "healthy" : "down",
  statusCode: ok ? 200 : 503,
  responseTimeMs,
  bodyMatched: null,
  bodySnippet: null,
  error: ok ? null : "Service unavailable",
});

// ── appendRecord ───────────────────────────────────────────────────────────

describe("appendRecord", () => {
  it("appends a record to an empty history", () => {
    const result = appendRecord([], makeRecord(true));
    expect(result).toHaveLength(1);
  });

  it("appends to an existing history", () => {
    const history = [makeRecord(true), makeRecord(false)];
    const result = appendRecord(history, makeRecord(true));
    expect(result).toHaveLength(3);
  });

  it("caps history at 60 records", () => {
    const history = Array.from({ length: 60 }, () => makeRecord(true));
    const result = appendRecord(history, makeRecord(false));
    expect(result).toHaveLength(60);
  });

  it("keeps the newest record when trimming", () => {
    const history = Array.from({ length: 60 }, () => makeRecord(true));
    const newest = makeRecord(false);
    const result = appendRecord(history, newest);
    expect(result[result.length - 1]).toBe(newest);
  });

  it("drops the oldest record when trimming", () => {
    const oldest = makeRecord(true);
    const history = [oldest, ...Array.from({ length: 59 }, () => makeRecord(true))];
    const result = appendRecord(history, makeRecord(false));
    expect(result[0]).not.toBe(oldest);
  });

  it("does not mutate the original history array", () => {
    const history = [makeRecord(true)];
    appendRecord(history, makeRecord(false));
    expect(history).toHaveLength(1);
  });
});

// ── uptimeRatio ────────────────────────────────────────────────────────────

describe("uptimeRatio", () => {
  it("returns N/A for empty history", () => {
    expect(uptimeRatio([])).toBe("N/A");
  });

  it("returns full uptime when all checks passed", () => {
    const history = [makeRecord(true), makeRecord(true), makeRecord(true)];
    expect(uptimeRatio(history)).toBe("3/3 checks successful");
  });

  it("returns partial uptime", () => {
    const history = [makeRecord(true), makeRecord(false), makeRecord(true)];
    expect(uptimeRatio(history)).toBe("2/3 checks successful");
  });

  it("returns zero uptime when all checks failed", () => {
    const history = [makeRecord(false), makeRecord(false)];
    expect(uptimeRatio(history)).toBe("0/2 checks successful");
  });
});

// ── averageLatency ─────────────────────────────────────────────────────────

describe("averageLatency", () => {
  it("returns null for empty history", () => {
    expect(averageLatency([])).toBeNull();
  });

  it("returns the latency for a single record", () => {
    expect(averageLatency([makeRecord(true, 100)])).toBe(100);
  });

  it("returns the average latency across records", () => {
    const history = [makeRecord(true, 100), makeRecord(true, 200), makeRecord(true, 300)];
    expect(averageLatency(history)).toBe(200);
  });

  it("rounds the average to the nearest millisecond", () => {
    const history = [makeRecord(true, 100), makeRecord(true, 200)];
    expect(averageLatency(history)).toBe(150);
  });
});

// ── formatHistoryPopup ─────────────────────────────────────────────────────

describe("formatHistoryPopup", () => {
  it("shows a no-history message when history is empty", () => {
    const text = formatHistoryPopup("My API", "unknown", 0, []);
    expect(text).toContain("No checks have run yet");
    expect(text).toContain("My API");
  });

  it("includes the service name", () => {
    const text = formatHistoryPopup("Orders API", "healthy", 0, [makeRecord(true)]);
    expect(text).toContain("Orders API");
  });

  it("includes the current state", () => {
    const text = formatHistoryPopup("API", "down", 3, [makeRecord(false)]);
    expect(text).toContain("Down");
  });

  it("includes consecutive failures", () => {
    const text = formatHistoryPopup("API", "down", 5, [makeRecord(false)]);
    expect(text).toContain("5");
  });

  it("includes uptime ratio", () => {
    const history = [makeRecord(true), makeRecord(false)];
    const text = formatHistoryPopup("API", "warning", 1, history);
    expect(text).toContain("1/2 checks successful");
  });

  it("shows recent check rows", () => {
    const history = [makeRecord(true, 84), makeRecord(false, 200)];
    const text = formatHistoryPopup("API", "warning", 1, history);
    expect(text).toContain("OK");
    expect(text).toContain("FAIL");
  });

  it("limits display to the most recent 15 checks", () => {
    const history = Array.from({ length: 60 }, (_, i) => makeRecord(i % 2 === 0));
    const text = formatHistoryPopup("API", "warning", 1, history);
    const rows = text.split("\n").filter(l => l.includes("OK") || l.includes("FAIL"));
    expect(rows.length).toBeLessThanOrEqual(15);
  });
});
