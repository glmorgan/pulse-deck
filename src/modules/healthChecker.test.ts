import { describe, it, expect } from "vitest";
import { buildHeaders, describeFetchError } from "./healthChecker.js";

/**
 * Node's fetch reports every transport failure as `TypeError: fetch failed`, with the real reason
 * on `cause`. These are the shapes that actually reach the history's Detail column.
 */

describe("describeFetchError", () => {
  it("replaces the useless wrapper with the cause", () => {
    const err = new TypeError("fetch failed", {
      cause: new Error("connect ECONNREFUSED 10.0.0.1:443"),
    });
    expect(describeFetchError(err)).toBe("connect ECONNREFUSED 10.0.0.1:443");
  });

  it("reports an unresolvable host in the terms the system used", () => {
    const err = new TypeError("fetch failed", {
      cause: new Error("getaddrinfo ENOTFOUND api.example.test"),
    });
    expect(describeFetchError(err)).toContain("ENOTFOUND");
  });

  it("keeps both halves when the outer message says something of its own", () => {
    const err = new Error("Invalid URL", { cause: new Error("bad scheme") });
    expect(describeFetchError(err)).toBe("Invalid URL: bad scheme");
  });

  it("falls back to the message when there is no cause", () => {
    expect(describeFetchError(new Error("Invalid URL"))).toBe("Invalid URL");
  });

  it("accepts a string cause, which some libraries throw", () => {
    const err = new TypeError("fetch failed", { cause: "socket hang up" });
    expect(describeFetchError(err)).toBe("socket hang up");
  });

  it("never returns empty for something that is not an Error at all", () => {
    expect(describeFetchError("boom")).toBe("Unknown error");
    expect(describeFetchError(undefined)).toBe("Unknown error");
  });
});

// ── buildHeaders ───────────────────────────────────────────────────────────

describe("buildHeaders", () => {
  it("sends what was configured", () => {
    expect(buildHeaders([{ name: "X-Api-Key", value: "abc123" }]))
      .toEqual({ "X-Api-Key": "abc123" });
  });

  it("has nothing to send when nothing is configured", () => {
    expect(buildHeaders([])).toEqual({});
    expect(buildHeaders(undefined)).toEqual({});
  });

  it("drops a row with no name, which is one someone started and left", () => {
    expect(buildHeaders([{ name: "  ", value: "x" }])).toEqual({});
  });

  it("keeps a header with an empty value, which is a real thing to send", () => {
    expect(buildHeaders([{ name: "X-Debug", value: "" }])).toEqual({ "X-Debug": "" });
  });

  it("trims the whitespace around what was typed", () => {
    expect(buildHeaders([{ name: " Accept ", value: " application/json " }]))
      .toEqual({ Accept: "application/json" });
  });

  it("refuses a name fetch would reject rather than failing the whole check", () => {
    // A bad row must not throw: the state that produced would say the *service* is down.
    expect(buildHeaders([
      { name: "Bad Name", value: "x" },
      { name: "Also:Bad", value: "x" },
      { name: "Good", value: "y" },
    ])).toEqual({ Good: "y" });
  });

  it("refuses a value carrying a newline, which is header injection", () => {
    expect(buildHeaders([{ name: "X-Test", value: "a\r\nX-Evil: b" }])).toEqual({});
  });

  it("lets the later row win, as its position implies", () => {
    expect(buildHeaders([
      { name: "Accept", value: "text/plain" },
      { name: "Accept", value: "application/json" },
    ])).toEqual({ Accept: "application/json" });
  });
});
