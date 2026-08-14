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

  it("creates Monday-start calendar cells with adjacent month dates", () => {
    const cells = getCalendarCells(new Date(2026, 7, 1));
    expect(cells.slice(0, 6).map((cell) => cell.dateKey)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
    expect(cells.find((cell) => cell.dateKey === "2026-08-31")?.isCurrentMonth).toBe(true);
    expect(cells.find((cell) => cell.dateKey === "2026-09-01")?.isCurrentMonth).toBe(false);
    expect(cells.length % 7).toBe(0);
  });
});
