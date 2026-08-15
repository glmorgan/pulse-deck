import { describe, it, expect } from "vitest";
import { renderHistoryHtml } from "./historyWindow.js";
import { buildSnapshot } from "./snapshot.js";
import { DEFAULT_SETTINGS, type CheckRecord, type HealthCheckSettings } from "../types.js";

/**
 * The window's page is one large template literal holding HTML, CSS and the client script.
 *
 * A stray backtick anywhere inside it ends the string early. Sometimes that is a compile error,
 * which is loud; sometimes it emits a page whose script cannot parse, which is silent — and the
 * window then opens **completely blank**, because the body stays hidden until the script marks
 * it ready and the page's own error reporter is installed by the script that failed.
 *
 * These tests parse what the template actually produces, so that is caught by `npm test` rather
 * than by opening the window.
 */

const record = (over: Partial<CheckRecord> = {}): CheckRecord => ({
  timestamp: new Date("2026-08-14T10:00:00Z").toISOString(),
  ok: true,
  state: "healthy",
  statusCode: 200,
  responseTimeMs: 120,
  bodyMatched: null,
  bodySnippet: null,
  error: null,
  ...over,
});

const settings = (over: Partial<HealthCheckSettings> = {}): HealthCheckSettings => ({
  ...DEFAULT_SETTINGS,
  serviceName: "Orders API",
  endpointUrl: "https://example.test/health",
  currentState: "healthy",
  ...over,
});

const mixedHistory: CheckRecord[] = [
  record(),
  record({ responseTimeMs: 1800, state: "slow" }),
  record({ ok: false, state: "down", statusCode: null, responseTimeMs: 5000, error: "Timed out" }),
  record({ ok: false, state: "down", statusCode: 503, responseTimeMs: 90, error: "Unexpected status 503" }),
];

function scriptsIn(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

describe("the generated page", () => {
  const cases: [string, HealthCheckSettings, boolean][] = [
    ["with a mixed history", settings({ history: mixedHistory }), true],
    ["with no checks yet", settings({ history: [], currentState: "unknown" }), true],
    ["read-only, with no check callback", settings({ history: mixedHistory }), false],
    ["with a full 60-check window", settings({
      history: Array.from({ length: 60 }, (_, i) => record({ ok: i % 7 !== 0, responseTimeMs: i * 30 })),
    }), true],
  ];

  for (const [name, source, canCheck] of cases) {
    it(`parses ${name}`, () => {
      const html = renderHistoryHtml(buildSnapshot(source), "token", { canCheck });
      const scripts = scriptsIn(html);
      expect(scripts.length).toBe(2);
      for (const src of scripts) {
        // Throws on a syntax error, which is exactly the failure being guarded against.
        expect(() => new Function(src)).not.toThrow();
      }
    });
  }

  it("closes the template where it should, so no markup leaks into the page as text", () => {
    const html = renderHistoryHtml(buildSnapshot(settings({ history: mixedHistory })), "t", {
      canCheck: true,
    });
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });

  it("shows the check control only when a check callback was supplied", () => {
    const withCheck = renderHistoryHtml(buildSnapshot(settings()), "t", { canCheck: true });
    const without = renderHistoryHtml(buildSnapshot(settings()), "t", { canCheck: false });
    expect(withCheck).toContain('id="check"');
    // No dead control: a button that cannot do anything is worse than no button.
    expect(without).not.toContain('id="check"');
  });

  it("offers a filter for each outcome the table distinguishes", () => {
    const html = renderHistoryHtml(buildSnapshot(settings({ history: mixedHistory })), "t", {
      canCheck: true,
    });
    for (const value of ["all", "healthy", "slow", "failed"]) {
      expect(html).toContain(`data-f="${value}"`);
    }
  });

  it("makes every value column sortable, and the detail column not", () => {
    const html = renderHistoryHtml(buildSnapshot(settings({ history: mixedHistory })), "t", {
      canCheck: true,
    });
    for (const key of ["time", "result", "code", "response"]) {
      expect(html).toContain(`data-s="${key}"`);
    }
    // Free text of arbitrary length has no useful order, and sorting by it would only shuffle
    // the rows the reader is trying to read.
    expect(html).not.toContain('data-s="detail"');
  });

  it("embeds the token so the page can authenticate to the server", () => {
    const html = renderHistoryHtml(buildSnapshot(settings()), "abc123", { canCheck: true });
    expect(html).toContain('"abc123"');
  });

  it("escapes a service name that would otherwise close the title tag", () => {
    const html = renderHistoryHtml(
      buildSnapshot(settings({ serviceName: '</title><script>bad()</script>' })),
      "t",
      { canCheck: true }
    );
    expect(html).not.toContain("<script>bad()</script>");
    expect(scriptsIn(html).length).toBe(2);
  });

  it("escapes markup inside embedded check data rather than ending the script block", () => {
    const html = renderHistoryHtml(
      buildSnapshot(settings({
        history: [record({ ok: false, error: "</script><script>bad()</script>" })],
      })),
      "t",
      { canCheck: true }
    );
    expect(html).not.toContain("<script>bad()</script>");
    const scripts = scriptsIn(html);
    expect(scripts.length).toBe(2);
    for (const src of scripts) expect(() => new Function(src)).not.toThrow();
  });

  it("keeps a body snippet out of the page unless the setting asks for it", () => {
    const hidden = renderHistoryHtml(
      buildSnapshot(settings({ history: [record({ bodySnippet: "secret-token-value" })] })),
      "t",
      { canCheck: true }
    );
    const shown = renderHistoryHtml(
      buildSnapshot(settings({
        showBodySnippetInHistory: true,
        history: [record({ bodySnippet: "secret-token-value" })],
      })),
      "t",
      { canCheck: true }
    );
    expect(hidden).not.toContain("secret-token-value");
    expect(shown).toContain("secret-token-value");
  });
});
