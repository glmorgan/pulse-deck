// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

import { renderBoardHtml } from "./board/boardWindow.js";
import { buildBoardOverview } from "./board/boardSnapshot.js";
import { mergeBoardSettings, newService } from "./board/board.js";
import type { BoardSettings } from "./board/types.js";
import { renderHistoryHtml } from "./modules/historyWindow.js";
import { buildSnapshot } from "./modules/snapshot.js";
import { DEFAULT_SETTINGS, type CheckRecord, type HealthCheckSettings } from "./types.js";

/**
 * Runs the pages, rather than only parsing them.
 *
 * `historyWindow.test.ts` and `boardWindow.test.ts` check that every script block parses, which
 * catches a stray backtick. It cannot catch a name that is never defined at runtime, and that has
 * shipped twice: a form referencing a field that was never created, and an icon constant used
 * inside the page script when it only exists in TypeScript. Both produced a window that was
 * blank or a button that silently did nothing.
 *
 * So these tests put the markup in a document, execute the scripts, and assert that the thing
 * actually rendered. An exception anywhere in that path fails the test with its own stack.
 */

const record = (over: Partial<CheckRecord> = {}): CheckRecord => ({
  timestamp: new Date("2026-08-18T10:00:00Z").toISOString(),
  ok: true,
  state: "healthy",
  statusCode: 200,
  responseTimeMs: 120,
  bodyMatched: null,
  bodySnippet: null,
  error: null,
  ...over,
});

/** A board with a healthy service, a slow one and a failing one. */
function board(): BoardSettings {
  const services = [
    newService("Payments", "https://payments.test/health"),
    newService("Orders", "https://orders.test/health"),
    newService("Search", "https://search.test/health"),
  ];
  const settings = mergeBoardSettings({ services } as Partial<BoardSettings>);
  const states = ["healthy", "slow", "down"] as const;
  services.forEach((service, i) => {
    settings.runtime[service.id] = {
      history: [record(), record({ ok: i === 2 ? false : true, responseTimeMs: 900 })],
      currentState: states[i],
      consecutiveFailures: i === 2 ? 3 : 0,
      consecutiveSuccesses: 0,
      lastCheckedAt: record().timestamp,
      lastStatusCode: 200,
      lastResponseTimeMs: 120,
    };
  });
  return settings;
}

function singleService(): HealthCheckSettings {
  return {
    ...DEFAULT_SETTINGS,
    serviceName: "Payments",
    endpointUrl: "https://payments.test/health",
    currentState: "healthy",
    history: [record(), record({ responseTimeMs: 1500 }), record({ ok: false, error: "Timed out" })],
  };
}

/**
 * Puts a page in the document and runs its scripts.
 *
 * Scripts inserted through innerHTML never execute, which is what makes this deliberate rather
 * than automatic: each block is run in turn, so a throw lands in the test.
 */
function run(html: string): { fetches: Record<string, unknown>[] } {
  const fetches: Record<string, unknown>[] = [];
  // The pages talk to their own server. Nothing here should reach a network.
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: { body?: string }) => {
    if (init?.body) fetches.push(JSON.parse(init.body) as Record<string, unknown>);
    return { json: async () => ({}) };
  }));

  // What the native host injects. Without it the head script tries to resize a window jsdom does
  // not have, which is noise rather than a failure.
  vi.stubGlobal("__nativeHost", true);
  (window as unknown as { __nativeHost: boolean }).__nativeHost = true;

  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<html[^>]*>/i, "")
    .replace(/<\/html>[\s\S]*$/i, "");

  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    // Indirect eval so the page's own `var` declarations do not leak into module scope.
    new Function(match[1])();
  }
  return { fetches };
}

beforeEach(() => {
  document.documentElement.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("the board page, running", () => {
  it("renders the rail and a card per service", () => {
    run(renderBoardHtml(buildBoardOverview(board()), "t"));

    const rows = document.querySelectorAll("#list .row[data-id]");
    expect(rows).toHaveLength(3);
    expect(document.querySelectorAll("#detail .cardbtn")).toHaveLength(3);
    expect(document.getElementById("board-name")?.textContent).toBe("Health board");
  });

  it("gives every row a grip, which is the part that says it can be dragged", () => {
    // The grip shipped as a bare identifier the page could not resolve, which threw inside
    // paintRail and left the whole window blank.
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    const grips = document.querySelectorAll("#list .row[data-id] .grip svg");
    expect(grips).toHaveLength(3);
  });

  it("marks a failing service on its card", () => {
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    const failing = document.querySelectorAll('#detail .cardbtn[data-state="down"]');
    expect(failing).toHaveLength(1);
  });

  it("switches the pane to a service when its row is clicked", () => {
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    const row = document.querySelector("#list .row[data-id]") as HTMLElement;
    row.click();

    const frame = document.querySelector("#detail iframe");
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute("data-id")).toBe(row.getAttribute("data-id"));
    // The card grid belongs to the view we left.
    expect(document.querySelectorAll("#detail .cardbtn")).toHaveLength(0);
  });

  it("opens the add form with its fields, including headers", () => {
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    (document.getElementById("add") as HTMLElement).click();

    expect(document.getElementById("title")?.textContent).toBe("Add service");
    expect(document.querySelectorAll("#detail .field").length).toBeGreaterThan(4);
    expect(document.querySelector("#detail .headers-body")).not.toBeNull();
  });

  it("opens board settings with its fields", () => {
    // The settings form once referenced a headers field it never created, so Save threw and the
    // whole form was dead. Opening it here is what would have caught that.
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    (document.getElementById("settings") as HTMLElement).click();

    expect(document.getElementById("title")?.textContent).toBe("Board settings");
    expect(document.querySelector("#detail .headers-body")).not.toBeNull();
  });

  it("sends the board settings when saved", () => {
    const { fetches } = run(renderBoardHtml(buildBoardOverview(board()), "t"));
    (document.getElementById("settings") as HTMLElement).click();
    // Array.from rather than a spread: the tsconfig lib does not include DOM.Iterable, so a
    // NodeList is not iterable as far as the compiler is concerned.
    const save = Array.from(document.querySelectorAll("#detail button"))
      .find((b) => b.textContent === "Save settings") as HTMLElement;
    save.click();

    const update = fetches.find((f) => f.type === "update-board");
    expect(update).toBeDefined();
    expect((update as { update: { defaults: Record<string, unknown> } }).update.defaults)
      .toHaveProperty("checkFrequency");
  });

  it("prefills the form when a service is duplicated", () => {
    run(renderBoardHtml(buildBoardOverview(board()), "t"));
    (document.querySelector("#list .row[data-id]") as HTMLElement).click();
    (document.getElementById("duplicate") as HTMLElement).click();

    expect(document.getElementById("title")?.textContent).toBe("Duplicate service");
    const inputs = document.querySelectorAll<HTMLInputElement>("#detail input[type=text]");
    expect(inputs[0].value).toBe("Payments copy");
    expect(inputs[1].value).toBe("https://payments.test/health");
  });

  it("renders an empty board without falling over", () => {
    run(renderBoardHtml(buildBoardOverview(mergeBoardSettings(undefined)), "t"));
    expect(document.querySelectorAll("#list .row[data-id]")).toHaveLength(0);
    expect(document.querySelector("#detail")?.textContent).toContain("No services");
  });
});

describe("the history page, running", () => {
  it("renders the tiles, the chart and the table", () => {
    run(renderHistoryHtml(buildSnapshot(singleService()), "t", { canCheck: true }));

    expect(document.querySelectorAll("#tiles .tile")).toHaveLength(4);
    expect(document.querySelector("#plot svg")).not.toBeNull();
    expect(document.querySelectorAll("#rows tr").length).toBeGreaterThan(0);
  });

  it("filters the table to failures", () => {
    run(renderHistoryHtml(buildSnapshot(singleService()), "t", { canCheck: true }));
    const failed = document.querySelector('#filter button[data-f="failed"]') as HTMLElement;
    failed.click();

    const rows = document.querySelectorAll("#rows tr");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Failed");
  });

  it("drops its own chrome when embedded, since the board supplies it", () => {
    run(renderHistoryHtml(buildSnapshot(singleService()), "t", {
      canCheck: false,
      embedded: true,
      scope: "svc_1",
    }));

    expect(document.querySelector("header")).toBeNull();
    expect(document.querySelector("footer")).toBeNull();
    expect(document.querySelector("#plot svg")).not.toBeNull();
  });
});
