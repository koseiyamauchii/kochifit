import { describe, expect, it } from "vitest";
import type { Profile } from "@/lib/supabase/database.types";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import type { Exercise } from "@/lib/workouts/types";

const profile = {
  body_weight_kg: 70,
  height_cm: 170,
  age: 30,
  sex: "male",
} as Profile;

const exercise = {
  name: "ベンチプレス",
  bodyPartKey: "chest",
} as Exercise;

describe("estimateWorkoutExerciseCalories", () => {
  it("requires both weight and reps", () => {
    expect(
      estimateWorkoutExerciseCalories({
        profile,
        exercise,
        sets: [{ weightKg: 60, reps: null, isWarmup: false }],
      }),
    ).toBe(0);
    expect(
      estimateWorkoutExerciseCalories({
        profile,
        exercise,
        sets: [{ weightKg: null, reps: 10, isWarmup: false }],
      }),
    ).toBe(0);
  });

  it("estimates calories when weight and reps are both present", () => {
    expect(
      estimateWorkoutExerciseCalories({
        profile,
        exercise,
        sets: [{ weightKg: 60, reps: 10, isWarmup: false }],
      }),
    ).toBeGreaterThan(0);
  });

  it("uses recorded cardio calories before estimating from duration", () => {
    expect(
      estimateWorkoutExerciseCalories({
        profile,
        exercise: { name: "トレッドミル", bodyPartKey: "cardio" } as Exercise,
        sets: [
          {
            weightKg: null,
            reps: null,
            isWarmup: false,
            durationSec: 1800,
            caloriesKcal: 245.4,
          },
        ],
      }),
    ).toBe(245);
  });

  it("derives cardio duration from distance and speed", () => {
    expect(
      estimateWorkoutExerciseCalories({
        profile,
        exercise: { name: "トレッドミル", bodyPartKey: "cardio" } as Exercise,
        sets: [
          {
            weightKg: null,
            reps: null,
            isWarmup: false,
            distanceKm: 5,
            speedKmh: 10,
          },
        ],
      }),
    ).toBeGreaterThan(0);
  });
});
