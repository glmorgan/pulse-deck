import type { ButtonState, CheckRecord, HealthCheckSettings } from "../types.js";

/**
 * Everything the history window shows, as plain data.
 *
 * Built here rather than inside the window module so the numbers on screen are testable without
 * rendering a page, and so the window never reaches into `HealthCheckSettings` — it is handed a
 * snapshot and draws it, which is also what makes the live refresh a single call.
 */

export interface SnapshotCheck {
  timestamp: string;
  ok: boolean;
  state: ButtonState;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
  bodySnippet: string | null;
}

export interface SnapshotStats {
  total: number;
  ok: number;
  failed: number;
  /** Successful checks as a percentage, or null with no history. */
  uptimePct: number | null;
  /**
   * Latency figures cover **successful checks only**. A timeout contributes its full timeout
   * value and a refused connection contributes a handful of milliseconds, so including failures
   * would move the median in both directions for reasons that have nothing to do with speed.
   */
  median: number | null;
  /**
   * Successful checks that came back slower than the slow threshold.
   *
   * This replaced a 95th percentile. p95 is the right metric for request latency measured in
   * thousands of samples; over a window of at most 60 spot checks, nearest-rank p95 is simply
   * the third-slowest reading, and on a young history it *is* the slowest — the same number the
   * tile already printed underneath it. A count of threshold breaches is honest at this sample
   * size and is tied to the setting that actually drives the amber state.
   */
  overThreshold: number;
  fastest: number | null;
  slowest: number | null;
  average: number | null;
  /** Successful checks the latency figures were computed from. */
  latencySamples: number;
}

export interface HistorySnapshot {
  serviceName: string;
  endpointUrl: string;
  state: ButtonState;
  stateLabel: string;
  consecutiveFailures: number;
  checkFrequency: string;
  expectedStatusCode: number;
  timeoutMs: number;
  slowThresholdMs: number;
  lastCheckedAt: string | null;
  /** Oldest first, so the chart reads left to right without reversing. */
  checks: SnapshotCheck[];
  stats: SnapshotStats;
  /** Changes on every rebuild; the page repaints only when it moves. */
  generatedAt: number;
}

const STATE_LABELS: Record<ButtonState, string> = {
  unknown: "Unknown",
  checking: "Checking",
  healthy: "Healthy",
  slow: "Slow",
  warning: "Warning",
  down: "Down",
  "config-error": "Configuration error",
};

export function stateLabel(state: string): string {
  return STATE_LABELS[state as ButtonState] ?? state;
}

const FREQUENCY_LABELS: Record<string, string> = {
  manual: "manual only",
  "1m": "every minute",
  "5m": "every 5 minutes",
  "10m": "every 10 minutes",
  "30m": "every 30 minutes",
  "1h": "hourly",
};

export function frequencyLabel(frequency: string): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

/**
 * Nearest-rank percentile, which is the right choice for a sample this small: interpolating
 * between two of 60 checks invents a latency that was never measured.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export function buildStats(
  history: CheckRecord[],
  slowThresholdMs: number
): SnapshotStats {
  const ok = history.filter((r) => r.ok);
  const latencies = ok.map((r) => r.responseTimeMs);
  const total = history.length;
  return {
    total,
    ok: ok.length,
    failed: total - ok.length,
    uptimePct: total === 0 ? null : Math.round((ok.length / total) * 1000) / 10,
    median: percentile(latencies, 50),
    // Only successful checks can be slow: a failure is a failure, however long it took to fail.
    overThreshold: latencies.filter((ms) => ms > slowThresholdMs).length,
    fastest: latencies.length ? Math.min(...latencies) : null,
    slowest: latencies.length ? Math.max(...latencies) : null,
    average: latencies.length
      ? Math.round(latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length)
      : null,
    latencySamples: latencies.length,
  };
}

export function buildSnapshot(settings: HealthCheckSettings): HistorySnapshot {
  const history = settings.history ?? [];
  return {
    serviceName: settings.serviceName || "Unnamed service",
    endpointUrl: settings.endpointUrl,
    state: settings.currentState,
    stateLabel: stateLabel(settings.currentState),
    consecutiveFailures: settings.consecutiveFailures,
    checkFrequency: frequencyLabel(settings.checkFrequency),
    expectedStatusCode: settings.expectedStatusCode,
    timeoutMs: settings.timeoutMs,
    slowThresholdMs: settings.slowThresholdMs,
    lastCheckedAt: settings.lastCheckedAt,
    checks: history.map((r) => ({
      timestamp: r.timestamp,
      ok: r.ok,
      state: r.state,
      statusCode: r.statusCode,
      responseTimeMs: r.responseTimeMs,
      error: r.error,
      // Only carried when the user asked for it — the body of a health endpoint can hold more
      // than a status word, and this ends up in a window anyone walking past can read.
      bodySnippet: settings.showBodySnippetInHistory ? r.bodySnippet : null,
    })),
    stats: buildStats(history, settings.slowThresholdMs),
    generatedAt: Date.now(),
  };
}
