import type { CheckRecord } from "../types.js";

const MAX_HISTORY = 60;

export function appendRecord(
  history: CheckRecord[],
  record: CheckRecord
): CheckRecord[] {
  const updated = [...history, record];
  return updated.length > MAX_HISTORY
    ? updated.slice(updated.length - MAX_HISTORY)
    : updated;
}

export function uptimeRatio(history: CheckRecord[]): string {
  if (history.length === 0) return "N/A";
  const ok = history.filter((r) => r.ok).length;
  return `${ok}/${history.length} checks successful`;
}

export function averageLatency(history: CheckRecord[]): number | null {
  if (history.length === 0) return null;
  const total = history.reduce((sum, r) => sum + r.responseTimeMs, 0);
  return Math.round(total / history.length);
}

export function formatHistoryPopup(
  serviceName: string,
  currentState: string,
  consecutiveFailures: number,
  history: CheckRecord[]
): string {
  const name = serviceName || "Unnamed Service";

  if (history.length === 0) {
    return [
      `PulseDeck: ${name}`,
      "",
      "No checks have run yet.",
      "",
      "Press the key to run a health check.",
    ].join("\n");
  }

  const latest = history[history.length - 1];
  const avgMs = averageLatency(history);
  const lastChecked = new Date(latest.timestamp).toLocaleString();

  const lastCheckLine = latest.ok
    ? `${latest.statusCode} in ${latest.responseTimeMs}ms`
    : latest.error || "Failed";

  const lines: string[] = [
    `PulseDeck: ${name}`,
    "",
    `Current: ${formatState(currentState)}`,
    `Last check: ${lastCheckLine}`,
    `Uptime: ${uptimeRatio(history)}`,
    `Average latency: ${avgMs !== null ? `${avgMs}ms` : "N/A"}`,
    `Consecutive failures: ${consecutiveFailures}`,
    `Last checked: ${lastChecked}`,
    "",
    "Recent checks:",
  ];

  const recent = history.slice(-15).reverse();
  for (const r of recent) {
    const time = new Date(r.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const status = r.ok ? "OK  " : "FAIL";
    const code = r.statusCode !== null ? String(r.statusCode) : "---";
    const ms = `${r.responseTimeMs}ms`;
    lines.push(`${time}  ${status}  ${code}  ${ms}`);
  }

  return lines.join("\n");
}

function formatState(state: string): string {
  const map: Record<string, string> = {
    unknown: "Unknown",
    checking: "Checking",
    healthy: "Healthy",
    slow: "Slow",
    warning: "Warning",
    down: "Down",
    "config-error": "Configuration Error",
  };
  return map[state] ?? state;
}
