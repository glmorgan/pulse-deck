import { describe, it, expect } from "vitest";
import { evaluateButtonState, validateSettings, buildCheckRecord } from "./stateEvaluator.js";
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

describe("evaluateButtonState", () => {
  it("returns unknown when no record exists", () => {
    expect(evaluateButtonState(settings(), 0, null)).toBe("unknown");
  });

  it("returns healthy when check passed and response is fast", () => {
    expect(evaluateButtonState(settings(), 0, okRecord(500))).toBe("healthy");
  });

  it("returns slow when check passed but response exceeded slow threshold", () => {
    expect(evaluateButtonState(settings(), 0, okRecord(1500))).toBe("slow");
  });

  it("returns warning when failures are below red threshold", () => {
    const s = settings();
    expect(evaluateButtonState(s, 1, failRecord())).toBe("warning");
    expect(evaluateButtonState(s, 2, failRecord())).toBe("warning");
  });

  it("returns down when failures reach red threshold", () => {
    expect(evaluateButtonState(settings(), 3, failRecord())).toBe("down");
  });

  it("returns down when failures exceed red threshold", () => {
    expect(evaluateButtonState(settings(), 10, failRecord())).toBe("down");
  });

  it("respects custom amber and red thresholds", () => {
    const s = { ...settings(), amberAfterFailures: 2, redAfterFailures: 5 };
    expect(evaluateButtonState(s, 1, failRecord())).toBe("warning");
    expect(evaluateButtonState(s, 4, failRecord())).toBe("warning");
    expect(evaluateButtonState(s, 5, failRecord())).toBe("down");
  });

  it("respects custom slow threshold", () => {
    const s = { ...settings(), slowThresholdMs: 500 };
    expect(evaluateButtonState(s, 0, okRecord(499))).toBe("healthy");
    expect(evaluateButtonState(s, 0, okRecord(501))).toBe("slow");
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
