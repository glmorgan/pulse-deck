import { newServiceId } from "./board.js";
import { DEFAULT_BOARD_DEFAULTS, type BoardDefaults, type BoardSettings, type ServiceConfig } from "./types.js";
import { frequencyLabel } from "../modules/snapshot.js";
import type { HeaderPair } from "../types.js";

/**
 * Reading and writing a board as a file.
 *
 * Configuration only: services and the board's defaults, never runtime. History is per machine,
 * is by far the largest part of a board's settings, and carries timestamps and error text from
 * somebody's infrastructure. A file is meant to be reviewable, committable and sendable.
 */

/** Bumped only for a change a previous version could not read correctly. */
export const BOARD_FILE_VERSION = 1;

export interface BoardFile {
  pulsedeck: number;
  exportedAt: string;
  boardName: string;
  defaults: BoardDefaults;
  services: ServiceConfig[];
}

export type ExportOptions = {
  /**
   * On unless asked otherwise: an export is usually a backup or a move to another machine, and a
   * file that quietly leaves the credentials out is not a backup. That failure is invisible until
   * the imported board starts failing, by which time the original may be gone.
   *
   * Turning it off writes the header names with empty values, for a file going to somebody else.
   * The names always travel, so the import can say what has to be filled in.
   */
  includeHeaderValues?: boolean;
};

/**
 * Undefined counts as absent, not just null: a service saved before headers existed has no such
 * field at all, and `resolveService` has always treated the two the same.
 */
function sealHeaders(
  headers: HeaderPair[] | null | undefined,
  keep: boolean
): HeaderPair[] | null {
  if (!headers) return null;
  if (keep) return headers;
  return headers.map((header) => ({ name: header.name, value: "" }));
}

export function exportBoard(
  settings: BoardSettings,
  ids: string[],
  options: ExportOptions = {}
): BoardFile {
  const wanted = new Set(ids);
  const keep = options.includeHeaderValues !== false;
  return {
    pulsedeck: BOARD_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    boardName: settings.boardName,
    defaults: {
      ...settings.defaults,
      headers: sealHeaders(settings.defaults.headers, keep) ?? [],
    },
    // Export order follows the board, not the order they were ticked, so a file reads the way the
    // key does.
    services: settings.services
      .filter((service) => wanted.has(service.id))
      .map((service) => ({ ...service, headers: sealHeaders(service.headers, keep) })),
  };
}

/** Every header a board would send, board level and service level together. */
export function boardHeaderNames(settings: BoardSettings): string[] {
  const names = new Set<string>();
  for (const header of settings.defaults.headers ?? []) {
    if (header?.name) names.add(header.name);
  }
  for (const service of settings.services) {
    for (const header of service.headers ?? []) if (header?.name) names.add(header.name);
  }
  return [...names];
}

/** Header names that arrived without a value, so the import can say what still needs one. */
export function headersNeedingValues(file: BoardFile): string[] {
  const names = new Set<string>();
  const scan = (headers: HeaderPair[] | null | undefined): void => {
    for (const header of headers ?? []) {
      if (header?.name && !String(header.value ?? "").trim()) names.add(header.name);
    }
  };
  scan(file.defaults.headers);
  for (const service of file.services) scan(service.headers);
  return [...names];
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Overrides are `null` when absent, which is what "inherit" means everywhere else. */
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalHeaders(value: unknown): HeaderPair[] | null {
  if (!Array.isArray(value)) return null;
  const headers = value
    .filter((row): row is { name: unknown; value: unknown } => !!row && typeof row === "object")
    .map((row) => ({ name: str(row.name), value: str(row.value) }))
    .filter((row) => row.name !== "");
  return headers.length ? headers : null;
}

/**
 * Rebuilds a service from a file, field by field.
 *
 * Deliberately not a spread of whatever the file held: a board file is an ordinary JSON document
 * that someone may have hand-edited, and anything unrecognised has no business reaching settings
 * that get persisted and merged. Every service also takes a fresh id, so importing the same file
 * twice gives two services rather than one that silently overwrites the other.
 */
function readService(raw: unknown): ServiceConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const url = str(source.url).trim();
  if (!url) return null;
  return {
    id: newServiceId(),
    name: str(source.name).trim(),
    url,
    expectedStatusCode: optionalNumber(source.expectedStatusCode),
    timeoutMs: optionalNumber(source.timeoutMs),
    slowThresholdMs: optionalNumber(source.slowThresholdMs),
    amberAfterFailures: optionalNumber(source.amberAfterFailures),
    redAfterFailures: optionalNumber(source.redAfterFailures),
    recoverAfterSuccesses: optionalNumber(source.recoverAfterSuccesses),
    expectedBodyContains:
      typeof source.expectedBodyContains === "string" ? source.expectedBodyContains : null,
    showBodySnippetInHistory:
      typeof source.showBodySnippetInHistory === "boolean"
        ? source.showBodySnippetInHistory
        : null,
    headers: optionalHeaders(source.headers),
  };
}

export type ParsedBoardFile =
  | { ok: true; file: BoardFile }
  | { ok: false; error: string };

/**
 * Reads a file's text, refusing anything it cannot make sense of.
 *
 * The messages are what the window shows, so they say what is wrong with the file rather than
 * naming a parser.
 */
export function parseBoardFile(text: string): ParsedBoardFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "That file does not contain a board." };
  }

  const source = raw as Record<string, unknown>;
  const version = Number(source.pulsedeck);
  if (!Number.isFinite(version)) {
    return { ok: false, error: "That file was not exported from PulseDeck." };
  }
  if (version > BOARD_FILE_VERSION) {
    return {
      ok: false,
      error: `That file was written by a newer version of PulseDeck (format ${version}).`,
    };
  }
  if (!Array.isArray(source.services)) {
    return { ok: false, error: "That file has no services in it." };
  }

  const services = source.services
    .map(readService)
    .filter((service): service is ServiceConfig => service !== null);
  if (!services.length) {
    return { ok: false, error: "That file has no services with a URL in it." };
  }

  const savedDefaults = (source.defaults ?? {}) as Partial<BoardDefaults>;
  return {
    ok: true,
    file: {
      pulsedeck: version,
      exportedAt: str(source.exportedAt),
      boardName: str(source.boardName, "Imported board"),
      defaults: { ...DEFAULT_BOARD_DEFAULTS, ...savedDefaults },
      services,
    },
  };
}

/**
 * Fields a service can hold itself, so a file's value for them can be kept on import.
 *
 * `checkFrequency` is missing on purpose: the board checks its services in one round, so there is
 * nowhere on a service to put a different frequency.
 */
const PINNABLE: string[] = [
  "expectedStatusCode",
  "timeoutMs",
  "slowThresholdMs",
  "amberAfterFailures",
  "redAfterFailures",
  "recoverAfterSuccesses",
  "expectedBodyContains",
  "headers",
];

const COMPARED: (keyof BoardDefaults)[] = [
  "checkFrequency",
  "expectedStatusCode",
  "timeoutMs",
  "slowThresholdMs",
  "amberAfterFailures",
  "redAfterFailures",
  "recoverAfterSuccesses",
  "expectedBodyContains",
  "headers",
];

const LABELS: Record<string, string> = {
  checkFrequency: "Frequency",
  expectedStatusCode: "Expected status",
  timeoutMs: "Timeout",
  slowThresholdMs: "Slow after",
  amberAfterFailures: "Amber after",
  redAfterFailures: "Red after",
  recoverAfterSuccesses: "Recover after",
  expectedBodyContains: "Body contains",
  headers: "Headers",
};

function seconds(value: unknown): string {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return String(value);
  return ms % 1000 === 0 ? `${ms / 1000}s` : `${ms}ms`;
}

function plural(value: unknown, one: string, many: string): string {
  return `${value} ${Number(value) === 1 ? one : many}`;
}

/** Values as the window shows them, since a raw field name and a raw number explain nothing. */
function describe(key: string, value: unknown): string {
  switch (key) {
    case "checkFrequency":
      return frequencyLabel(String(value));
    case "timeoutMs":
    case "slowThresholdMs":
      return seconds(value);
    case "amberAfterFailures":
    case "redAfterFailures":
      return plural(value, "failure", "failures");
    case "recoverAfterSuccesses":
      return plural(value, "success", "successes");
    case "expectedBodyContains":
      return String(value ?? "").trim() ? `"${String(value)}"` : "nothing";
    case "headers": {
      const headers = (value as HeaderPair[] | null) ?? [];
      return headers.length ? headers.map((header) => header.name).join(", ") : "none";
    }
    default:
      return String(value);
  }
}

export type DefaultDifference = {
  key: string;
  label: string;
  from: string;
  to: string;
  /** Whether keeping the file's value is possible, which for frequency it is not. */
  pinnable: boolean;
};

/**
 * Which of a file's defaults differ from the board being imported into.
 *
 * A service that overrides nothing behaves according to its board, so the same service can check
 * differently once imported. The window shows this and lets the import decide, rather than
 * adopting the file's defaults, which would alter every service already on the board.
 */
export function differingDefaults(file: BoardDefaults, board: BoardDefaults): DefaultDifference[] {
  const differences: DefaultDifference[] = [];
  for (const key of COMPARED) {
    if (JSON.stringify(file[key] ?? null) === JSON.stringify(board[key] ?? null)) continue;
    differences.push({
      key: String(key),
      label: LABELS[key] ?? String(key),
      from: describe(String(key), file[key]),
      to: describe(String(key), board[key]),
      pinnable: PINNABLE.includes(String(key)),
    });
  }
  return differences;
}

/**
 * Writes the file's defaults onto imported services, for the named fields only.
 *
 * Only the fields that differ, and only where the service inherits. Pinning every field would
 * make each imported service a full copy of its old board's settings, so the board it lands on
 * would no longer govern it, which is the opposite of what defaults are for.
 */
export function pinDefaults(
  services: ServiceConfig[],
  defaults: BoardDefaults,
  keys: string[]
): ServiceConfig[] {
  const pin = keys.filter((key) => PINNABLE.includes(key));
  if (!pin.length) return services;
  return services.map((service) => {
    const pinned = { ...service };
    for (const key of pin) {
      if (pinned[key] === null || pinned[key] === undefined) pinned[key] = defaults[key];
    }
    return pinned;
  });
}
