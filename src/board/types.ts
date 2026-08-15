import type { JsonValue } from "@elgato/utils";

import type { ButtonState, CheckFrequency, CheckRecord } from "../types.js";

/**
 * A board of services on one key.
 *
 * Configuration and runtime state are kept apart, which the single-endpoint action does not do:
 * there, everything lives in one flat settings object. Here a service's URL and its 60 records
 * have very different lifetimes — the first is edited by hand, the second is rewritten on every
 * round — and keeping them separate is what lets a service be edited without touching its
 * history, and deleted with its history retained for an undo.
 */

/**
 * What a service overrides. Everything except name and URL is optional: an absent field means
 * "use the board's default", which is the whole point of the shared-defaults model — twelve
 * services should not each carry their own copy of the same timeout.
 */
export interface ServiceConfig {
  [key: string]: JsonValue;
  /** Stable across renames and edits; runtime and undo are keyed by it. */
  id: string;
  name: string;
  url: string;
  expectedStatusCode: number | null;
  timeoutMs: number | null;
  slowThresholdMs: number | null;
  amberAfterFailures: number | null;
  redAfterFailures: number | null;
  expectedBodyContains: string | null;
  showBodySnippetInHistory: boolean | null;
}

/** What checking a service produces. One of these per service, keyed by service id. */
export interface ServiceRuntime {
  [key: string]: JsonValue;
  history: CheckRecord[];
  currentState: ButtonState;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  lastResponseTimeMs: number | null;
}

/** The board's own settings, inherited by every service that does not override them. */
export interface BoardDefaults {
  [key: string]: JsonValue;
  checkFrequency: CheckFrequency;
  expectedStatusCode: number;
  timeoutMs: number;
  slowThresholdMs: number;
  amberAfterFailures: number;
  redAfterFailures: number;
  expectedBodyContains: string;
  showBodySnippetInHistory: boolean;
}

export interface BoardSettings {
  [key: string]: JsonValue;
  boardName: string;
  defaults: BoardDefaults;
  /** Order is meaningful: it is the order of the cells on the key, left to right, top to bottom. */
  services: ServiceConfig[];
  /** Keyed by service id, so reordering and renaming leave history alone. */
  runtime: Record<string, ServiceRuntime>;
}

export const DEFAULT_BOARD_DEFAULTS: BoardDefaults = {
  checkFrequency: "5m",
  expectedStatusCode: 200,
  timeoutMs: 5000,
  slowThresholdMs: 1000,
  amberAfterFailures: 1,
  redAfterFailures: 3,
  expectedBodyContains: "",
  showBodySnippetInHistory: false,
};

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  boardName: "Health board",
  defaults: DEFAULT_BOARD_DEFAULTS,
  services: [],
  runtime: {},
};

export const EMPTY_RUNTIME: ServiceRuntime = {
  history: [],
  currentState: "unknown",
  consecutiveFailures: 0,
  lastCheckedAt: null,
  lastStatusCode: null,
  lastResponseTimeMs: null,
};
