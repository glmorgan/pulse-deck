import { describe, it, expect } from "vitest";
import { getIntervalMs } from "./timerManager.js";

describe("getIntervalMs", () => {
  it("returns null for manual frequency", () => {
    expect(getIntervalMs("manual")).toBeNull();
  });

  it("returns 60000 for 1m frequency", () => {
    expect(getIntervalMs("1m")).toBe(60_000);
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
