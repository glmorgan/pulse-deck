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

/**
 * How long until a key is next due a check, given when it last had one.
 *
 * `willAppear` fires far more often than people expect: every time a folder is opened or closed,
 * a profile switches, or the Stream Deck app redraws its pages. Each one used to schedule a check
 * a second and a half later regardless of when the last one ran, so walking in and out of a folder
 * five times ran five extra checks — wasted requests against someone else's service, and five
 * slots gone from a 60-record window that on an hourly key is meant to cover two and a half days.
 *
 * So the schedule is anchored to the last check rather than to the moment the key appeared: a key
 * checked 50 minutes ago on an hourly interval waits the remaining 10 minutes, and one that has
 * never been checked, or is overdue, goes after the short settling delay.
 *
 * @param minDelayMs A floor on the answer, so a check never fires while the plugin is still
 * starting up and the key has not finished drawing.
 */
export function msUntilDue(
  lastCheckedAt: string | null,
  intervalMs: number,
  minDelayMs: number
): number {
  if (!lastCheckedAt) return minDelayMs;
  const last = Date.parse(lastCheckedAt);
  // An unparseable timestamp is treated as no timestamp rather than as the epoch, which would
  // read as wildly overdue and check immediately every time.
  if (!Number.isFinite(last)) return minDelayMs;
  // A clock that has gone backwards, or a timestamp from the future, must not park a key for
  // hours: anything that is not a sane elapsed time falls back to checking now.
  const elapsed = Date.now() - last;
  if (elapsed < 0 || elapsed >= intervalMs) return minDelayMs;
  return Math.max(minDelayMs, intervalMs - elapsed);
}

export function clearTimer(
  timer: ReturnType<typeof setTimeout> | null
): void {
  if (timer !== null) clearInterval(timer);
}
