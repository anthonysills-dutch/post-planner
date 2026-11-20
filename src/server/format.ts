/** "Mon, Nov 23" in `timeZone`. */
export function dayLabel(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(ms);
}

/** "09:00" in `timeZone`. */
export function timeLabel(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
}

/** "Mon, Nov 23, 09:00" in `timeZone`. */
export function whenLabel(ms: number, timeZone: string): string {
  return `${dayLabel(ms, timeZone)}, ${timeLabel(ms, timeZone)}`;
}

/** The first line of a post, cut to `max` characters. */
export function snippet(body: string, max = 90): string {
  const line = body.trim().split("\n")[0] ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
