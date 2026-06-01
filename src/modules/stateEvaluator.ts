import type { ButtonState, CheckRecord, HealthCheckSettings } from "../types.js";

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  bodyMatched: boolean | null;
  bodySnippet: string | null;
  error: string | null;
}

export function evaluateButtonState(
  settings: HealthCheckSettings,
  consecutiveFailures: number,
  lastRecord: CheckRecord | null
): ButtonState {
  if (!lastRecord) return "unknown";

  if (!lastRecord.ok) {
    if (consecutiveFailures >= settings.redAfterFailures) return "down";
    return "warning";
  }

  if (lastRecord.responseTimeMs > settings.slowThresholdMs) return "slow";
  return "healthy";
}

export function buildCheckRecord(
  result: CheckResult,
  state: ButtonState
): CheckRecord {
  return {
    timestamp: new Date().toISOString(),
    ok: result.ok,
    state,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    bodyMatched: result.bodyMatched,
    bodySnippet: result.bodySnippet,
    error: result.error,
  };
}

export function validateSettings(settings: HealthCheckSettings): string | null {
  if (!settings.endpointUrl || settings.endpointUrl.trim() === "") {
    return "Endpoint URL is required";
  }
  try {
    const url = new URL(settings.endpointUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "URL must use http:// or https://";
    }
  } catch {
    return "Invalid URL format";
  }
  if (settings.redAfterFailures < settings.amberAfterFailures) {
    return "Red threshold must be >= amber threshold";
  }
  return null;
}
