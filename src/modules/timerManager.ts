import type { CheckFrequency } from "../types.js";

const FREQUENCY_MS: Record<CheckFrequency, number | null> = {
  manual: null,
  "1m": 60_000,
  "5m": 300_000,
  "10m": 600_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
};

export function getIntervalMs(frequency: CheckFrequency): number | null {
  return FREQUENCY_MS[frequency] ?? null;
}

export function startTimer(
  intervalMs: number,
  callback: () => void
): ReturnType<typeof setInterval> {
  return setInterval(callback, intervalMs);
}

export function clearTimer(
  timer: ReturnType<typeof setTimeout> | null
): void {
  if (timer !== null) clearInterval(timer);
}
