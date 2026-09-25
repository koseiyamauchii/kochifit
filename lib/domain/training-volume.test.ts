import { expect, it } from "vitest";
import { trainingVolume } from "./training-volume";

it("sums left and right repetitions and never double counts legacy reps", () => {
  expect(trainingVolume(20, null, 10, 12)).toBe(440);
  expect(trainingVolume(20, 99, 10, 12)).toBe(440);
  expect(trainingVolume(20, null, 10, null)).toBe(200);
  expect(trainingVolume(20, 10, null, null)).toBe(200);
  expect(trainingVolume(20, null, null, null)).toBeNull();
  expect(trainingVolume(null, 10, 10, 10)).toBeNull();
});
