import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll, readByIds } from "@/lib/supabase/read-all";
import { trainingVolume } from "@/lib/domain/training-volume";
import { inclusiveDays, type DateRange } from "@/lib/workouts/period";
import type { Database, Profile } from "@/lib/supabase/database.types";
import { getDefaultBodyPartColorKey } from "@/lib/workouts/body-part-colors";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import { defaultCardioUnits } from "@/lib/workouts/cardio-units";
import type {
  BodyPart,
  BodyPartWorkoutDistribution,
  CardioMetric,
  CardioUnitSettings,
  CreateWorkoutInput,
  Exercise,
  ExerciseMasterInput,
  ExerciseRecord,
  UpdateWorkoutInput,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutStats,
  WorkoutSummary,
} from "@/lib/workouts/types";

type Client = SupabaseClient<Database>;
type ExerciseSettingKey =
  | "rack_position"
  | "memo"
  | "default_set_count"
  | "body_weight_enabled"
  | "bilateral_reps_enabled"
  | "cardio_metrics"
  | "cardio_units";

const allCardioMetrics: CardioMetric[] = ["distance", "duration", "speed", "calories"];
function parseCardioUnits(value: string | undefined): CardioUnitSettings {
  if (!value) {
    return defaultCardioUnits;
  }
  try {
    const parsed = JSON.parse(value) as Partial<CardioUnitSettings>;
    return {
      distance: parsed.distance === "m" ? "m" : "km",
      duration: parsed.duration === "sec" ? "sec" : "min",
      speed: parsed.speed === "ms" ? "ms" : "kmh",
      calories: parsed.calories === "kj" ? "kj" : "kcal",
    };
  } catch {
    return defaultCardioUnits;
  }
}

function parseCardioMetrics(value: string | undefined, isCardio: boolean): CardioMetric[] {
  if (!isCardio) {
    return [];
  }
  if (!value) {
    return allCardioMetrics;
  }
  const selected = value.split(",").filter((metric): metric is CardioMetric =>
    allCardioMetrics.includes(metric as CardioMetric),
  );
  return selected.length > 0 ? selected : allCardioMetrics;
}

type SetRow = {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  is_warmup: boolean;
  is_assisted?: boolean;
  note?: string | null;
  distance_km?: number | null;
  duration_sec?: number | null;
  speed_kmh?: number | null;
  calories_kcal?: number | null;
  left_reps?: number | null;
  right_reps?: number | null;
};

const setSelectColumns = "id, workout_exercise_id, set_number, weight_kg, reps, rir, is_warmup, is_assisted, note, distance_km, duration_sec, speed_kmh, calories_kcal, left_reps, right_reps";

async function getSetsByWorkoutExerciseIds(client: Client, ids: string[]) {
  return (await readByIds(ids, (chunk, from, to) => client.from("sets")
    .select(setSelectColumns).in("workout_exercise_id", chunk).order("set_number").order("id").range(from, to))).data;
}

async function getSetsByWorkoutExerciseId(client: Client, id: string) {
  return getSetsByWorkoutExerciseIds(client, [id]);
}

const exerciseSettingLabels: Record<ExerciseSettingKey, string> = {
  rack_position: "器具位置",
  memo: "メモ",
  default_set_count: "デフォルトセット数",
  body_weight_enabled: "自重入力",
  bilateral_reps_enabled: "左右回数",
  cardio_metrics: "有酸素入力項目",
  cardio_units: "有酸素単位",
};

async function getExerciseSettings(client: Client, exerciseIds: string[]) {
  const settings = new Map<string, Partial<Record<ExerciseSettingKey, string>>>();
  if (exerciseIds.length === 0) {
    return settings;
  }

  const { data, error } = await readByIds(exerciseIds, (chunk, from, to) => client
    .from("exercise_settings")
    .select("exercise_id, setting_key, setting_value")
    .in("exercise_id", chunk)
    .in("setting_key", ["rack_position", "memo", "default_set_count", "body_weight_enabled", "bilateral_reps_enabled", "cardio_metrics", "cardio_units"]).order("id").range(from, to));

  if (error) {
    throw error;
  }

  for (const row of data) {
    const key = row.setting_key as ExerciseSettingKey;
    const current = settings.get(row.exercise_id) ?? {};
    current[key] = row.setting_value;
    settings.set(row.exercise_id, current);
  }

  return settings;
}

async function upsertExerciseSetting(
  client: Client,
  input: {
    userId: string;
    exerciseId: string;
    key: ExerciseSettingKey;
    value: string | null;
    displayOrder: number;
  },
) {
  const value = input.value?.trim() ?? "";
  if (!value) {
    const { error } = await client
      .from("exercise_settings")
      .delete()
      .eq("exercise_id", input.exerciseId)
      .eq("setting_key", input.key);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await client.from("exercise_settings").upsert(
    {
      user_id: input.userId,
      exercise_id: input.exerciseId,
      setting_key: input.key,
      setting_label: exerciseSettingLabels[input.key],
      setting_value: value,
      display_order: input.displayOrder,
    },
    { onConflict: "user_id,exercise_id,setting_key" },
  );

  if (error) {
    throw error;
  }
}

async function saveExerciseSettings(client: Client, exerciseId: string, input: ExerciseMasterInput) {
  await Promise.all([
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "rack_position",
      value: input.rackPosition,
      displayOrder: 1,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "memo",
      value: input.memo,
      displayOrder: 2,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "default_set_count",
      value: input.defaultSetCount === null ? null : String(input.defaultSetCount),
      displayOrder: 3,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "body_weight_enabled",
      value: input.bodyWeightEnabled ? "true" : null,
      displayOrder: 4,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "bilateral_reps_enabled",
      value: input.bilateralRepsEnabled ? "true" : null,
      displayOrder: 5,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "cardio_metrics",
      value: input.cardioMetrics.length > 0 ? input.cardioMetrics.join(",") : null,
      displayOrder: 6,
    }),
    upsertExerciseSetting(client, {
      userId: input.userId,
      exerciseId,
      key: "cardio_units",
      value: input.cardioMetrics.length > 0 ? JSON.stringify(input.cardioUnits) : null,
      displayOrder: 7,
    }),
  ]);
}

function mapSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    rir: row.rir,
    isWarmup: row.is_warmup,
    isAssisted: row.is_assisted ?? false,
    note: row.note ?? null,
    distanceKm: row.distance_km ?? null,
    durationSec: row.duration_sec ?? null,
    speedKmh: row.speed_kmh ?? null,
    caloriesKcal: row.calories_kcal ?? null,
    leftReps: row.left_reps ?? null,
    rightReps: row.right_reps ?? null,
  };
}

export async function getBodyParts(client: Client): Promise<BodyPart[]> {
  const { data: bodyParts, error: bodyPartError } = await readAll((from, to) => client
    .from("body_parts")
    .select("id, key, display_name, display_order")
    .order("display_order").order("id").range(from, to));

  if (bodyPartError) {
    throw bodyPartError;
  }

  const { data: preferences } = await readAll((from, to) => client
    .from("body_part_preferences")
    .select("body_part_id, display_order, color_key").order("id").range(from, to));

  const orderByBodyPartId = new Map(
    (preferences ?? []).map((preference) => [preference.body_part_id, preference.display_order]),
  );
  const colorByBodyPartId = new Map(
    (preferences ?? []).map((preference) => [preference.body_part_id, preference.color_key]),
  );

  return bodyParts
    .map((row) => ({
      id: row.id,
      key: row.key,
      displayName: row.display_name,
      displayOrder: orderByBodyPartId.get(row.id) ?? row.display_order,
      defaultDisplayOrder: row.display_order,
      colorKey: colorByBodyPartId.get(row.id) ?? getDefaultBodyPartColorKey(row.key),
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function reorderBodyParts(
  client: Client,
  input: { userId: string; bodyParts: Array<{ id: string; colorKey: string }> },
) {
  const { error } = await client.from("body_part_preferences").upsert(
    input.bodyParts.map((bodyPart, index) => ({
      user_id: input.userId,
      body_part_id: bodyPart.id,
      display_order: index + 1,
      color_key: bodyPart.colorKey,
    })),
    { onConflict: "user_id,body_part_id" },
  );

  if (error) {
    throw error;
  }
}

export async function getExercises(
  client: Client,
  options: { includeInactive?: boolean } = {},
): Promise<Exercise[]> {
  const { data, error } = await readAll((from, to) => {
    let query = client.from("exercises")
      .select("id, body_part_id, name, display_order, active, body_parts(key)")
      .order("display_order").order("id");
    if (!options.includeInactive) query = query.eq("active", true);
    return query.range(from, to);
  });

  if (error) {
    throw error;
  }

  const settings = await getExerciseSettings(
    client,
    data.map((row) => row.id),
  );

  return data.map((row) => {
    const exerciseSettings = settings.get(row.id);
    const bodyParts = row.body_parts as { key?: string } | null;
    return {
      id: row.id,
      bodyPartId: row.body_part_id,
      bodyPartKey: bodyParts?.key ?? null,
      name: row.name,
      displayOrder: row.display_order,
      active: row.active,
      rackPosition: exerciseSettings?.rack_position ?? null,
      memo: exerciseSettings?.memo ?? null,
      defaultSetCount: exerciseSettings?.default_set_count
        ? Number(exerciseSettings.default_set_count)
        : null,
      bodyWeightEnabled: exerciseSettings?.body_weight_enabled === "true",
      bilateralRepsEnabled: exerciseSettings?.bilateral_reps_enabled === "true",
      cardioMetrics: parseCardioMetrics(
        exerciseSettings?.cardio_metrics,
        bodyParts?.key === "cardio",
      ),
      cardioUnits: parseCardioUnits(exerciseSettings?.cardio_units),
    };
  });
}

export async function createExercise(client: Client, input: ExerciseMasterInput) {
  const { data, error } = await client
    .from("exercises")
    .insert({
      user_id: input.userId,
      body_part_id: input.bodyPartId,
      name: input.name.trim(),
      display_order: input.displayOrder,
      active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await saveExerciseSettings(client, data.id, input);
}

export async function updateExercise(
  client: Client,
  exerciseId: string,
  input: ExerciseMasterInput,
) {
  const { error } = await client
    .from("exercises")
    .update({
      body_part_id: input.bodyPartId,
      name: input.name.trim(),
      display_order: input.displayOrder,
    })
    .eq("id", exerciseId);

  if (error) {
    throw error;
  }

  await saveExerciseSettings(client, exerciseId, input);
}

export async function reorderExercises(
  client: Client,
  input: { userId: string; bodyPartId: string; exerciseIds: string[] },
) {
  for (const [index, exerciseId] of input.exerciseIds.entries()) {
    const { error } = await client
      .from("exercises")
      .update({ display_order: index + 1, body_part_id: input.bodyPartId })
      .eq("id", exerciseId)
      .eq("user_id", input.userId);

    if (error) {
      throw error;
    }
  }
}

export async function archiveExercise(client: Client, exerciseId: string) {
  const { error } = await client
    .from("exercises")
    .update({ active: false, archived_at: new Date().toISOString() })
    .eq("id", exerciseId);

  if (error) {
    throw error;
  }
}

export async function getWorkoutSummaries(
  client: Client,
  startDate: string,
  endDate: string,
  includeSetCounts = true,
): Promise<WorkoutSummary[]> {
  const { data: workouts, error: workoutError } = await readAll((from, to) => client
    .from("workouts")
    .select("id, workout_date, created_at")
    .gte("workout_date", startDate)
    .lte("workout_date", endDate)
    .order("workout_date")
    .order("created_at", { ascending: true }).order("id").range(from, to));

  if (workoutError) {
    throw workoutError;
  }
  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((workout) => workout.id);
  const bodyParts = await getBodyParts(client);
  const bodyPartMetaByKey = new Map(
    bodyParts.map((bodyPart) => [bodyPart.key, { key: bodyPart.key, colorKey: bodyPart.colorKey }]),
  );
  const { data: workoutExercises, error: workoutExerciseError } = await readByIds(workoutIds, (chunk, from, to) => client
    .from("workout_exercises")
    .select("id, workout_id, exercises(body_parts(key))")
    .in("workout_id", chunk).order("id").range(from, to));

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const setsByWorkoutExercise = new Map<string, number>();
  if (includeSetCounts && workoutExerciseIds.length > 0) {
    const { data: sets, error: setError } = await readByIds(workoutExerciseIds, (chunk, from, to) => client
      .from("sets")
      .select("workout_exercise_id")
      .in("workout_exercise_id", chunk).order("id").range(from, to));

    if (setError) {
      throw setError;
    }

    for (const set of sets) {
      setsByWorkoutExercise.set(
        set.workout_exercise_id,
        (setsByWorkoutExercise.get(set.workout_exercise_id) ?? 0) + 1,
      );
    }
  }

  const exercisesByWorkout = new Map<
    string,
    { exerciseCount: number; setCount: number; bodyPartKeys: Set<string> }
  >();
  const workoutOrder = new Map(workouts.map((workout, index) => [workout.id, index]));
  for (const workoutExercise of [...workoutExercises].sort(
    (a, b) => (workoutOrder.get(a.workout_id) ?? 0) - (workoutOrder.get(b.workout_id) ?? 0),
  )) {
    const current = exercisesByWorkout.get(workoutExercise.workout_id) ?? {
      exerciseCount: 0,
      setCount: 0,
      bodyPartKeys: new Set<string>(),
    };
    const exercise = workoutExercise.exercises as {
      body_parts?: { key?: string } | null;
    } | null;
    current.exerciseCount += 1;
    current.setCount += setsByWorkoutExercise.get(workoutExercise.id) ?? 0;
    if (exercise?.body_parts?.key) {
      current.bodyPartKeys.add(exercise.body_parts.key);
    }
    exercisesByWorkout.set(workoutExercise.workout_id, current);
  }

  const summariesByDate = new Map<
    string,
    { id: string; workoutDate: string; exerciseCount: number; setCount: number; bodyPartKeys: Set<string> }
  >();

  for (const workout of workouts) {
    const counts = exercisesByWorkout.get(workout.id) ?? {
      exerciseCount: 0,
      setCount: 0,
      bodyPartKeys: new Set<string>(),
    };
    const current =
      summariesByDate.get(workout.workout_date) ??
      {
        id: workout.id,
        workoutDate: workout.workout_date,
        exerciseCount: 0,
        setCount: 0,
        bodyPartKeys: new Set<string>(),
      };
    current.exerciseCount += counts.exerciseCount;
    current.setCount += counts.setCount;
    for (const bodyPartKey of counts.bodyPartKeys) {
      current.bodyPartKeys.add(bodyPartKey);
    }
    summariesByDate.set(workout.workout_date, current);
  }

  return [...summariesByDate.values()].map((summary) => ({
    id: summary.id,
    workoutDate: summary.workoutDate,
    exerciseCount: summary.exerciseCount,
    setCount: summary.setCount,
    bodyParts: [...summary.bodyPartKeys].map(
      (bodyPartKey) =>
        bodyPartMetaByKey.get(bodyPartKey) ?? {
          key: bodyPartKey,
          colorKey: getDefaultBodyPartColorKey(bodyPartKey),
        },
    ),
  }));
}

export async function getWorkoutStats(
  client: Client,
  profile: Profile | null = null,
  today = new Date(),
  range?: DateRange,
): Promise<WorkoutStats> {
  const { data, error } = await readAll((from, to) => {
    let query = client.from("workouts").select("id, workout_date").order("workout_date").order("id");
    if (range) query = query.gte("workout_date", range.start).lte("workout_date", range.end);
    return query.range(from, to);
  });

  if (error) {
    throw error;
  }

  const workoutDates = [...new Set(data.map((workout) => workout.workout_date))].sort();
  const totalWorkoutDays = workoutDates.length;
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const monthWorkoutDays = workoutDates.filter((date) => date.startsWith(currentMonth)).length;
  const averageDailyCalories = await getAverageDailyCalories(client, data, profile);

  if (workoutDates.length === 0) {
    return {
      totalWorkoutDays,
      monthWorkoutDays,
      weeklyAverageWorkoutDays: 0,
      averageDailyCalories,
    };
  }

  const end = range?.end ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const elapsedDays = inclusiveDays(range?.start ?? workoutDates[0], end);
  const elapsedWeeks = Math.max(1, elapsedDays / 7);

  return {
    totalWorkoutDays,
    monthWorkoutDays,
    weeklyAverageWorkoutDays: Number((totalWorkoutDays / elapsedWeeks).toFixed(1)),
    averageDailyCalories,
  };
}

async function getAverageDailyCalories(
  client: Client,
  workouts: Array<{ id: string; workout_date: string }>,
  profile: Profile | null,
) {
  if (workouts.length === 0) {
    return 0;
  }

  const exercises = await getExercises(client);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const workoutDateById = new Map(workouts.map((workout) => [workout.id, workout.workout_date]));
  const workoutIds = workouts.map((workout) => workout.id);
  const { data: workoutExercises, error: workoutExerciseError } = await readByIds(workoutIds, (chunk, from, to) => client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id")
    .in("workout_id", chunk).order("id").range(from, to));

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }
  if (workoutExercises.length === 0) {
    return 0;
  }

  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const { data: sets, error: setError } = await readByIds(workoutExerciseIds, (chunk, from, to) => client
    .from("sets")
    .select("workout_exercise_id, weight_kg, reps, left_reps, right_reps, is_warmup, duration_sec, distance_km, speed_kmh, calories_kcal")
    .in("workout_exercise_id", chunk).order("id").range(from, to));

  if (setError) {
    throw setError;
  }

  const setsByWorkoutExercise = new Map<string, Array<{ weightKg: number | null; reps: number | null; leftReps: number | null; rightReps: number | null; isWarmup: boolean; durationSec: number | null; distanceKm: number | null; speedKmh: number | null; caloriesKcal: number | null }>>();
  for (const set of sets) {
    const current = setsByWorkoutExercise.get(set.workout_exercise_id) ?? [];
    current.push({
      weightKg: set.weight_kg,
      reps: set.reps,
      leftReps: set.left_reps,
      rightReps: set.right_reps,
      isWarmup: set.is_warmup,
      durationSec: set.duration_sec,
      distanceKm: set.distance_km,
      speedKmh: set.speed_kmh,
      caloriesKcal: set.calories_kcal,
    });
    setsByWorkoutExercise.set(set.workout_exercise_id, current);
  }

  const caloriesByDate = new Map<string, number>();
  for (const workoutExercise of workoutExercises) {
    const workoutDate = workoutDateById.get(workoutExercise.workout_id);
    if (!workoutDate) {
      continue;
    }
    const calories = estimateWorkoutExerciseCalories({
      profile,
      exercise: exerciseById.get(workoutExercise.exercise_id) ?? null,
      sets: setsByWorkoutExercise.get(workoutExercise.id) ?? [],
    });
    caloriesByDate.set(workoutDate, (caloriesByDate.get(workoutDate) ?? 0) + calories);
  }

  const totalCalories = [...caloriesByDate.values()].reduce((total, calories) => total + calories, 0);
  return caloriesByDate.size > 0 ? Math.round(totalCalories / caloriesByDate.size) : 0;
}

export async function getBodyPartWorkoutDistribution(
  client: Client,
  range?: DateRange,
): Promise<BodyPartWorkoutDistribution[]> {
  const { data, error } = await readAll((from, to) => {
    let query = client.from("workout_exercises")
      .select("workouts!inner(workout_date), exercises(body_part_id, body_parts(key, display_name))").order("id");
    if (range) query = query.gte("workouts.workout_date", range.start).lte("workouts.workout_date", range.end);
    return query.range(from, to);
  });

  if (error) {
    throw error;
  }

  const configuredBodyParts = await getBodyParts(client);
  const configuredBodyPartById = new Map(configuredBodyParts.map((bodyPart) => [bodyPart.id, bodyPart]));
  const datesByBodyPart = new Map<
    string,
    { bodyPartId: string; bodyPartKey: string; bodyPartName: string; colorKey: string; dates: Set<string> }
  >();

  for (const row of data) {
    const workout = row.workouts as { workout_date?: string } | null;
    const exercise = row.exercises as {
      body_part_id?: string;
      body_parts?: { key?: string; display_name?: string } | null;
    } | null;
    const bodyPartId = exercise?.body_part_id;
    const workoutDate = workout?.workout_date;
    if (!bodyPartId || !workoutDate) {
      continue;
    }

    const configuredBodyPart = configuredBodyPartById.get(bodyPartId);
    const current =
      datesByBodyPart.get(bodyPartId) ??
      {
        bodyPartId,
        bodyPartKey: configuredBodyPart?.key ?? exercise.body_parts?.key ?? "unknown",
        bodyPartName: configuredBodyPart?.displayName ?? exercise.body_parts?.display_name ?? "未設定",
        colorKey: configuredBodyPart?.colorKey ?? getDefaultBodyPartColorKey(exercise.body_parts?.key),
        dates: new Set<string>(),
      };
    current.dates.add(workoutDate);
    datesByBodyPart.set(bodyPartId, current);
  }

  return [...datesByBodyPart.values()]
    .map((item) => ({
      bodyPartId: item.bodyPartId,
      bodyPartKey: item.bodyPartKey,
      bodyPartName: item.bodyPartName,
      colorKey: item.colorKey,
      workoutDays: item.dates.size,
    }))
    .sort((a, b) => b.workoutDays - a.workoutDays || a.bodyPartName.localeCompare(b.bodyPartName, "ja"));
}

export async function getWorkoutsByDate(client: Client, workoutDate: string): Promise<Workout[]> {
  const { data: workouts, error: workoutError } = await readAll((from, to) => client
    .from("workouts")
    .select("id, workout_date, note, created_at")
    .eq("workout_date", workoutDate)
    .order("created_at", { ascending: false }).order("id").range(from, to));

  if (workoutError) {
    throw workoutError;
  }
  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((workout) => workout.id);
  const { data: workoutExercises, error: workoutExerciseError } = await readByIds(workoutIds, (chunk, from, to) => client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id, display_order, note, condition, elapsed_sec")
    .in("workout_id", chunk)
    .order("display_order").order("id").range(from, to));

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const exerciseIds = [...new Set(workoutExercises.map((item) => item.exercise_id))];
  const exerciseNames = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exerciseError } = await readByIds(exerciseIds, (chunk, from, to) => client
      .from("exercises")
      .select("id, name")
      .in("id", chunk).order("id").range(from, to));

    if (exerciseError) {
      throw exerciseError;
    }

    for (const exercise of exercises) {
      exerciseNames.set(exercise.id, exercise.name);
    }
  }

  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
  if (workoutExerciseIds.length > 0) {
    const sets = await getSetsByWorkoutExerciseIds(client, workoutExerciseIds);

    for (const set of sets) {
      const current = setsByWorkoutExercise.get(set.workout_exercise_id) ?? [];
      current.push(mapSet(set));
      setsByWorkoutExercise.set(set.workout_exercise_id, current);
    }
  }

  const workoutDateById = new Map(workouts.map((workout) => [workout.id, workout.workout_date]));
  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const workoutExercise of workoutExercises) {
    const current = exercisesByWorkout.get(workoutExercise.workout_id) ?? [];
    current.push({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exercise_id,
      exerciseName: exerciseNames.get(workoutExercise.exercise_id) ?? "未設定の種目",
      workoutDate: workoutDateById.get(workoutExercise.workout_id) ?? workoutDate,
      displayOrder: workoutExercise.display_order,
      note: workoutExercise.note,
      condition: workoutExercise.condition,
      elapsedSec: workoutExercise.elapsed_sec,
      sets: setsByWorkoutExercise.get(workoutExercise.id) ?? [],
    });
    exercisesByWorkout.set(workoutExercise.workout_id, current);
  }

  return workouts.map((workout) => ({
    id: workout.id,
    workoutDate: workout.workout_date,
    createdAt: workout.created_at,
    note: workout.note,
    exercises: exercisesByWorkout.get(workout.id) ?? [],
  }));
}

export const EXERCISE_HISTORY_PAGE_SIZE = 5;

export function appendHistoryRecords(current: Workout[], next: Workout[]): Workout[] {
  return [...new Map([...current, ...next].map(workout => [workout.id, workout])).values()];
}

export async function getWorkoutsForExercise(
  client: Client,
  exerciseId: string,
  page = 0,
): Promise<{ workouts: Workout[]; hasMore: boolean }> {
  if (!Number.isInteger(page) || page < 0) throw new Error("Invalid history page");
  const offset = page * EXERCISE_HISTORY_PAGE_SIZE;
  // One extra metadata row determines whether another page exists. Only the
  // visible five workouts have their sets fetched; no full-history ID query.
  const { data, error } = await client.from("workouts")
    .select("id, workout_date, note, created_at, workout_exercises!inner(id, exercise_id, display_order, note, condition, elapsed_sec)")
    .eq("workout_exercises.exercise_id", exerciseId)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + EXERCISE_HISTORY_PAGE_SIZE);
  if (error) throw error;
  const visible = data.slice(0, EXERCISE_HISTORY_PAGE_SIZE);
  if (!visible.length) return { workouts: [], hasMore: false };

  const { data: exercise, error: exerciseError } = await client.from("exercises")
    .select("name").eq("id", exerciseId).single();
  if (exerciseError) throw exerciseError;
  const ids = visible.flatMap(workout => workout.workout_exercises.map(entry => entry.id));
  const sets = await getSetsByWorkoutExerciseIds(client, ids);
  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const group = setsByExercise.get(set.workout_exercise_id) ?? [];
    group.push(mapSet(set));
    setsByExercise.set(set.workout_exercise_id, group);
  }
  return {
    hasMore: data.length > EXERCISE_HISTORY_PAGE_SIZE,
    workouts: visible.map(workout => ({
      id: workout.id, workoutDate: workout.workout_date,
      createdAt: workout.created_at, note: workout.note,
      exercises: workout.workout_exercises.map(entry => ({
        id: entry.id, exerciseId: entry.exercise_id, exerciseName: exercise.name,
        workoutDate: workout.workout_date, displayOrder: entry.display_order,
        note: entry.note, condition: entry.condition, elapsedSec: entry.elapsed_sec,
        sets: setsByExercise.get(entry.id) ?? [],
      })),
    })),
  };
}

// The history cards only need the maximum weight, not every historical set.
export async function getExerciseWeightRecords(client: Client, exercises: Exercise[]): Promise<ExerciseRecord[]> {
  return Promise.all(exercises.map(async exercise => {
    const { data, error } = await client.from("sets")
      .select("weight_kg, workout_exercises!inner(exercise_id)")
      .eq("workout_exercises.exercise_id", exercise.id)
      .not("weight_kg", "is", null)
      .order("weight_kg", { ascending: false }).limit(1);
    if (error) throw error;
    return {
      exerciseId: exercise.id, exerciseName: exercise.name,
      bodyPartId: exercise.bodyPartId, displayOrder: exercise.displayOrder,
      maxWeightKg: data[0]?.weight_kg ?? null,
      maxVolumeKg: null, lastWorkoutDate: null,
    };
  }));
}

export async function getLatestWorkoutForExerciseBeforeDate(
  client: Client,
  exerciseId: string,
  beforeDate: string,
  reference?: { id: string; createdAt: string },
): Promise<WorkoutExercise | null> {
  // Include earlier sessions on the same day, but never the record being edited.
  for (let offset = 0; ; offset += 60) {
    const { data: workouts, error: workoutError } = await client
      .from("workouts")
      .select("id, workout_date, created_at")
      .lte("workout_date", beforeDate)
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 59);

    if (workoutError) {
      throw workoutError;
    }
    if (workouts.length === 0) {
      return null;
    }

    const workoutIds = workouts.filter(workout => !reference || (workout.id !== reference.id &&
      (workout.workout_date < beforeDate || workout.created_at < reference.createdAt))).map((workout) => workout.id);
    if (workoutIds.length === 0) {
      if (workouts.length < 60) return null;
      continue;
    }
    const workoutDateById = new Map(workouts.map((workout) => [workout.id, workout.workout_date]));
    const { data: workoutExercises, error: workoutExerciseError } = await readByIds(workoutIds, (chunk, from, to) => client
      .from("workout_exercises")
      .select("id, workout_id, exercise_id, display_order, note, condition, elapsed_sec")
      .eq("exercise_id", exerciseId)
      .in("workout_id", chunk).order("id").range(from, to));

    if (workoutExerciseError) {
      throw workoutExerciseError;
    }
    if (workoutExercises.length === 0) {
      if (workouts.length < 60) return null;
      continue;
    }

    const latest = [...workoutExercises].sort((a, b) =>
      workoutIds.indexOf(a.workout_id) - workoutIds.indexOf(b.workout_id),
    )[0];
    const { data: exercise, error: exerciseError } = await client
      .from("exercises")
      .select("name")
      .eq("id", exerciseId)
      .single();

    if (exerciseError) {
      throw exerciseError;
    }

    const sets = await getSetsByWorkoutExerciseId(client, latest.id);

    return {
      id: latest.id,
      exerciseId,
      exerciseName: exercise.name,
      workoutDate: workoutDateById.get(latest.workout_id) ?? beforeDate,
      displayOrder: latest.display_order,
      note: latest.note,
      condition: latest.condition,
      elapsedSec: latest.elapsed_sec,
      sets: sets.map(mapSet),
    };
  }
}

export async function getDayCondition(client: Client, date: string): Promise<string> {
  const { data: workouts, error } = await readAll((from, to) => client.from("workouts").select("id").eq("workout_date", date).order("id").range(from, to));
  if (error) throw error;
  if (!workouts.length) return "";
  const { data, error: conditionError } = await client.from("workout_exercises").select("condition")
    .in("workout_id", workouts.map(workout => workout.id)).not("condition", "is", null)
    .neq("condition", "").order("created_at", { ascending: false }).limit(1);
  if (conditionError) throw conditionError;
  return data[0]?.condition ?? "";
}

export async function getExerciseRecords(
  client: Client,
  selectedExercises?: Exercise[],
): Promise<ExerciseRecord[]> {
  const exercises = selectedExercises ?? await getExercises(client);
  if (exercises.length === 0) {
    return [];
  }

  const exerciseIds = exercises.map((exercise) => exercise.id);
  const { data: workoutExercises, error: workoutExerciseError } = await readByIds(exerciseIds, (chunk, from, to) => client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id")
    .in("exercise_id", chunk).order("id").range(from, to));

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const records = new Map<string, ExerciseRecord>(
    exercises.map((exercise) => [
      exercise.id,
      {
        exerciseId: exercise.id,
        bodyPartId: exercise.bodyPartId,
        exerciseName: exercise.name,
        displayOrder: exercise.displayOrder,
        maxWeightKg: null,
        maxVolumeKg: null,
        lastWorkoutDate: null,
      },
    ]),
  );

  if (workoutExercises.length === 0) {
    return [...records.values()];
  }

  const workoutIds = [...new Set(workoutExercises.map((item) => item.workout_id))];
  const { data: workouts, error: workoutError } = await readByIds(workoutIds, (chunk, from, to) => client
    .from("workouts")
    .select("id, workout_date")
    .in("id", chunk).order("id").range(from, to));

  if (workoutError) {
    throw workoutError;
  }

  const dateByWorkoutId = new Map(workouts.map((workout) => [workout.id, workout.workout_date]));
  const exerciseIdByWorkoutExerciseId = new Map(
    workoutExercises.map((item) => [item.id, item.exercise_id]),
  );
  const workoutIdByWorkoutExerciseId = new Map(
    workoutExercises.map((item) => [item.id, item.workout_id]),
  );
  const { data: sets, error: setError } = await readByIds(workoutExercises.map((item) => item.id), (chunk, from, to) => client
    .from("sets")
    .select("workout_exercise_id, weight_kg, reps, left_reps, right_reps")
    .in("workout_exercise_id", chunk).order("id").range(from, to));

  if (setError) {
    throw setError;
  }

  for (const workoutExercise of workoutExercises) {
    const record = records.get(workoutExercise.exercise_id);
    const workoutDate = dateByWorkoutId.get(workoutExercise.workout_id) ?? null;
    if (record && workoutDate && (!record.lastWorkoutDate || workoutDate > record.lastWorkoutDate)) {
      record.lastWorkoutDate = workoutDate;
    }
  }

  for (const set of sets) {
    const exerciseId = exerciseIdByWorkoutExerciseId.get(set.workout_exercise_id);
    if (!exerciseId) {
      continue;
    }
    const record = records.get(exerciseId);
    if (!record) {
      continue;
    }
    if (set.weight_kg !== null) {
      record.maxWeightKg = Math.max(record.maxWeightKg ?? 0, set.weight_kg);
    }
    const volume = trainingVolume(set.weight_kg, set.reps, set.left_reps, set.right_reps);
    if (volume !== null) {
      record.maxVolumeKg = Math.max(record.maxVolumeKg ?? 0, volume);
    }
    const workoutId = workoutIdByWorkoutExerciseId.get(set.workout_exercise_id);
    const workoutDate = workoutId ? dateByWorkoutId.get(workoutId) : null;
    if (workoutDate && (!record.lastWorkoutDate || workoutDate > record.lastWorkoutDate)) {
      record.lastWorkoutDate = workoutDate;
    }
  }

  return [...records.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

async function saveWorkout(client: Client, input: CreateWorkoutInput | UpdateWorkoutInput) {
  const sets = input.sets.filter(set =>
    [set.weightKg, set.reps, set.note, set.distanceKm, set.durationSec, set.speedKmh,
      set.caloriesKcal, set.leftReps, set.rightReps].some(value => value !== null));
  if (!sets.length || sets.length > 200) throw new Error("Expected 1 to 200 sets");
  const { data, error } = await client.rpc("save_workout", {
    p_workout_id: "workoutId" in input ? input.workoutId : null,
    p_workout_exercise_id: "workoutExerciseId" in input ? input.workoutExerciseId : null,
    p_workout_date: input.workoutDate, p_exercise_id: input.exerciseId,
    p_note: input.note, p_condition: input.condition, p_elapsed_sec: input.elapsedSec,
    p_sets: sets.map(set => ({
      weight_kg: set.weightKg, reps: set.reps, is_warmup: set.isWarmup,
      is_assisted: set.isAssisted, note: set.note, distance_km: set.distanceKm,
      duration_sec: set.durationSec, speed_kmh: set.speedKmh, calories_kcal: set.caloriesKcal,
      left_reps: set.leftReps, right_reps: set.rightReps,
    })),
  });
  // Never fall back to separate writes or discard unsupported fields.
  if (error) throw error;
  return data;
}

export async function createWorkout(client: Client, input: CreateWorkoutInput) {
  return saveWorkout(client, input);
}

export async function updateWorkout(client: Client, input: UpdateWorkoutInput) {
  return saveWorkout(client, input);
}

export async function updateWorkoutExerciseConditions(
  client: Client,
  userId: string,
  workoutExerciseIds: string[],
  condition: string | null,
) {
  if (workoutExerciseIds.length === 0) {
    return;
  }
  const { error } = await client
    .from("workout_exercises")
    .update({ condition })
    .eq("user_id", userId)
    .in("id", workoutExerciseIds);

  if (error) {
    throw error;
  }
}

export async function deleteWorkout(client: Client, workoutId: string) {
  const { error } = await client.from("workouts").delete().eq("id", workoutId);

  if (error) {
    throw error;
  }
}
