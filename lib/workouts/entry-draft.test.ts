import { expect, it } from "vitest";
import { estimateOneRepMax } from "@/lib/domain/one-rep-max";
import { createInitialSetDraft, formatRmValue, toSetInputs } from "./entry-draft";

it("uses the tested domain 1RM and rounds only for display", () => {
  expect(formatRmValue(80, 5)).toBe(estimateOneRepMax(80, 5)!.toFixed(1));
  expect(formatRmValue(80, 5)).toBe("93.3");
  expect(formatRmValue(null, 5)).toBe("-");
});

it("saves only the active repetition mode, avoiding stale hidden values", () => {
  const draft = { ...createInitialSetDraft(), weightKg: "20", reps: "99", leftReps: "10", rightReps: "12" };
  expect(toSetInputs([draft], null, undefined, true)[0]).toMatchObject({ reps: null, leftReps: 10, rightReps: 12 });
  expect(toSetInputs([draft], null, undefined, false)[0]).toMatchObject({ reps: 99, leftReps: null, rightReps: null });
});
