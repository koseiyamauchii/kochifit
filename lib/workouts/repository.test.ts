import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appendHistoryRecords, getDayCondition, getExerciseWeightRecords, getLatestWorkoutForExerciseBeforeDate, getWorkoutsForExercise } from "./repository";
import type { Exercise, Workout } from "./types";

describe("expanding history", () => {
  const record = (id: string): Workout => ({ id, workoutDate: "2026-09-25", createdAt: "09:00", note: null, exercises: [] });
  it("keeps the first five and appends the next five in order", () => {
    const first = Array.from({ length: 5 }, (_, i) => record(String(i)));
    const next = Array.from({ length: 5 }, (_, i) => record(String(i + 5)));
    const result = appendHistoryRecords(first, next);
    expect(result.map(item => item.id)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(result[0]).toBe(first[0]);
    expect(first).toHaveLength(5);
  });
  it("does not duplicate records on retries or overlapping pages", () => {
    const first = [record("a"), record("b")];
    expect(appendHistoryRecords(first, [record("b"), record("c")]).map(item => item.id)).toEqual(["a", "b", "c"]);
    expect(appendHistoryRecords(first, [])).toEqual(first);
  });
});

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
  it("shows a condition recorded under another exercise on the same day", async () => {
    const { client } = mockClient({
      workouts: [[{ ...workout("first", "09:00"), workout_exercises: [entry("first")] }], [{ id: "other", workout_date: date }], []],
      exercises: [{ name: "ベンチプレス" }], sets: [[set]],
      workout_exercises: [[{ id: "other-entry", workout_id: "other", condition: "その日の体調", created_at: "10:00" }], []],
    });
    expect((await getWorkoutsForExercise(client, "bench")).workouts[0].dayCondition).toBe("その日の体調");
  });
  it("preserves both set and exercise notes in exercise history", async () => {
    const { client } = mockClient({ workouts: [[{ ...workout("first", "09:00"), workout_exercises: [entry("first")] }]], exercises: [{ name: "ベンチプレス" }], sets: [[set]] });
    expect(await getWorkoutsForExercise(client, "bench")).toMatchObject({ hasMore: false, workouts: [{ exercises: [{ note: "種目メモ", condition: "好調", sets: [{ note: "セットメモ", isAssisted: true }] }] }] });
  });
  it("loads the selected day's condition without loading sets", async () => {
    const { client, calls } = mockClient({ workouts: [[{ id: "first", workout_date: date }]], workout_exercises: [[{ id: "e", workout_id: "first", condition: "好調", created_at: "2026-09-25" }]] });
    expect(await getDayCondition(client, date)).toBe("好調");
    expect(calls).toContainEqual({ table: "workouts", method: "in", args: ["workout_date", [date]] });
    expect(calls.some(call => call.table === "sets")).toBe(false);
  });
});

describe("five-record history pages", () => {
  it("loads only one maximum-weight row instead of all historical sets", async () => {
    const { client, calls } = mockClient({ sets: [[{ weight_kg: 45 }]] });
    const exercise = { id: "bench", name: "ベンチプレス", bodyPartId: "chest", displayOrder: 1 } as Exercise;
    expect(await getExerciseWeightRecords(client, [exercise])).toMatchObject([{ exerciseId: "bench", maxWeightKg: 45 }]);
    expect(calls).toContainEqual({ table: "sets", method: "limit", args: [1] });
    expect(calls).toContainEqual({ table: "sets", method: "eq", args: ["workout_exercises.exercise_id", "bench"] });
  });
  const rows = (count: number, offset = 0) => Array.from({ length: count }, (_, i) => {
    const id = String(i + offset);
    return { ...workout(id, "09:00"), workout_exercises: [entry(id)] };
  });
  it("fetches only five records' sets and uses one metadata row for hasMore", async () => {
    const { client, calls } = mockClient({ workouts: [rows(6)], exercises: [{ name: "ベンチプレス" }], sets: [[]] });
    const page = await getWorkoutsForExercise(client, "bench");
    expect(page.workouts).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(calls).toContainEqual({ table: "workouts", method: "range", args: [0, 5] });
    expect(calls).toContainEqual({ table: "workouts", method: "eq", args: ["workout_exercises.exercise_id", "bench"] });
    expect(calls).toContainEqual({ table: "sets", method: "in", args: ["workout_exercise_id", ["entry-0", "entry-1", "entry-2", "entry-3", "entry-4"]] });
    expect(calls.some(call => call.table === "workout_exercises")).toBe(false);
  });
  it("returns the next five without accumulating older pages and hides more at the end", async () => {
    const { client, calls } = mockClient({ workouts: [rows(5, 5)], exercises: [{ name: "ベンチプレス" }], sets: [[]] });
    const page = await getWorkoutsForExercise(client, "bench", 1);
    expect(page.workouts.map(workout => workout.id)).toEqual(["5", "6", "7", "8", "9"]);
    expect(page.hasMore).toBe(false);
    expect(calls).toContainEqual({ table: "workouts", method: "range", args: [5, 10] });
    expect(calls).toContainEqual({ table: "workouts", method: "order", args: ["id", { ascending: false }] });
  });
  it("handles an empty page without loading sets", async () => {
    const { client, calls } = mockClient({ workouts: [[]] });
    expect(await getWorkoutsForExercise(client, "bench")).toEqual({ workouts: [], hasMore: false });
    expect(calls.some(call => call.table === "sets")).toBe(false);
  });
  it("rejects invalid page numbers", async () => {
    const { client } = mockClient({});
    await expect(getWorkoutsForExercise(client, "bench", -1)).rejects.toThrow("Invalid history page");
  });
});
