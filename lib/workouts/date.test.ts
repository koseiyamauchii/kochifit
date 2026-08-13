import { describe, expect, it } from "vitest";
import { getCalendarCells, getMonthRange, toDateKey } from "@/lib/workouts/date";

describe("workout date helpers", () => {
  it("formats local date keys", () => {
    expect(toDateKey(new Date(2026, 7, 13))).toBe("2026-08-13");
  });

  it("returns inclusive month range", () => {
    expect(getMonthRange(new Date(2026, 1, 10))).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("creates Monday-start calendar cells", () => {
    const cells = getCalendarCells(new Date(2026, 7, 1));
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, 1]);
    expect(cells).toContain(31);
    expect(cells.length % 7).toBe(0);
  });
});
