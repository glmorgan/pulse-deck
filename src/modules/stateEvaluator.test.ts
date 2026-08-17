import { describe, it, expect } from "vitest";
import { evaluateButtonState, validateSettings, buildCheckRecord } from "./stateEvaluator.js";
import type { StateInputs } from "./stateEvaluator.js";
import { DEFAULT_SETTINGS } from "../types.js";
import type { CheckRecord, HealthCheckSettings } from "../types.js";

const settings = (): HealthCheckSettings => ({ ...DEFAULT_SETTINGS });

const okRecord = (responseTimeMs = 100): CheckRecord => ({
  timestamp: new Date().toISOString(),
  ok: true,
  state: "healthy",
  statusCode: 200,
  responseTimeMs,
  bodyMatched: null,
  bodySnippet: null,
  error: null,
});

const failRecord = (): CheckRecord => ({
  timestamp: new Date().toISOString(),
  ok: false,
  state: "warning",
  statusCode: 503,
  responseTimeMs: 200,
  bodyMatched: null,
  bodySnippet: null,
  error: "Expected status 200 but received 503",
});

// ── evaluateButtonState ────────────────────────────────────────────────────

/** Defaults for everything the case under test is not about. */
const at = (
  s: HealthCheckSettings,
  inputs: Partial<StateInputs>
): string => evaluateButtonState(s, {
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  previousState: "healthy",
  lastRecord: null,
  ...inputs,
});

describe("evaluateButtonState", () => {
  it("returns unknown when no record exists", () => {
    expect(at(settings(), { lastRecord: null })).toBe("unknown");
  });

  it("returns healthy when check passed and response is fast", () => {
    expect(at(settings(), { lastRecord: okRecord(500) })).toBe("healthy");
  });

  it("returns slow when check passed but response exceeded slow threshold", () => {
    expect(at(settings(), { lastRecord: okRecord(1500) })).toBe("slow");
  });

  it("returns warning when failures are below red threshold", () => {
    const s = settings();
    expect(at(s, { consecutiveFailures: 1, lastRecord: failRecord() })).toBe("warning");
    expect(at(s, { consecutiveFailures: 2, lastRecord: failRecord() })).toBe("warning");
  });

  it("returns down when failures reach or exceed the red threshold", () => {
    expect(at(settings(), { consecutiveFailures: 3, lastRecord: failRecord() })).toBe("down");
    expect(at(settings(), { consecutiveFailures: 10, lastRecord: failRecord() })).toBe("down");
  });

  it("holds the previous state until failures reach the amber threshold", () => {
    // This is the setting that was configured, inherited and validated but never read: before
    // this, one failure was warning however high amberAfterFailures was set.
    const s = { ...settings(), amberAfterFailures: 2, redAfterFailures: 5 };
    expect(at(s, { consecutiveFailures: 1, lastRecord: failRecord() })).toBe("healthy");
    expect(at(s, { consecutiveFailures: 2, lastRecord: failRecord() })).toBe("warning");
    expect(at(s, { consecutiveFailures: 4, lastRecord: failRecord() })).toBe("warning");
    expect(at(s, { consecutiveFailures: 5, lastRecord: failRecord() })).toBe("down");
  });

  it("does not let a sub-amber failure promote a failing service", () => {
    // Holding the previous state, rather than returning healthy, is what makes this work: a
    // service that was down, passed once and failed again must not come back as healthy.
    const s = { ...settings(), amberAfterFailures: 3, redAfterFailures: 5 };
    expect(at(s, { consecutiveFailures: 1, previousState: "down", lastRecord: failRecord() }))
      .toBe("down");
  });

  it("calls a first-ever failure warning, having no previous state to hold", () => {
    const s = { ...settings(), amberAfterFailures: 3 };
    expect(at(s, { consecutiveFailures: 1, previousState: "unknown", lastRecord: failRecord() }))
      .toBe("warning");
  });

  it("respects custom slow threshold", () => {
    const s = { ...settings(), slowThresholdMs: 500 };
    expect(at(s, { lastRecord: okRecord(499) })).toBe("healthy");
    expect(at(s, { lastRecord: okRecord(501) })).toBe("slow");
  });

  it("clears a failure on the first success by default", () => {
    // recoverAfterSuccesses is 1 out of the box, which is exactly the behaviour that shipped
    // before the setting existed.
    expect(at(settings(), {
      consecutiveSuccesses: 1, previousState: "down", lastRecord: okRecord(100),
    })).toBe("healthy");
  });

  it("holds a failing state until the recovery threshold is met", () => {
    const s = { ...settings(), recoverAfterSuccesses: 3 };
    for (const previousState of ["down", "warning"] as const) {
      expect(at(s, { consecutiveSuccesses: 1, previousState, lastRecord: okRecord() }))
        .toBe(previousState);
      expect(at(s, { consecutiveSuccesses: 2, previousState, lastRecord: okRecord() }))
        .toBe(previousState);
      expect(at(s, { consecutiveSuccesses: 3, previousState, lastRecord: okRecord() }))
        .toBe("healthy");
    }
  });

  it("recovers into slow when the recovering check is slow", () => {
    const s = { ...settings(), recoverAfterSuccesses: 2 };
    expect(at(s, {
      consecutiveSuccesses: 2, previousState: "down", lastRecord: okRecord(1500),
    })).toBe("slow");
  });

  it("does not gate recovery from slow, which is a level rather than a fault", () => {
    const s = { ...settings(), recoverAfterSuccesses: 5 };
    expect(at(s, { consecutiveSuccesses: 1, previousState: "slow", lastRecord: okRecord(100) }))
      .toBe("healthy");
  });
});

// ── validateSettings ───────────────────────────────────────────────────────

describe("validateSettings", () => {
  it("returns null for valid settings", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "https://api.example.com/health" })).toBeNull();
  });

  it("errors when URL is empty", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "" })).toBeTruthy();
  });

  it("errors when URL is whitespace", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "   " })).toBeTruthy();
  });

  it("errors when URL is invalid", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "not-a-url" })).toBeTruthy();
  });

  it("errors when URL uses a non-http protocol", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "ftp://example.com" })).toBeTruthy();
  });

  it("accepts http:// URLs", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "http://localhost:3000/health" })).toBeNull();
  });

  it("errors when red threshold is less than amber threshold", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "https://example.com", amberAfterFailures: 5, redAfterFailures: 2 })).toBeTruthy();
  });

  it("accepts equal amber and red thresholds", () => {
    expect(validateSettings({ ...settings(), endpointUrl: "https://example.com", amberAfterFailures: 3, redAfterFailures: 3 })).toBeNull();
  });
});

// ── buildCheckRecord ───────────────────────────────────────────────────────

describe("buildCheckRecord", () => {
  it("builds a record from a successful result", () => {
    const result = { ok: true, statusCode: 200, responseTimeMs: 84, bodyMatched: null, bodySnippet: null, error: null };
    const record = buildCheckRecord(result, "healthy");
    expect(record.ok).toBe(true);
    expect(record.state).toBe("healthy");
    expect(record.statusCode).toBe(200);
    expect(record.responseTimeMs).toBe(84);
    expect(record.error).toBeNull();
    expect(record.timestamp).toBeTruthy();
  });

  it("builds a record from a failed result", () => {
    const result = { ok: false, statusCode: 503, responseTimeMs: 200, bodyMatched: null, bodySnippet: null, error: "Expected 200 but got 503" };
    const record = buildCheckRecord(result, "down");
    expect(record.ok).toBe(false);
    expect(record.state).toBe("down");
    expect(record.error).toBe("Expected 200 but got 503");
  });

  it("includes a valid ISO timestamp", () => {
    const result = { ok: true, statusCode: 200, responseTimeMs: 50, bodyMatched: null, bodySnippet: null, error: null };
    const record = buildCheckRecord(result, "healthy");
    expect(() => new Date(record.timestamp)).not.toThrow();
    expect(new Date(record.timestamp).getTime()).toBeGreaterThan(0);
  });
});
