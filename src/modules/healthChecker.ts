import type { HealthCheckSettings } from "../types.js";
import type { CheckResult } from "./stateEvaluator.js";

const MAX_BODY_SNIPPET = 500;

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
        : err instanceof Error
          ? err.message
          : "Unknown error",
    };
  }
}
