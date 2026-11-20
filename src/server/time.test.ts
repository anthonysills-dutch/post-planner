import { describe, expect, it } from "vitest";
import { nextFreeSlot, parseLocal, zonedParts, zonedToUtc } from "./time";

describe("time zones", () => {
  it("round-trips a wall-clock time", () => {
    const ms = zonedToUtc(2026, 7, 1, 9, 30, "America/New_York");
    expect(new Date(ms).toISOString()).toBe("2026-07-01T13:30:00.000Z");
    expect(zonedParts(ms, "America/New_York")).toMatchObject({ hour: 9, minute: 30, weekday: 3 });
  });

  it("parses a local input in the member's zone", () => {
    expect(parseLocal("2026-12-01T08:00", "Europe/Berlin")).toBe(Date.UTC(2026, 11, 1, 7, 0));
    expect(parseLocal("not a time", "UTC")).toBeNull();
  });

  it("finds the next free slot after now", () => {
    const now = Date.UTC(2026, 10, 23, 10, 0); // Monday 10:00 UTC
    const slots = [{ weekday: 1, minute: 9 * 60 }, { weekday: 2, minute: 9 * 60 }];
    const tuesday = Date.UTC(2026, 10, 24, 9, 0);
    expect(nextFreeSlot(slots, "UTC", now, new Set())).toBe(tuesday);
    expect(nextFreeSlot(slots, "UTC", now, new Set([tuesday]))).toBe(Date.UTC(2026, 10, 30, 9, 0));
    expect(nextFreeSlot([], "UTC", now, new Set())).toBeNull();
  });
});
