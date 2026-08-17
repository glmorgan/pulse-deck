import { buildStats, frequencyLabel, stateLabel } from "../modules/snapshot.js";
import type { ButtonState } from "../types.js";
import { BOARD_CAPACITY } from "../modules/boardIcon.js";
import { resolveService, runtimeFor } from "./board.js";
import type { BoardDefaults, BoardSettings, ServiceConfig } from "./types.js";

/**
 * What the board window shows, as plain data.
 *
 * Per-service *detail* still comes from `buildSnapshot` — the same function the single-endpoint
 * window uses — so a service's chart and table are computed by exactly one piece of code. This
 * covers only the overview: enough per service to draw a card, and no history beyond the short
 * run the sparkline needs.
 */

/**
 * A point on a card's sparkline, already classified.
 *
 * The state is worked out here rather than in the page because it depends on the service's
 * *resolved* slow threshold — the board's default unless that service overrides it — and the page
 * has no business recomputing an inheritance rule.
 */
export interface SparkPoint {
  ms: number;
  state: "ok" | "slow" | "fail";
}

export interface ServiceCard {
  id: string;
  name: string;
  url: string;
  state: ButtonState;
  stateLabel: string;
  lastResponseTimeMs: number | null;
  lastCheckedAt: string | null;
  uptimePct: number | null;
  checks: number;
  /**
   * Median of the successful checks, which is what makes the current latency mean anything.
   *
   * 1193ms is alarming next to a median of 240 and unremarkable next to a median of 1150, and the
   * card cannot say which without carrying both. A failure is excluded: the time a request took
   * to fail is not a latency.
   */
  medianMs: number | null;
  /** Successful checks slower than this service's resolved threshold, over the same window. */
  slowChecks: number;
  consecutiveFailures: number;
  /** Why it is failing, for a card that has room to say so. Null when the last check passed. */
  lastError: string | null;
  spark: SparkPoint[];
}

export interface BoardOverview {
  boardName: string;
  frequency: string;
  services: ServiceCard[];
  total: number;
  failing: number;
  slow: number;
  healthy: number;
  /** Services with no usable URL, which are not failing: they are not being checked at all. */
  misconfigured: number;
  /** How many services a board may hold, so the window can retire its own Add control. */
  capacity: number;
  /**
   * The name of the last deleted service while it can still be restored, else null.
   *
   * Held by the action rather than in settings: a deleted service must not be persisted, or every
   * board would carry the history of everything ever removed from it.
   */
  undo: string | null;
  /** The board's own configuration, for the settings form and for the "inherited" placeholders. */
  defaults: BoardDefaults;
  /** Every service's raw configuration, for the edit form. */
  configs: ServiceConfig[];
  generatedAt: number;
}

/** How many checks a card's sparkline shows. A card is ~180px wide; more than this is mush. */
const SPARK_POINTS = 24;

export function buildBoardOverview(
  settings: BoardSettings,
  undo: string | null = null
): BoardOverview {
  const services = settings.services.map((service): ServiceCard => {
    const runtime = runtimeFor(settings, service.id);
    // The service's own threshold, not the board's: a service that overrides it was being
    // measured against a number it does not use, so its slow count and its bars disagreed with
    // its own state.
    const slowThresholdMs = resolveService(settings.defaults, service, runtime).slowThresholdMs;
    const stats = buildStats(runtime.history ?? [], slowThresholdMs);
    const state: ButtonState = service.url.trim() ? runtime.currentState : "config-error";
    return {
      id: service.id,
      name: service.name || "Unnamed service",
      url: service.url,
      state,
      stateLabel: stateLabel(state),
      lastResponseTimeMs: runtime.lastResponseTimeMs,
      lastCheckedAt: runtime.lastCheckedAt,
      uptimePct: stats.uptimePct,
      checks: stats.total,
      medianMs: stats.median,
      slowChecks: stats.overThreshold,
      consecutiveFailures: runtime.consecutiveFailures,
      lastError: lastErrorOf(runtime.history ?? [], service),
      spark: (runtime.history ?? []).slice(-SPARK_POINTS).map((record) => ({
        ms: record.responseTimeMs,
        state: !record.ok ? "fail" : record.responseTimeMs > slowThresholdMs ? "slow" : "ok",
      } as SparkPoint)),
    };
  });

  return {
    boardName: settings.boardName,
    frequency: frequencyLabel(settings.defaults.checkFrequency),
    services,
    capacity: BOARD_CAPACITY,
    undo,
    defaults: settings.defaults,
    configs: settings.services,
    total: services.length,
    // Slow is not failing — it answered. Kept apart so the header can say both.
    //
    // Nor is a configuration error, which used to be counted here: nothing is wrong with the
    // endpoint, we never asked it anything. Counting it as failing put a setup mistake and a real
    // outage in the same number on a board whose whole job is telling you which you have.
    failing: services.filter((s) => s.state === "down" || s.state === "warning").length,
    misconfigured: services.filter((s) => s.state === "config-error").length,
    slow: services.filter((s) => s.state === "slow").length,
    // Counted rather than left to the header to infer. `total - failing` counted a slow service
    // as healthy as well as slow, so the three numbers summed to more than the board held. The
    // remainder here is the never-checked and the mid-check, which the header simply omits.
    healthy: services.filter((s) => s.state === "healthy").length,
    generatedAt: Date.now(),
  };
}

/**
 * The reason a service is failing, in the words the check produced.
 *
 * A card showing "Failed" says less than one showing "Expected 200 but received 503", and the
 * difference is what tells you whether to look further. A service with no URL has not failed a
 * check at all — it has never run one — so it says what is actually wrong with it.
 */
function lastErrorOf(history: { ok: boolean; error: string | null }[], service: ServiceConfig) {
  if (!service.url.trim()) return "No URL configured";
  const last = history[history.length - 1];
  if (!last || last.ok) return null;
  return last.error ?? "Check failed";
}
