import type { Profile } from "@/lib/supabase/database.types";
import type { Exercise } from "@/lib/workouts/types";

export interface CalorieSet {
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
}

const bodyPartMet: Record<string, number> = {
  chest: 5.5,
  back: 5.8,
  legs: 6.2,
  shoulders: 5.0,
  arms: 4.5,
  abs: 4.0,
  cardio: 7.0,
};

function getProfileWeight(profile: Profile | null) {
  return profile?.body_weight_kg ?? 70;
}

function getBodyAdjustment(profile: Profile | null) {
  const weight = profile?.body_weight_kg ?? 70;
  const height = profile?.height_cm ?? 170;
  const age = profile?.age ?? 30;
  const sex = profile?.sex ?? "unspecified";

  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexOffset;
  return Math.min(1.25, Math.max(0.8, bmr / 1580));
}

function getExerciseMet(exercise: Exercise | null) {
  if (!exercise) {
    return 5;
  }

  const baseMet = exercise.bodyPartKey ? bodyPartMet[exercise.bodyPartKey] ?? 5 : 5;
  const compoundBonus =
    /スクワット|デッド|ベンチ|プレス|懸垂/.test(exercise.name) ? 0.6 : 0;
  return baseMet + compoundBonus;
}

function estimateMinutes(sets: CalorieSet[]) {
  const activeSets = sets.filter(
    (set) =>
      set.weightKg !== null &&
      set.weightKg > 0 &&
      set.reps !== null &&
      set.reps > 0,
  );
  if (activeSets.length === 0) {
    return 0;
  }

  const baseMinutes = activeSets.reduce((total, set) => total + (set.isWarmup ? 1.5 : 2.5), 0);
  const volume = activeSets.reduce(
    (total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0),
    0,
  );
  return baseMinutes + Math.min(8, volume / 1200);
}

export function estimateWorkoutExerciseCalories(input: {
  profile: Profile | null;
  exercise: Exercise | null;
  sets: CalorieSet[];
}) {
  const minutes = estimateMinutes(input.sets);
  if (minutes === 0) {
    return 0;
  }

  const met = getExerciseMet(input.exercise);
  const weightKg = getProfileWeight(input.profile);
  const bodyAdjustment = getBodyAdjustment(input.profile);
  const calories = ((met * 3.5 * weightKg) / 200) * minutes * bodyAdjustment;
  return Math.max(1, Math.round(calories));
}
