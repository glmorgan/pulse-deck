import { describe, it, expect } from "vitest";
import { getIntervalMs, msUntilDue } from "./timerManager.js";

describe("getIntervalMs", () => {
  it("returns null for manual frequency", () => {
    expect(getIntervalMs("manual")).toBeNull();
  });

  it("returns 60000 for 1m frequency", () => {
    expect(getIntervalMs("1m")).toBe(60_000);
  });

  it("returns 300000 for 5m frequency", () => {
    expect(getIntervalMs("5m")).toBe(300_000);
  });

  it("returns 600000 for 10m frequency", () => {
    expect(getIntervalMs("10m")).toBe(600_000);
  });

  it("returns 1800000 for 30m frequency", () => {
    expect(getIntervalMs("30m")).toBe(1_800_000);
  });

  it("returns 3600000 for 1h frequency", () => {
    expect(getIntervalMs("1h")).toBe(3_600_000);
  });
});

// ── msUntilDue ─────────────────────────────────────────────────────────────

describe("msUntilDue", () => {
  const HOUR = 3_600_000;
  const FLOOR = 1500;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("checks shortly after appearing when nothing has run yet", () => {
    expect(msUntilDue(null, HOUR, FLOOR)).toBe(FLOOR);
  });

  it("waits out the rest of the interval for a key checked recently", () => {
    // The case this exists for: opening a folder and coming back must not re-run the check.
    const due = msUntilDue(ago(10 * 60_000), HOUR, FLOOR);
    expect(due).toBeGreaterThan(45 * 60_000);
    expect(due).toBeLessThanOrEqual(50 * 60_000);
  });

  it("checks shortly after appearing when the key is overdue", () => {
    expect(msUntilDue(ago(2 * HOUR), HOUR, FLOOR)).toBe(FLOOR);
  });

  it("never returns less than the settling delay", () => {
    // One millisecond short of due would otherwise fire a check while the key is still drawing.
    expect(msUntilDue(ago(HOUR - 1), HOUR, FLOOR)).toBe(FLOOR);
  });

  it("treats an unparseable timestamp as never checked", () => {
    expect(msUntilDue("not a date", HOUR, FLOOR)).toBe(FLOOR);
  });

  it("does not park a key for hours when the clock has moved backwards", () => {
    // A timestamp in the future is what a clock change or a synced profile produces; waiting it
    // out would leave a key silently unchecked.
    expect(msUntilDue(new Date(Date.now() + HOUR).toISOString(), HOUR, FLOOR)).toBe(FLOOR);
  });
});
