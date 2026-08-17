import type { ButtonState, CheckRecord, HealthCheckSettings } from "../types.js";

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  bodyMatched: boolean | null;
  bodySnippet: string | null;
  error: string | null;
}

/**
 * Everything the state depends on besides the settings.
 *
 * `previousState` is here because hysteresis cannot be derived from the last check alone: "was
 * down, needs three good checks" is a fact about where the service has been, not about what just
 * happened. The counters are kept by the caller, which is also what persists them.
 */
export interface StateInputs {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  previousState: ButtonState;
  lastRecord: CheckRecord | null;
}

/** States that describe a settled reading, as against "not checked" and "being checked". */
const SETTLED: ButtonState[] = ["healthy", "slow", "warning", "down"];
const FAILING: ButtonState[] = ["warning", "down"];

/**
 * The state a service should be in, given what just happened and where it has been.
 *
 * Both directions are damped, and neither used to be quite right:
 *
 * - **Into trouble.** `amberAfterFailures` was configured, inherited and validated, and never
 *   read: any failure returned `warning` and only `down` had a threshold. Below the amber count a
 *   failure now holds the previous state rather than raising one, which is what the setting always
 *   claimed. Holding rather than returning "healthy" matters on the way back down too, or a
 *   service that was down, passed once and failed again would be promoted to healthy by failing.
 *
 * - **Out of it.** One success used to clear an outage outright, so a service alternating pass and
 *   fail alternated green and red on every round. `recoverAfterSuccesses` is the count of
 *   consecutive successes needed before a failing service is believed again. It defaults to 1,
 *   which is exactly the old behaviour.
 *
 * Recovery gates `warning` and `down` only. `slow` is a level read off the latest latency rather
 * than a fault, and one counter cannot serve both: a slow check is a success, so counting it as
 * recovery would let a still-slow service call itself healthy, and not counting it would strand a
 * service that recovered from an outage into merely being slow.
 */
export function evaluateButtonState(
  settings: HealthCheckSettings,
  inputs: StateInputs
): ButtonState {
  const { consecutiveFailures, consecutiveSuccesses, previousState, lastRecord } = inputs;
  if (!lastRecord) return "unknown";

  if (!lastRecord.ok) {
    if (consecutiveFailures >= settings.redAfterFailures) return "down";
    if (consecutiveFailures >= settings.amberAfterFailures) return "warning";
    // Not enough failures to call it. Nothing changes, in either direction. A first-ever check
    // that fails has no previous state to hold, and "unknown" would read as never checked.
    return SETTLED.includes(previousState) ? previousState : "warning";
  }

  // A success does not clear a failure on its own. The latency of this check is still recorded;
  // it simply does not get to decide the state yet.
  if (FAILING.includes(previousState) && consecutiveSuccesses < settings.recoverAfterSuccesses) {
    return previousState;
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
  if (settings.recoverAfterSuccesses < 1) {
    return "Recovery threshold must be at least 1";
  }
  return null;
}
