import type { JsonValue } from "@elgato/utils";

export type ButtonState =
  | "unknown"
  | "checking"
  | "healthy"
  | "slow"
  | "warning"
  | "down"
  | "config-error";

export type CheckFrequency = "manual" | "1m" | "5m" | "10m" | "30m" | "1h";

export interface CheckRecord {
  [key: string]: JsonValue;
  timestamp: string;
  ok: boolean;
  state: ButtonState;
  statusCode: number | null;
  responseTimeMs: number;
  bodyMatched: boolean | null;
  bodySnippet: string | null;
  error: string | null;
}

export interface HealthCheckSettings {
  [key: string]: JsonValue;
  serviceName: string;
  endpointUrl: string;
  checkFrequency: CheckFrequency;
  expectedStatusCode: number;
  timeoutMs: number;
  slowThresholdMs: number;
  amberAfterFailures: number;
  redAfterFailures: number;
  /** Consecutive successes before a failing service is believed again. 1 is no damping. */
  recoverAfterSuccesses: number;
  expectedBodyContains: string;
  showBodySnippetInHistory: boolean;
  // Persisted runtime state
  history: CheckRecord[];
  currentState: ButtonState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
}

export const DEFAULT_SETTINGS: HealthCheckSettings = {
  serviceName: "",
  endpointUrl: "",
  checkFrequency: "1m",
  expectedStatusCode: 200,
  timeoutMs: 5000,
  slowThresholdMs: 1000,
  amberAfterFailures: 1,
  redAfterFailures: 3,
  // 1 is the behaviour that shipped before this setting existed, so an existing button whose
  // settings predate it is unaffected by the coercion in mergeWithDefaults.
  recoverAfterSuccesses: 1,
  expectedBodyContains: "",
  showBodySnippetInHistory: false,
  history: [],
  currentState: "unknown",
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  lastCheckedAt: null,
  lastStatusCode: null,
  lastResponseTimeMs: null,
};

export interface KeyInstance {
  actionId: string;
  settings: HealthCheckSettings;
  isChecking: boolean;
  keyDownAt: number | null;
  timer: ReturnType<typeof setInterval> | null;
  /** The one-shot that fires the next due check, before the repeating clock takes over. */
  dueTimer: ReturnType<typeof setTimeout> | null;
  /** Dismisses this key's open history window; null when no window is up. */
  closeWindow: (() => void) | null;
}
