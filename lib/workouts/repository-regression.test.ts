import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createWorkout, getBodyPartWorkoutDistribution, getDayConditions, getExerciseRecords, getWorkoutsInRange, getWorkoutStats, updateWorkout } from "./repository";
import { createInitialSetDraft, toSetInputs } from "./entry-draft";
import type { CreateWorkoutInput, Exercise } from "./types";

const input: CreateWorkoutInput = {
  userId: "user", exerciseId: "bench", workoutDate: "2026-09-25", note: "note", condition: null, elapsedSec: null,
  sets: toSetInputs([{ ...createInitialSetDraft(), weightKg: "20", reps: "10" }], null),
};

describe("atomic writes", () => {
  it("makes one RPC for creation and updates, including every set field", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "workout", error: null });
    const client = { rpc } as unknown as SupabaseClient<Database>;
    expect(await createWorkout(client, input)).toBe("workout");
    await updateWorkout(client, { ...input, workoutId: "workout", workoutExerciseId: "entry" });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_workout_id: null, p_sets: [{ weight_kg: 20, reps: 10, note: null, left_reps: null }] });
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_workout_id: "workout", p_workout_exercise_id: "entry" });
  });
  it("never falls back to destructive writes when the RPC is missing or fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not deployed" } });
    const from = vi.fn();
    const client = { rpc, from } as unknown as SupabaseClient<Database>;
    await expect(updateWorkout(client, { ...input, workoutId: "workout", workoutExerciseId: "entry" })).rejects.toMatchObject({ code: "PGRST202" });
    expect(from).not.toHaveBeenCalled();
  });
});

// A small Data API simulator applies filters and a response cap. Returning
// precomputed responses would miss accidental pagination/filter regressions.
type Row = Record<string, unknown>;
function dataClient(tables: Record<string, Row[]>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = { from(table: string) {
    let rows = [...(tables[table] ?? [])];
    let from = 0;
    let to = 999;
    const builder = new Proxy({}, { get(_target, method: string) {
      if (method === "then") return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }).then.bind(Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }));
      return (...args: unknown[]) => {
        calls.push({ table, method, args });
        const key = String(args[0]);
        if (method === "in") rows = rows.filter(row => (args[1] as unknown[]).includes(row[key]));
        if (method === "eq") rows = rows.filter(row => row[key] === args[1]);
        if (method === "gte") rows = rows.filter(row => String(row[key]) >= String(args[1]));
        if (method === "lte") rows = rows.filter(row => String(row[key]) <= String(args[1]));
        if (method === "range") { from = Number(args[0]); to = Number(args[1]); }
        return builder;
      };
    } });
    return builder;
  } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

it("includes the 1101st set in maximum weight and bilateral volume", async () => {
  const sets = Array.from({ length: 1101 }, (_, i) => ({ id: String(i), workout_exercise_id: "entry", weight_kg: i === 1100 ? 50 : 10, reps: i === 1100 ? null : 1, left_reps: i === 1100 ? 10 : null, right_reps: i === 1100 ? 12 : null }));
  const { client } = dataClient({ sets, workout_exercises: [{ id: "entry", workout_id: "workout", exercise_id: "bench" }], workouts: [{ id: "workout", workout_date: "2026-09-25" }] });
  const records = await getExerciseRecords(client, [{ id: "bench", name: "Bench", bodyPartId: "chest", displayOrder: 1 } as Exercise]);
  expect(records[0]).toMatchObject({ maxWeightKg: 50, maxVolumeKg: 1100, lastWorkoutDate: "2026-09-25" });
});

it("filters home statistics by inclusive dates and computes weekly average over the chosen period", async () => {
  const workouts = Array.from({ length: 1101 }, (_, i) => ({ id: String(i), workout_date: i < 1100 ? "2026-09-19" : "2026-09-25" }));
  workouts.push({ id: "old", workout_date: "2026-09-18" }, { id: "future", workout_date: "2026-09-26" });
  const { client, calls } = dataClient({ workouts });
  const range = { start: "2026-09-19", end: "2026-09-25" };
  expect(await getWorkoutStats(client, null, new Date(2026, 8, 25), range)).toMatchObject({ totalWorkoutDays: 2, monthWorkoutDays: 2, weeklyAverageWorkoutDays: 2 });
  await getBodyPartWorkoutDistribution(client, range);
  expect(calls).toContainEqual({ table: "workout_exercises", method: "gte", args: ["workouts.workout_date", range.start] });
  expect(calls).toContainEqual({ table: "workout_exercises", method: "lte", args: ["workouts.workout_date", range.end] });
});

it("exports all 1101 sets with inclusive range bounds and excludes out-of-range workouts", async () => {
  const { client } = dataClient({
    workouts: [{ id: "w", workout_date: "2026-09-25", created_at: "2026-09-25" }, { id: "old", workout_date: "2026-09-24" }],
    workout_exercises: [{ id: "e", workout_id: "w", exercise_id: "x", display_order: 1 }],
    exercises: [{ id: "x", name: "Archived exercise" }],
    sets: Array.from({ length: 1101 }, (_, i) => ({ id: String(i), workout_exercise_id: "e", set_number: i + 1, weight_kg: 1 })),
  });
  const records = await getWorkoutsInRange(client, { start: "2026-09-25", end: "2026-09-25" });
  expect(records).toHaveLength(1);
  expect(records[0].exercises[0].sets).toHaveLength(1101);
});

it("gets the latest nonempty daily condition across exercises and ID batches", async () => {
  const { client, calls } = dataClient({
    workouts: Array.from({ length: 102 }, (_, i) => ({ id: String(i), workout_date: "2026-09-25" })),
    workout_exercises: [{ id: "a", workout_id: "0", condition: "old", created_at: "2026-09-25T01:00:00" }, { id: "b", workout_id: "100", condition: "new", created_at: "2026-09-25T02:00:00" }, { id: "c", workout_id: "101", condition: "  ", created_at: "2026-09-25T03:00:00" }],
  });
  expect(await getDayConditions(client, ["2026-09-25"])).toEqual({ "2026-09-25": "new" });
  expect(calls.filter(call => call.table === "workout_exercises" && call.method === "in").every(call => (call.args[1] as unknown[]).length <= 100)).toBe(true);
});
