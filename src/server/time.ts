// Time-zone arithmetic with Intl only: slots are wall-clock times in the
// member's zone, stored instants are UTC epoch milliseconds.

const DAY = 86_400_000;

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 (Monday) to 7 (Sunday). */
  weekday: number;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")) + 1,
  };
}

/** The instant a wall-clock time in `timeZone` names. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(guess, timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (shown === wanted) break;
    guess += wanted - shown;
  }
  return guess;
}

/** "2026-11-23T14:30" in `timeZone`, or null when it isn't one. */
export function parseLocal(value: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  if (mo! < 1 || mo! > 12 || d! < 1 || d! > 31 || h! > 23 || mi! > 59)
    return null;
  return zonedToUtc(y!, mo!, d!, h!, mi!, timeZone);
}

export interface Slot {
  weekday: number;
  minute: number;
}

export interface SlotDay {
  /** "2026-11-23" in the member's zone. */
  date: string;
  weekday: number;
  times: number[];
}

/** Each day from today on in `timeZone`, with the instants of its slots. */
export function slotDays(
  slots: readonly Slot[],
  timeZone: string,
  now: number,
  days: number,
): SlotDay[] {
  const today = zonedParts(now, timeZone);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  const sorted = [...slots].sort((a, b) => a.minute - b.minute);
  const result: SlotDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(base + i * DAY);
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    const times = sorted
      .filter((slot) => slot.weekday === weekday)
      .map((slot) =>
        zonedToUtc(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
          Math.floor(slot.minute / 60),
          slot.minute % 60,
          timeZone,
        ),
      );
    result.push({ date: date.toISOString().slice(0, 10), weekday, times });
  }
  return result;
}

/** The first slot after `now` that no post holds, within eight weeks. */
export function nextFreeSlot(
  slots: readonly Slot[],
  timeZone: string,
  now: number,
  taken: ReadonlySet<number>,
): number | null {
  for (const day of slotDays(slots, timeZone, now, 57)) {
    for (const time of day.times) {
      if (time > now && !taken.has(time)) return time;
    }
  }
  return null;
}

/** "2026-11-23" for the instant in `timeZone`. */
export function dateKey(ms: number, timeZone: string): string {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
