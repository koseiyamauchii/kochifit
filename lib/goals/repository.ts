import { readAll, readByIds } from "@/lib/supabase/read-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
export type GoalProgress = { workoutDays: number; setCount: number; exercises: { name: string; maxWeightKg: number | null }[] };

export async function getGoalProgress(client: SupabaseClient<Database>, start: string, end: string): Promise<GoalProgress> {
  const { data: workouts } = await readAll((from, to) => client.from("workouts")
    .select("id, workout_date").gte("workout_date", start).lte("workout_date", end).order("id").range(from, to));
  const { data: entries } = await readByIds(workouts.map(workout => workout.id), (ids, from, to) => client.from("workout_exercises")
    .select("id, exercise_id").in("workout_id", ids).order("id").range(from, to));
  const byEntry = new Map(entries.map(e => [e.id, e.exercise_id]));
  const maxWeights = new Map<string, number>();
  const { data: sets } = await readByIds(entries.map(entry => entry.id), (ids, from, to) => client.from("sets")
    .select("id, workout_exercise_id, weight_kg").in("workout_exercise_id", ids).order("id").range(from, to));
  const setCount = sets.length;
  for (const set of sets) {
    const exerciseId = byEntry.get(set.workout_exercise_id)!;
    if (set.weight_kg !== null) maxWeights.set(exerciseId, Math.max(maxWeights.get(exerciseId) ?? 0, set.weight_kg));
  }
  const exercises: GoalProgress["exercises"] = [];
  const ids = [...new Set(entries.map(e => e.exercise_id))];
  const { data } = await readByIds(ids, (chunk, from, to) => client.from("exercises")
    .select("id, name").in("id", chunk).order("id").range(from, to));
  for (const exercise of data) exercises.push({ name: exercise.name, maxWeightKg: maxWeights.get(exercise.id) ?? null });
  return { workoutDays: new Set(workouts.map(w => w.workout_date)).size, setCount, exercises: exercises.sort((a, b) => a.name.localeCompare(b.name, "ja")) };
}
