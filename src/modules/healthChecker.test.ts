import { describe, it, expect } from "vitest";
import { describeFetchError } from "./healthChecker.js";

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
