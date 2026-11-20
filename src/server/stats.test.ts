import { describe, expect, it } from "vitest";
import { postsPerWeek, weekStart, weeklyStreak } from "./stats";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 25, 12); // Wednesday

describe("posting stats", () => {
  it("starts weeks on Monday in the member's zone", () => {
    expect(weekStart(now, "UTC")).toBe(Date.UTC(2026, 10, 23));
  });

  it("counts posts per week and the streak of weeks meeting the goal", () => {
    const thisWeek = [now - DAY, now - 2 * DAY];
    const lastWeek = [now - 7 * DAY, now - 8 * DAY];
    const weeks = postsPerWeek([...thisWeek, ...lastWeek], "UTC", now, 4);
    expect(weeks.map((w) => w.count)).toEqual([0, 0, 2, 2]);
    expect(weeklyStreak([...thisWeek, ...lastWeek], "UTC", now, 2)).toBe(2);
    expect(weeklyStreak(lastWeek, "UTC", now, 2)).toBe(1);
    expect(weeklyStreak(thisWeek, "UTC", now, 3)).toBe(0);
  });
});
