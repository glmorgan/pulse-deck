import type { HeaderPair, HealthCheckSettings } from "../types.js";
import type { CheckResult } from "./stateEvaluator.js";

const MAX_BODY_SNIPPET = 500;

/**
 * Turns a thrown fetch error into something worth reading in the history.
 *
 * Node's fetch reports every transport failure as `TypeError: fetch failed` and puts the actual
 * reason on `cause` — so a refused connection, an unresolvable host and an expired certificate
 * all arrive looking identical. Reading the cause is the difference between "fetch failed" and
 * "connect ECONNREFUSED 10.0.0.1:443", which is the whole value of the column it lands in.
 */
export function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return "Unknown error";
  const cause = (err as { cause?: unknown }).cause;
  const detail =
    cause instanceof Error ? cause.message
    : typeof cause === "string" ? cause
    : null;
  if (!detail) return err.message;
  // "fetch failed" carries no information of its own, so the cause replaces it rather than
  // trailing it. Anything more specific keeps both halves.
  return err.message === "fetch failed" ? detail : `${err.message}: ${detail}`;
}

/**
 * Turns configured header rows into something `fetch` will accept.
 *
 * Rows are dropped rather than repaired when they cannot be sent: an empty name is a row someone
 * started and abandoned, and a name carrying a colon, whitespace or a newline would either be
 * rejected by fetch or, in the newline case, be an attempt to inject a second header. A single bad
 * row must not fail the whole check, because the state it produces would say the *service* is
 * down.
 */
export function buildHeaders(headers: HeaderPair[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of headers ?? []) {
    const name = String(header?.name ?? "").trim();
    const value = String(header?.value ?? "").trim();
    if (!name) continue;
    if (!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(name)) continue;
    if (/[\r\n]/.test(value)) continue;
    // Last one wins, which is what a form's later row visually implies.
    out[name] = value;
  }
  return out;
}

export async function runHealthCheck(
  settings: HealthCheckSettings
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    settings.timeoutMs
  );

  const start = Date.now();

  try {
    const response = await fetch(settings.endpointUrl.trim(), {
      method: "GET",
      headers: buildHeaders(settings.headers),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);
    const responseTimeMs = Date.now() - start;

    const statusMatched = response.status === settings.expectedStatusCode;

    let bodyMatched: boolean | null = null;
    let bodySnippet: string | null = null;
    let bodyText = "";

    const needsBody =
      settings.expectedBodyContains.trim() !== "" ||
      settings.showBodySnippetInHistory;

    if (needsBody) {
      try {
        bodyText = await response.text();
      } catch {
        bodyText = "";
      }
    }

    if (settings.expectedBodyContains.trim() !== "") {
      bodyMatched = bodyText.includes(settings.expectedBodyContains.trim());
    }

    if (settings.showBodySnippetInHistory && bodyText) {
      bodySnippet = bodyText.slice(0, MAX_BODY_SNIPPET);
    }

    const ok = statusMatched && (bodyMatched === null || bodyMatched);

    let error: string | null = null;
    if (!statusMatched) {
      error = `Expected status ${settings.expectedStatusCode} but received ${response.status}`;
    } else if (bodyMatched === false) {
      error = `Response body did not contain "${settings.expectedBodyContains}"`;
    }

    return {
      ok,
      statusCode: response.status,
      responseTimeMs,
      bodyMatched,
      bodySnippet,
      error,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutHandle);
    const responseTimeMs = Date.now() - start;

    const isAbort =
      err instanceof Error && err.name === "AbortError";

    return {
      ok: false,
      statusCode: null,
      responseTimeMs: isAbort ? settings.timeoutMs : responseTimeMs,
      bodyMatched: null,
      bodySnippet: null,
      error: isAbort
        ? `Request timed out after ${settings.timeoutMs}ms`
        : describeFetchError(err),
    };
  }
}
