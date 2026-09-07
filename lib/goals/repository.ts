import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
export type GoalProgress = { workoutDays: number; setCount: number; exercises: { name: string; maxWeightKg: number | null }[] };

export async function getGoalProgress(client: SupabaseClient<Database>, start: string, end: string): Promise<GoalProgress> {
  const workouts: { id: string; workout_date: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("workouts").select("id, workout_date").gte("workout_date", start).lte("workout_date", end).order("id").range(offset, offset + 999);
    if (error) throw error;
    workouts.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const entries: { id: string; exercise_id: string }[] = [];
  for (let offset = 0; offset < workouts.length; offset += 100) {
    for (let page = 0; ; page += 1000) {
      const { data, error } = await client.from("workout_exercises").select("id, exercise_id").in("workout_id", workouts.slice(offset, offset + 100).map(w => w.id)).order("id").range(page, page + 999);
      if (error) throw error;
      entries.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const byEntry = new Map(entries.map(e => [e.id, e.exercise_id]));
  const maxWeights = new Map<string, number>();
  let setCount = 0;
  for (let offset = 0; offset < entries.length; offset += 100) {
    for (let page = 0; ; page += 1000) {
      const { data, error } = await client.from("sets").select("id, workout_exercise_id, weight_kg").in("workout_exercise_id", entries.slice(offset, offset + 100).map(e => e.id)).order("id").range(page, page + 999);
      if (error) throw error;
      setCount += data?.length ?? 0;
      for (const set of data ?? []) {
        const exerciseId = byEntry.get(set.workout_exercise_id)!;
        if (set.weight_kg !== null) maxWeights.set(exerciseId, Math.max(maxWeights.get(exerciseId) ?? 0, set.weight_kg));
      }
      if (!data || data.length < 1000) break;
    }
  }
  const exercises: GoalProgress["exercises"] = [];
  const ids = [...new Set(entries.map(e => e.exercise_id))];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client.from("exercises").select("id, name").in("id", ids.slice(offset, offset + 100));
    if (error) throw error;
    for (const exercise of data ?? []) exercises.push({ name: exercise.name, maxWeightKg: maxWeights.get(exercise.id) ?? null });
  }
  return { workoutDays: new Set(workouts.map(w => w.workout_date)).size, setCount, exercises: exercises.sort((a, b) => a.name.localeCompare(b.name, "ja")) };
}
