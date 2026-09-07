import { describe, expect, it } from "vitest";
import { goalPeriodStart, isGoalDue, shiftGoalMonth } from "./goals";
describe("goal review dates", () => {
  it("offers review on the deadline and after, never for empty goals", () => {
    expect(isGoalDue("週3回", "2026-09-07", "2026-09-07")).toBe(true);
    expect(isGoalDue("週3回", "2026-09-06", "2026-09-07")).toBe(true);
    expect(isGoalDue("週3回", "2026-09-08", "2026-09-07")).toBe(false);
    expect(isGoalDue("", "2026-09-07", "2026-09-07")).toBe(false);
  });
  it("clamps month ends, including leap years", () => {
    expect(shiftGoalMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftGoalMonth("2028-01-31", 1)).toBe("2028-02-29");
    expect(shiftGoalMonth("2026-12-31", 1)).toBe("2027-01-31");
    expect(goalPeriodStart("2026-08-31", 1)).toBe("2026-08-01");
  });
});
