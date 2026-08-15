import { describe, it, expect } from "vitest";
import { renderBoardHtml } from "./boardWindow.js";
import { buildBoardOverview } from "./boardSnapshot.js";
import { mergeBoardSettings, newService } from "./board.js";
import type { BoardSettings } from "./types.js";
import type { CheckRecord } from "../types.js";

/**
 * Same guard as the history window's page test: this page is one large template literal, and a
 * stray backtick in it emits a script that cannot parse — which shows as a window that opens
 * completely blank, with nothing in the log, because the body stays hidden until the script marks
 * it ready.
 */

const record = (over: Partial<CheckRecord> = {}): CheckRecord => ({
  timestamp: new Date("2026-08-15T10:00:00Z").toISOString(),
  ok: true,
  state: "healthy",
  statusCode: 200,
  responseTimeMs: 120,
  bodyMatched: null,
  bodySnippet: null,
  error: null,
  ...over,
});

function boardOf(count: number, withHistory = true): BoardSettings {
  const services = Array.from({ length: count }, (_, i) =>
    newService(`Service ${i + 1}`, `https://example.test/${i}`));
  const board = mergeBoardSettings({ services } as Partial<BoardSettings>);
  if (withHistory) {
    services.forEach((service, i) => {
      board.runtime[service.id] = {
        history: [record(), record({ ok: i === 2, responseTimeMs: 900 })],
        currentState: i === 0 ? "healthy" : i === 1 ? "slow" : "down",
        consecutiveFailures: i === 2 ? 3 : 0,
        lastCheckedAt: record().timestamp,
        lastStatusCode: 200,
        lastResponseTimeMs: 120,
      };
    });
  }
  return board;
}

function scriptsIn(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

describe("the board page", () => {
  const cases: [string, BoardSettings][] = [
    ["with a full board", boardOf(9)],
    ["with one service", boardOf(1)],
    ["with no services", mergeBoardSettings(undefined)],
    ["with services that have never been checked", boardOf(3, false)],
  ];

  for (const [name, board] of cases) {
    it(`parses ${name}`, () => {
      const scripts = scriptsIn(renderBoardHtml(buildBoardOverview(board), "token"));
      expect(scripts.length).toBe(2);
      for (const src of scripts) {
        expect(() => new Function(src)).not.toThrow();
      }
    });
  }

  it("closes the template where it should", () => {
    const html = renderBoardHtml(buildBoardOverview(boardOf(4)), "t");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("escapes a board name that would otherwise close the title tag", () => {
    const board = mergeBoardSettings({
      boardName: "</title><script>bad()</script>",
    } as Partial<BoardSettings>);
    const html = renderBoardHtml(buildBoardOverview(board), "t");
    expect(html).not.toContain("<script>bad()</script>");
    expect(scriptsIn(html).length).toBe(2);
  });

  it("escapes markup inside embedded service data rather than ending the script block", () => {
    const service = newService("</script><script>bad()</script>", "https://example.test/x");
    const board = mergeBoardSettings({ services: [service] } as Partial<BoardSettings>);
    const html = renderBoardHtml(buildBoardOverview(board), "t");
    expect(html).not.toContain("<script>bad()</script>");
    for (const src of scriptsIn(html)) expect(() => new Function(src)).not.toThrow();
  });
});

// ── the overview data ──────────────────────────────────────────────────────

describe("buildBoardOverview", () => {
  it("counts failing services without counting slow ones", () => {
    const overview = buildBoardOverview(boardOf(3));
    expect(overview.total).toBe(3);
    expect(overview.slow).toBe(1);
    expect(overview.failing).toBe(1);
  });

  it("caps the sparkline at the points a card can show", () => {
    const service = newService("Busy", "https://example.test/busy");
    const board = mergeBoardSettings({ services: [service] } as Partial<BoardSettings>);
    board.runtime[service.id].history = Array.from({ length: 60 }, () => record());
    expect(buildBoardOverview(board).services[0].spark.length).toBeLessThanOrEqual(24);
  });

  it("reports a service with no URL as a configuration error", () => {
    const board = mergeBoardSettings({
      services: [newService("Blank", "")],
    } as Partial<BoardSettings>);
    expect(buildBoardOverview(board).services[0].state).toBe("config-error");
  });

  it("names an unnamed service rather than rendering an empty card", () => {
    const board = mergeBoardSettings({
      services: [newService("", "https://example.test/x")],
    } as Partial<BoardSettings>);
    expect(buildBoardOverview(board).services[0].name).toBe("Unnamed service");
  });
});
