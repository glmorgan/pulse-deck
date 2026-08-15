import { DEFAULT_SETTINGS, type HealthCheckSettings } from "../types.js";
import type { CellState } from "../modules/boardIcon.js";
import {
  DEFAULT_BOARD_DEFAULTS,
  DEFAULT_BOARD_SETTINGS,
  EMPTY_RUNTIME,
  type BoardDefaults,
  type BoardSettings,
  type ServiceConfig,
  type ServiceRuntime,
} from "./types.js";

/**
 * Pure board logic: merging, normalising and reading. Everything here is a function of settings,
 * so the parts that decide what gets checked and what the key shows are testable without a
 * Stream Deck, a network, or a clock.
 */

/** Ids only have to be unique within one key's settings, so this is enough. */
export function newServiceId(): string {
  return `svc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newService(name: string, url: string): ServiceConfig {
  return {
    id: newServiceId(),
    name,
    url,
    expectedStatusCode: null,
    timeoutMs: null,
    slowThresholdMs: null,
    amberAfterFailures: null,
    redAfterFailures: null,
    expectedBodyContains: null,
    showBodySnippetInHistory: null,
  };
}

/** `undefined` and `null` both mean "inherit"; 0 and "" are deliberate values and are kept. */
function inherit<T>(override: T | null | undefined, fallback: T): T {
  return override === null || override === undefined ? fallback : override;
}

/**
 * Flattens a service onto the board's defaults, producing exactly the settings shape the existing
 * single-endpoint modules already take.
 *
 * That is the point: `runHealthCheck`, `evaluateButtonState` and `buildSnapshot` are reused
 * unchanged, so a board service and a Health Check key are checked and judged by the same code.
 */
export function resolveService(
  defaults: BoardDefaults,
  service: ServiceConfig,
  runtime: ServiceRuntime = EMPTY_RUNTIME
): HealthCheckSettings {
  return {
    ...DEFAULT_SETTINGS,
    serviceName: service.name,
    endpointUrl: service.url,
    checkFrequency: defaults.checkFrequency,
    expectedStatusCode: num(inherit(service.expectedStatusCode, defaults.expectedStatusCode),
      DEFAULT_BOARD_DEFAULTS.expectedStatusCode),
    timeoutMs: num(inherit(service.timeoutMs, defaults.timeoutMs),
      DEFAULT_BOARD_DEFAULTS.timeoutMs),
    slowThresholdMs: num(inherit(service.slowThresholdMs, defaults.slowThresholdMs),
      DEFAULT_BOARD_DEFAULTS.slowThresholdMs),
    amberAfterFailures: num(inherit(service.amberAfterFailures, defaults.amberAfterFailures),
      DEFAULT_BOARD_DEFAULTS.amberAfterFailures),
    redAfterFailures: num(inherit(service.redAfterFailures, defaults.redAfterFailures),
      DEFAULT_BOARD_DEFAULTS.redAfterFailures),
    expectedBodyContains: inherit(service.expectedBodyContains, defaults.expectedBodyContains),
    showBodySnippetInHistory:
      inherit(service.showBodySnippetInHistory, defaults.showBodySnippetInHistory),
    history: runtime.history ?? [],
    currentState: runtime.currentState ?? "unknown",
    consecutiveFailures: runtime.consecutiveFailures ?? 0,
    lastCheckedAt: runtime.lastCheckedAt ?? null,
    lastStatusCode: runtime.lastStatusCode ?? null,
    lastResponseTimeMs: runtime.lastResponseTimeMs ?? null,
  };
}

/** Settings arrive from JSON and from inspector fields, which save numbers as strings. */
function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Fills in anything a saved board is missing.
 *
 * Settings written by an older build, or by hand, can be missing whole branches — and a board
 * whose `runtime` is undefined would throw on the first check rather than simply having no
 * history yet.
 */
export function mergeBoardSettings(saved: Partial<BoardSettings> | undefined): BoardSettings {
  const services = Array.isArray(saved?.services) ? saved!.services : [];
  const runtime = saved?.runtime ?? {};
  return {
    ...DEFAULT_BOARD_SETTINGS,
    boardName: saved?.boardName || DEFAULT_BOARD_SETTINGS.boardName,
    defaults: { ...DEFAULT_BOARD_DEFAULTS, ...(saved?.defaults ?? {}) },
    services,
    // Runtime for services that no longer exist is dropped here rather than accumulating
    // forever; an undo that restores a service restores its runtime alongside it.
    runtime: Object.fromEntries(
      services.map((service) => [service.id, runtime[service.id] ?? { ...EMPTY_RUNTIME }])
    ),
  };
}

export function runtimeFor(settings: BoardSettings, id: string): ServiceRuntime {
  return settings.runtime[id] ?? { ...EMPTY_RUNTIME };
}

/**
 * The key face, in list order.
 *
 * A service with no URL reads as a configuration error rather than as unknown, so a half-finished
 * entry is visible on the key instead of looking like one that has simply not run yet.
 */
export function boardCells(settings: BoardSettings): CellState[] {
  return settings.services.map((service) => {
    if (!service.url.trim()) return "config-error";
    return runtimeFor(settings, service.id).currentState;
  });
}

/** How many services are healthy, for the places that report a score rather than a grid. */
export function boardSummary(settings: BoardSettings): { total: number; failing: number } {
  const states = boardCells(settings);
  return {
    total: states.length,
    failing: states.filter((s) => s === "down" || s === "warning" || s === "config-error").length,
  };
}
