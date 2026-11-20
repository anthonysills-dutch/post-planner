import { zonedParts, zonedToUtc } from "./time";

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** The start (Monday 00:00 in `timeZone`) of the week holding `ms`. */
export function weekStart(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone);
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day) - (p.weekday - 1) * DAY);
  return zonedToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, timeZone);
}

export interface Week {
  start: number;
  count: number;
}

/** The last `weeks` weeks, oldest first, each with how many posts went out. */
export function postsPerWeek(
  publishedAt: readonly number[],
  timeZone: string,
  now: number,
  weeks: number,
): Week[] {
  const current = weekStart(now, timeZone);
  const result: Week[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    // Step back by days in local time so a daylight-saving week stays whole.
    const start = weekStart(current - i * WEEK + 3 * DAY, timeZone);
    result.push({ start, count: 0 });
  }
  for (const at of publishedAt) {
    const start = weekStart(at, timeZone);
    const week = result.find((w) => w.start === start);
    if (week) week.count += 1;
  }
  return result;
}

/**
 * Weeks in a row that met the goal, ending with the current week when it
 * already has, else with last week.
 */
export function weeklyStreak(
  publishedAt: readonly number[],
  timeZone: string,
  now: number,
  goal: number,
): number {
  const counts = new Map<number, number>();
  for (const at of publishedAt) {
    const start = weekStart(at, timeZone);
    counts.set(start, (counts.get(start) ?? 0) + 1);
  }
  let week = weekStart(now, timeZone);
  if ((counts.get(week) ?? 0) < goal) week = weekStart(week - 3 * DAY, timeZone);
  let streak = 0;
  while ((counts.get(week) ?? 0) >= goal) {
    streak += 1;
    week = weekStart(week - 3 * DAY, timeZone);
  }
  return streak;
}
