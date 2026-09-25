import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getDayCondition, getLatestWorkoutForExerciseBeforeDate, getWorkoutsForExercise } from "./repository";

function mockClient(responses: Record<string, unknown[]>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = { from(table: string) {
    const result = { data: responses[table]?.shift() ?? [], error: null };
    const builder = new Proxy({}, { get(_target, method: string) {
      if (method === "then") return Promise.resolve(result).then.bind(Promise.resolve(result));
      return (...args: unknown[]) => { calls.push({ table, method, args }); return builder; };
    } });
    return builder;
  } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}
const date = "2026-09-25";
const workout = (id: string, createdAt: string) => ({ id, workout_date: date, created_at: createdAt, note: null });
const entry = (id: string) => ({ id: `entry-${id}`, workout_id: id, exercise_id: "bench", display_order: 0, note: "種目メモ", condition: "好調", elapsed_sec: null });
const set = { id: "set", workout_exercise_id: "entry-first", set_number: 1, weight_kg: 20, reps: 10, rir: null, is_warmup: false, is_assisted: true, note: "セットメモ" };

describe("previous exercise records", () => {
  it("includes the first session of the same day and preserves notes and assistance", async () => {
    const { client, calls } = mockClient({ workouts: [[workout("first", "09:00")]], workout_exercises: [[entry("first")]], exercises: [{ name: "ベンチプレス" }], sets: [[set]] });
    const result = await getLatestWorkoutForExerciseBeforeDate(client, "bench", date);
    expect(result).toMatchObject({ id: "entry-first", note: "種目メモ", sets: [{ note: "セットメモ", isAssisted: true }] });
    expect(calls).toContainEqual({ table: "workouts", method: "lte", args: ["workout_date", date] });
  });
  it("excludes the current and later sessions when editing", async () => {
    const { client, calls } = mockClient({ workouts: [[workout("later", "12:00"), workout("current", "11:00"), workout("first", "09:00")]], workout_exercises: [[entry("first")]], exercises: [{ name: "ベンチプレス" }], sets: [[]] });
    await getLatestWorkoutForExerciseBeforeDate(client, "bench", date, { id: "current", createdAt: "11:00" });
    expect(calls).toContainEqual({ table: "workout_exercises", method: "in", args: ["workout_id", ["first"]] });
  });
  it("searches older pages when the latest 60 sessions contain other exercises", async () => {
    const { client, calls } = mockClient({ workouts: [Array.from({ length: 60 }, (_, i) => workout(String(i), "12:00")), [workout("first", "09:00")]], workout_exercises: [[], [entry("first")]], exercises: [{ name: "ベンチプレス" }], sets: [[]] });
    expect(await getLatestWorkoutForExerciseBeforeDate(client, "bench", date)).toMatchObject({ id: "entry-first" });
    expect(calls).toContainEqual({ table: "workouts", method: "range", args: [60, 119] });
  });
});

describe("record details", () => {
  it("preserves both set and exercise notes in exercise history", async () => {
    const { client } = mockClient({ workout_exercises: [[entry("first")]], workouts: [[workout("first", "09:00")]], exercises: [{ name: "ベンチプレス" }], sets: [[set]] });
    expect(await getWorkoutsForExercise(client, "bench")).toMatchObject([{ exercises: [{ note: "種目メモ", condition: "好調", sets: [{ note: "セットメモ", isAssisted: true }] }] }]);
  });
  it("loads the selected day's condition without loading sets", async () => {
    const { client, calls } = mockClient({ workouts: [[{ id: "first" }]], workout_exercises: [[{ condition: "好調" }]] });
    expect(await getDayCondition(client, date)).toBe("好調");
    expect(calls).toContainEqual({ table: "workouts", method: "eq", args: ["workout_date", date] });
    expect(calls.some(call => call.table === "sets")).toBe(false);
  });
});
