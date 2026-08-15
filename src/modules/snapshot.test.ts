import { describe, it, expect } from "vitest";
import { buildSnapshot, buildStats, percentile, stateLabel, frequencyLabel } from "./snapshot.js";
import { DEFAULT_SETTINGS, type CheckRecord, type HealthCheckSettings } from "../types.js";

const record = (over: Partial<CheckRecord> = {}): CheckRecord => ({
  timestamp: new Date("2026-08-14T10:00:00Z").toISOString(),
  ok: true,
  state: "healthy",
  statusCode: 200,
  responseTimeMs: 100,
  bodyMatched: null,
  bodySnippet: null,
  error: null,
  ...over,
});

const settings = (over: Partial<HealthCheckSettings> = {}): HealthCheckSettings => ({
  ...DEFAULT_SETTINGS,
  ...over,
});

// ── percentile ─────────────────────────────────────────────────────────────

describe("percentile", () => {
  it("returns null for no values", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("returns the only value for a single sample", () => {
    expect(percentile([42], 95)).toBe(42);
  });

  it("returns a value that was actually measured rather than interpolating", () => {
    const values = [10, 20, 30, 40];
    expect(values).toContain(percentile(values, 50));
  });

  it("takes the nearest rank at the median", () => {
    expect(percentile([10, 20, 30, 40], 50)).toBe(20);
  });

  it("returns the largest value at p95 of a small sample", () => {
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);
  });

  it("ignores the order values arrive in", () => {
    expect(percentile([40, 10, 30, 20], 50)).toBe(20);
  });
});

// ── buildStats ─────────────────────────────────────────────────────────────

describe("buildStats", () => {
  const SLOW = 800;

  it("reports nulls with no history rather than zeros", () => {
    const stats = buildStats([], SLOW);
    expect(stats.uptimePct).toBeNull();
    expect(stats.median).toBeNull();
    expect(stats.total).toBe(0);
  });

  it("computes uptime to one decimal place", () => {
    const history = [record(), record(), record(), record({ ok: false })];
    expect(buildStats(history, SLOW).uptimePct).toBe(75);
  });

  it("counts failures", () => {
    const history = [record(), record({ ok: false }), record({ ok: false })];
    const stats = buildStats(history, SLOW);
    expect(stats.ok).toBe(1);
    expect(stats.failed).toBe(2);
  });

  it("counts successful checks past the slow threshold", () => {
    const history = [
      record({ responseTimeMs: 100 }),
      record({ responseTimeMs: 900 }),
      record({ responseTimeMs: 1200 }),
    ];
    expect(buildStats(history, SLOW).overThreshold).toBe(2);
  });

  it("treats a check exactly on the threshold as not slow, as the state machine does", () => {
    expect(buildStats([record({ responseTimeMs: SLOW })], SLOW).overThreshold).toBe(0);
  });

  it("never counts a failure as slow, however long it took to fail", () => {
    const history = [record({ ok: false, responseTimeMs: 5000 })];
    expect(buildStats(history, SLOW).overThreshold).toBe(0);
  });

  it("excludes failed checks from the latency figures", () => {
    // A timeout would otherwise drag the average up by its full timeout value for a reason that
    // has nothing to do with how fast the service is when it answers.
    const history = [
      record({ responseTimeMs: 100 }),
      record({ responseTimeMs: 200 }),
      record({ ok: false, responseTimeMs: 5000 }),
    ];
    const stats = buildStats(history, SLOW);
    expect(stats.average).toBe(150);
    expect(stats.slowest).toBe(200);
    expect(stats.latencySamples).toBe(2);
  });

  it("reports no latency figures when every check failed", () => {
    const stats = buildStats([record({ ok: false }), record({ ok: false })], SLOW);
    expect(stats.median).toBeNull();
    expect(stats.fastest).toBeNull();
    expect(stats.uptimePct).toBe(0);
  });
});

// ── buildSnapshot ──────────────────────────────────────────────────────────

describe("buildSnapshot", () => {
  it("names an unconfigured service rather than showing an empty heading", () => {
    expect(buildSnapshot(settings()).serviceName).toBe("Unnamed service");
  });

  it("carries the configured name through", () => {
    expect(buildSnapshot(settings({ serviceName: "Orders API" })).serviceName).toBe("Orders API");
  });

  it("keeps checks oldest first, so the chart reads left to right", () => {
    const older = record({ timestamp: "2026-08-14T09:00:00.000Z" });
    const newer = record({ timestamp: "2026-08-14T10:00:00.000Z" });
    const snapshot = buildSnapshot(settings({ history: [older, newer] }));
    expect(snapshot.checks[0].timestamp).toBe(older.timestamp);
  });

  it("withholds body snippets unless the setting asks for them", () => {
    const history = [record({ bodySnippet: "OK-secret" })];
    expect(buildSnapshot(settings({ history })).checks[0].bodySnippet).toBeNull();
    expect(
      buildSnapshot(settings({ history, showBodySnippetInHistory: true })).checks[0].bodySnippet
    ).toBe("OK-secret");
  });

  it("survives settings saved before history existed", () => {
    const stale = { ...DEFAULT_SETTINGS } as HealthCheckSettings;
    // @ts-expect-error — reproducing a profile written by an older build
    delete stale.history;
    expect(() => buildSnapshot(stale)).not.toThrow();
    expect(buildSnapshot(stale).checks).toEqual([]);
  });
});

// ── labels ─────────────────────────────────────────────────────────────────

describe("labels", () => {
  it("gives every button state a readable label", () => {
    expect(stateLabel("config-error")).toBe("Configuration error");
    expect(stateLabel("healthy")).toBe("Healthy");
  });

  it("passes an unknown state through rather than blanking it", () => {
    expect(stateLabel("something-new")).toBe("something-new");
  });

  it("describes the check frequency in words", () => {
    expect(frequencyLabel("1m")).toBe("every minute");
    expect(frequencyLabel("manual")).toBe("manual only");
  });
});
