import { describe, expect, it } from "vitest";
import { estimateOneRepMax } from "./one-rep-max";

describe("estimateOneRepMax", () => {
  it("uses the Epley estimate rounded to kilograms", () => {
    expect(estimateOneRepMax(80, 5)).toBe(93);
  });

  it("returns the same weight for one rep", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("rejects invalid values", () => {
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(80, 0)).toBeNull();
  });
});
