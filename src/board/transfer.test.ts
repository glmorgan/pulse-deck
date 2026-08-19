import { describe, it, expect } from "vitest";
import {
  BOARD_FILE_VERSION,
  differingDefaults,
  exportBoard,
  headersNeedingValues,
  parseBoardFile,
  pinDefaults,
} from "./transfer.js";
import { mergeBoardSettings, newService } from "./board.js";
import {
  DEFAULT_BOARD_DEFAULTS,
  type BoardDefaults,
  type BoardSettings,
  type ServiceConfig,
} from "./types.js";

function board(): BoardSettings {
  const services = [
    newService("Payments", "https://payments.test/health"),
    newService("Orders", "https://orders.test/health"),
  ];
  services[0].timeoutMs = 9000;
  services[0].headers = [{ name: "X-Api-Key", value: "abc" }];
  const settings = mergeBoardSettings({
    boardName: "Production",
    services,
  } as Partial<BoardSettings>);
  settings.runtime[services[0].id].history = [{
    timestamp: new Date().toISOString(),
    ok: true,
    state: "healthy",
    statusCode: 200,
    responseTimeMs: 100,
    bodyMatched: null,
    bodySnippet: null,
    error: null,
  }];
  return settings;
}

// ── exporting ──────────────────────────────────────────────────────────────

describe("exportBoard", () => {
  it("writes only the services that were chosen", () => {
    const settings = board();
    const file = exportBoard(settings, [settings.services[1].id]);
    expect(file.services).toHaveLength(1);
    expect(file.services[0].name).toBe("Orders");
  });

  it("keeps board order, not the order they were picked", () => {
    const settings = board();
    const ids = [settings.services[1].id, settings.services[0].id];
    expect(exportBoard(settings, ids).services.map((s) => s.name)).toEqual(["Payments", "Orders"]);
  });

  it("carries overrides", () => {
    const settings = board();
    const file = exportBoard(settings, settings.services.map((s) => s.id));
    expect(file.services[0].timeoutMs).toBe(9000);
  });

  it("writes header values, since an export missing its credentials is not a backup", () => {
    const settings = board();
    const file = exportBoard(settings, settings.services.map((s) => s.id));
    expect(file.services[0].headers).toEqual([{ name: "X-Api-Key", value: "abc" }]);
  });

  it("keeps header names but holds their values back when asked", () => {
    // For a file going to somebody else. The name still travels, so the import can say what
    // needs filling in.
    const settings = board();
    settings.defaults.headers = [{ name: "Authorization", value: "Bearer tok" }];
    const ids = settings.services.map((s) => s.id);
    const file = exportBoard(settings, ids, { includeHeaderValues: false });
    expect(file.services[0].headers).toEqual([{ name: "X-Api-Key", value: "" }]);
    expect(file.defaults.headers).toEqual([{ name: "Authorization", value: "" }]);
    expect(JSON.stringify(file)).not.toContain("Bearer tok");
  });

  it("leaves a service that inherits its headers inheriting them", () => {
    const settings = board();
    const file = exportBoard(settings, settings.services.map((s) => s.id));
    expect(file.services[1].headers).toBeNull();
  });

  it("copes with a service saved before headers existed", () => {
    // No field at all rather than null, which threw on the way to a stripped export. Boards
    // predate the headers feature, and nothing normalises a saved service on the way in.
    const settings = board();
    delete (settings.services[0] as Partial<ServiceConfig>).headers;
    delete (settings.defaults as Partial<BoardDefaults>).headers;
    const ids = settings.services.map((s) => s.id);
    for (const keep of [true, false]) {
      const file = exportBoard(settings, ids, { includeHeaderValues: keep });
      expect(file.services[0].headers).toBeNull();
      expect(file.defaults.headers).toEqual([]);
    }
  });

  it("leaves history behind", () => {
    const settings = board();
    const text = JSON.stringify(exportBoard(settings, settings.services.map((s) => s.id)));
    // The whole point of configuration only: no timestamps, no status codes, no error text.
    expect(text).not.toContain("responseTimeMs");
    expect(text).not.toContain("history");
  });

  it("stamps the format version, so a later one can refuse it", () => {
    const settings = board();
    expect(exportBoard(settings, []).pulsedeck).toBe(BOARD_FILE_VERSION);
  });
});

// ── reading ────────────────────────────────────────────────────────────────

describe("parseBoardFile", () => {
  const roundTrip = () => {
    const settings = board();
    return JSON.stringify(exportBoard(settings, settings.services.map((s) => s.id)));
  };

  it("reads back what it wrote", () => {
    const parsed = parseBoardFile(roundTrip());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.services.map((s) => s.name)).toEqual(["Payments", "Orders"]);
    expect(parsed.file.boardName).toBe("Production");
  });

  it("gives every imported service a new id", () => {
    // Importing a file into the board it came from must add services, not collide with them.
    const settings = board();
    const parsed = parseBoardFile(roundTrip());
    if (!parsed.ok) throw new Error("expected a readable file");
    const existing = settings.services.map((s) => s.id);
    for (const service of parsed.file.services) expect(existing).not.toContain(service.id);
  });

  it("refuses something that is not JSON", () => {
    expect(parseBoardFile("not json at all")).toMatchObject({ ok: false });
  });

  it("refuses a JSON file that is not a board", () => {
    expect(parseBoardFile('{"hello":"world"}')).toMatchObject({ ok: false });
  });

  it("refuses a file from a newer format", () => {
    const file = JSON.parse(roundTrip()) as Record<string, unknown>;
    file.pulsedeck = BOARD_FILE_VERSION + 1;
    const parsed = parseBoardFile(JSON.stringify(file));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain("newer version");
  });

  it("drops a service with no URL rather than importing a broken one", () => {
    const file = JSON.parse(roundTrip()) as { services: Record<string, unknown>[] };
    file.services.push({ name: "Broken" });
    const parsed = parseBoardFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error("expected a readable file");
    expect(parsed.file.services.map((s) => s.name)).not.toContain("Broken");
  });

  it("ignores fields it does not recognise", () => {
    // A file is an ordinary document someone may have edited. Nothing unknown reaches settings.
    const file = JSON.parse(roundTrip()) as { services: Record<string, unknown>[] };
    file.services[0].somethingElse = "should not survive";
    const parsed = parseBoardFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error("expected a readable file");
    expect(Object.keys(parsed.file.services[0])).not.toContain("somethingElse");
  });

  it("reads a hand written minimum: a version and a URL", () => {
    const parsed = parseBoardFile('{"pulsedeck":1,"services":[{"url":"https://a.test/h"}]}');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.services[0].timeoutMs).toBeNull();
    expect(parsed.file.defaults.timeoutMs).toBe(DEFAULT_BOARD_DEFAULTS.timeoutMs);
  });
});

// ── defaults that differ ───────────────────────────────────────────────────

describe("differingDefaults", () => {
  it("says nothing when the two boards agree", () => {
    expect(differingDefaults(DEFAULT_BOARD_DEFAULTS, DEFAULT_BOARD_DEFAULTS)).toEqual([]);
  });

  it("names each difference, since a service inherits from wherever it lands", () => {
    const from = { ...DEFAULT_BOARD_DEFAULTS, timeoutMs: 9000, checkFrequency: "1m" as const };
    const differences = differingDefaults(from, DEFAULT_BOARD_DEFAULTS);
    expect(differences.map((d) => d.key).sort()).toEqual(["checkFrequency", "timeoutMs"]);
  });

  it("describes values the way the window shows them, not as raw fields", () => {
    const from = { ...DEFAULT_BOARD_DEFAULTS, timeoutMs: 9000, checkFrequency: "1m" as const };
    const differences = differingDefaults(from, DEFAULT_BOARD_DEFAULTS);
    const timeout = differences.find((d) => d.key === "timeoutMs");
    expect(timeout).toMatchObject({ label: "Timeout", from: "9s", to: "5s" });
    expect(differences.find((d) => d.key === "checkFrequency")?.from).toBe("every minute");
  });

  it("notices headers, which a compared string would have missed", () => {
    const from = { ...DEFAULT_BOARD_DEFAULTS, headers: [{ name: "X-Api-Key", value: "" }] };
    const differences = differingDefaults(from, DEFAULT_BOARD_DEFAULTS);
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({ key: "headers", from: "X-Api-Key", to: "none" });
  });

  it("marks frequency as the one thing that cannot travel", () => {
    // There is nowhere on a service to put a frequency: the board checks in one round.
    const from = { ...DEFAULT_BOARD_DEFAULTS, timeoutMs: 9000, checkFrequency: "1m" as const };
    const differences = differingDefaults(from, DEFAULT_BOARD_DEFAULTS);
    expect(differences.find((d) => d.key === "checkFrequency")?.pinnable).toBe(false);
    expect(differences.find((d) => d.key === "timeoutMs")?.pinnable).toBe(true);
  });
});

// ── keeping the file's values ──────────────────────────────────────────────

describe("pinDefaults", () => {
  const file = { ...DEFAULT_BOARD_DEFAULTS, timeoutMs: 9000, slowThresholdMs: 2000 };

  it("writes the file's value where the service inherits", () => {
    const services = [newService("Payments", "https://payments.test/h")];
    const pinned = pinDefaults(services, file, ["timeoutMs"]);
    expect(pinned[0].timeoutMs).toBe(9000);
  });

  it("leaves fields that were not named alone, so the board still governs them", () => {
    const services = [newService("Payments", "https://payments.test/h")];
    const pinned = pinDefaults(services, file, ["timeoutMs"]);
    expect(pinned[0].slowThresholdMs).toBeNull();
  });

  it("does not overwrite a service's own override", () => {
    const services = [newService("Payments", "https://payments.test/h")];
    services[0].timeoutMs = 1000;
    expect(pinDefaults(services, file, ["timeoutMs"])[0].timeoutMs).toBe(1000);
  });

  it("ignores frequency, which a service cannot hold", () => {
    const services = [newService("Payments", "https://payments.test/h")];
    const pinned = pinDefaults(services, file, ["checkFrequency"]);
    expect(pinned[0].checkFrequency).toBeUndefined();
  });

  it("carries the board's headers onto services that inherited them", () => {
    // Otherwise an imported service silently loses the auth header it was checking with.
    const withHeaders = { ...file, headers: [{ name: "X-Api-Key", value: "abc" }] };
    const services = [newService("Payments", "https://payments.test/h")];
    const pinned = pinDefaults(services, withHeaders, ["headers"]);
    expect(pinned[0].headers).toEqual([{ name: "X-Api-Key", value: "abc" }]);
  });

  it("leaves the originals untouched", () => {
    const services = [newService("Payments", "https://payments.test/h")];
    pinDefaults(services, file, ["timeoutMs"]);
    expect(services[0].timeoutMs).toBeNull();
  });
});

// ── headers with no value ──────────────────────────────────────────────────

describe("headersNeedingValues", () => {
  it("names what an export held back, so the import can say what to fill in", () => {
    const settings = board();
    settings.defaults.headers = [{ name: "Authorization", value: "Bearer tok" }];
    const ids = settings.services.map((s) => s.id);
    const file = exportBoard(settings, ids, { includeHeaderValues: false });
    expect(headersNeedingValues(file).sort()).toEqual(["Authorization", "X-Api-Key"]);
  });

  it("says nothing about an ordinary export, which carries its values", () => {
    const settings = board();
    expect(headersNeedingValues(exportBoard(settings, settings.services.map((s) => s.id))))
      .toEqual([]);
  });
});
