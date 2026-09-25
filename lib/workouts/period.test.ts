import { describe, expect, it } from "vitest";
import { getRecordRange, inclusiveDays } from "./period";

describe("rolling inclusive record periods", () => {
  it("includes today and exactly seven dates in a week", () => {
    const range = getRecordRange("week", new Date(2026, 8, 25))!;
    expect(range).toEqual({ start: "2026-09-19", end: "2026-09-25" });
    expect(inclusiveDays(range.start, range.end)).toBe(7);
  });
  it("uses calendar months and years", () => {
    expect(getRecordRange("month", new Date(2026, 8, 25))).toEqual({ start: "2026-08-26", end: "2026-09-25" });
    expect(getRecordRange("year", new Date(2026, 8, 25))).toEqual({ start: "2025-09-26", end: "2026-09-25" });
  });
  it("handles short months, leap days and year boundaries", () => {
    expect(getRecordRange("month", new Date(2026, 2, 31))?.start).toBe("2026-03-01");
    expect(getRecordRange("year", new Date(2024, 1, 29))?.start).toBe("2023-03-01");
    expect(getRecordRange("week", new Date(2026, 0, 2))?.start).toBe("2025-12-27");
    expect(getRecordRange("all")).toBeUndefined();
  });
});
