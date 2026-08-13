import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/database.types";
import { getDefaultBodyPartColorKey } from "@/lib/workouts/body-part-colors";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import type {
  BodyPart,
  BodyPartWorkoutDistribution,
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
type ExerciseSettingKey = "rack_position" | "memo";

const exerciseSettingLabels: Record<ExerciseSettingKey, string> = {
  rack_position: "ラック位置",
  memo: "メモ",
};

async function getExerciseSettings(client: Client, exerciseIds: string[]) {
  const settings = new Map<string, Partial<Record<ExerciseSettingKey, string>>>();
  if (exerciseIds.length === 0) {
    return settings;
  }

  const { data, error } = await client
    .from("exercise_settings")
    .select("exercise_id, setting_key, setting_value")
    .in("exercise_id", exerciseIds)
    .in("setting_key", ["rack_position", "memo"]);

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
  ]);
}

function mapSet(row: {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  is_warmup: boolean;
}): WorkoutSet {
  return {
    id: row.id,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    rir: row.rir,
    isWarmup: row.is_warmup,
  };
}

export async function getBodyParts(client: Client): Promise<BodyPart[]> {
  const { data: bodyParts, error: bodyPartError } = await client
    .from("body_parts")
    .select("id, key, display_name, display_order")
    .order("display_order");

  if (bodyPartError) {
    throw bodyPartError;
  }

  const { data: preferences, error: preferenceError } = await client
    .from("body_part_preferences")
    .select("body_part_id, display_order, color_key");

  const isPreferenceTableUnavailable =
    preferenceError &&
    (preferenceError.code === "42P01" ||
      (preferenceError.code === "PGRST205" &&
        preferenceError.message.includes("body_part_preferences")));

  if (preferenceError && !isPreferenceTableUnavailable) {
    throw preferenceError;
  }

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
  let query = client
    .from("exercises")
    .select("id, body_part_id, name, display_order, active, body_parts(key)")
    .order("display_order");

  if (!options.includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

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
): Promise<WorkoutSummary[]> {
  const { data: workouts, error: workoutError } = await client
    .from("workouts")
    .select("id, workout_date")
    .gte("workout_date", startDate)
    .lte("workout_date", endDate)
    .order("workout_date");

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
  const { data: workoutExercises, error: workoutExerciseError } = await client
    .from("workout_exercises")
    .select("id, workout_id, exercises(body_parts(key))")
    .in("workout_id", workoutIds);

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const setsByWorkoutExercise = new Map<string, number>();
  if (workoutExerciseIds.length > 0) {
    const { data: sets, error: setError } = await client
      .from("sets")
      .select("workout_exercise_id")
      .in("workout_exercise_id", workoutExerciseIds);

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
  for (const workoutExercise of workoutExercises) {
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
): Promise<WorkoutStats> {
  const { data, error } = await client
    .from("workouts")
    .select("id, workout_date")
    .order("workout_date");

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

  const firstWorkoutDate = new Date(`${workoutDates[0]}T00:00:00`);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const elapsedDays = Math.max(
    1,
    Math.floor((todayStart.getTime() - firstWorkoutDate.getTime()) / 86_400_000) + 1,
  );
  const elapsedWeeks = Math.max(1, Math.ceil(elapsedDays / 7));

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
  const { data: workoutExercises, error: workoutExerciseError } = await client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id")
    .in("workout_id", workoutIds);

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }
  if (workoutExercises.length === 0) {
    return 0;
  }

  const workoutExerciseIds = workoutExercises.map((item) => item.id);
  const { data: sets, error: setError } = await client
    .from("sets")
    .select("workout_exercise_id, weight_kg, reps, is_warmup")
    .in("workout_exercise_id", workoutExerciseIds);

  if (setError) {
    throw setError;
  }

  const setsByWorkoutExercise = new Map<string, Array<{ weightKg: number | null; reps: number | null; isWarmup: boolean }>>();
  for (const set of sets) {
    const current = setsByWorkoutExercise.get(set.workout_exercise_id) ?? [];
    current.push({
      weightKg: set.weight_kg,
      reps: set.reps,
      isWarmup: set.is_warmup,
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
): Promise<BodyPartWorkoutDistribution[]> {
  const { data, error } = await client
    .from("workout_exercises")
    .select("workouts(workout_date), exercises(body_part_id, body_parts(key, display_name))");

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
  const { data: workouts, error: workoutError } = await client
    .from("workouts")
    .select("id, workout_date, note, created_at")
    .eq("workout_date", workoutDate)
    .order("created_at", { ascending: false });

  if (workoutError) {
    throw workoutError;
  }
  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((workout) => workout.id);
  const { data: workoutExercises, error: workoutExerciseError } = await client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id, display_order, note")
    .in("workout_id", workoutIds)
    .order("display_order");

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const exerciseIds = [...new Set(workoutExercises.map((item) => item.exercise_id))];
  const exerciseNames = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: exercises, error: exerciseError } = await client
      .from("exercises")
      .select("id, name")
      .in("id", exerciseIds);

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
    const { data: sets, error: setError } = await client
      .from("sets")
      .select("id, workout_exercise_id, set_number, weight_kg, reps, rir, is_warmup")
      .in("workout_exercise_id", workoutExerciseIds)
      .order("set_number");

    if (setError) {
      throw setError;
    }

    for (const set of sets) {
      const current = setsByWorkoutExercise.get(set.workout_exercise_id) ?? [];
      current.push(mapSet(set));
      setsByWorkoutExercise.set(set.workout_exercise_id, current);
    }
  }

  const exercisesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const workoutExercise of workoutExercises) {
    const current = exercisesByWorkout.get(workoutExercise.workout_id) ?? [];
    current.push({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exercise_id,
      exerciseName: exerciseNames.get(workoutExercise.exercise_id) ?? "未設定の種目",
      displayOrder: workoutExercise.display_order,
      note: workoutExercise.note,
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

export async function getLatestWorkoutForExerciseBeforeDate(
  client: Client,
  exerciseId: string,
  beforeDate: string,
): Promise<WorkoutExercise | null> {
  const { data: workouts, error: workoutError } = await client
    .from("workouts")
    .select("id, workout_date")
    .lt("workout_date", beforeDate)
    .order("workout_date", { ascending: false })
    .limit(60);

  if (workoutError) {
    throw workoutError;
  }
  if (workouts.length === 0) {
    return null;
  }

  const workoutIds = workouts.map((workout) => workout.id);
  const workoutDateById = new Map(workouts.map((workout) => [workout.id, workout.workout_date]));
  const { data: workoutExercises, error: workoutExerciseError } = await client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id, display_order, note")
    .eq("exercise_id", exerciseId)
    .in("workout_id", workoutIds);

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }
  if (workoutExercises.length === 0) {
    return null;
  }

  const latest = [...workoutExercises].sort((a, b) =>
    String(workoutDateById.get(b.workout_id)).localeCompare(String(workoutDateById.get(a.workout_id))),
  )[0];
  const { data: exercise, error: exerciseError } = await client
    .from("exercises")
    .select("name")
    .eq("id", exerciseId)
    .single();

  if (exerciseError) {
    throw exerciseError;
  }

  const { data: sets, error: setError } = await client
    .from("sets")
    .select("id, workout_exercise_id, set_number, weight_kg, reps, rir, is_warmup")
    .eq("workout_exercise_id", latest.id)
    .order("set_number");

  if (setError) {
    throw setError;
  }

  return {
    id: latest.id,
    exerciseId,
    exerciseName: exercise.name,
    displayOrder: latest.display_order,
    note: latest.note,
    sets: sets.map(mapSet),
  };
}

export async function getExerciseRecords(client: Client): Promise<ExerciseRecord[]> {
  const exercises = await getExercises(client);
  if (exercises.length === 0) {
    return [];
  }

  const exerciseIds = exercises.map((exercise) => exercise.id);
  const { data: workoutExercises, error: workoutExerciseError } = await client
    .from("workout_exercises")
    .select("id, workout_id, exercise_id")
    .in("exercise_id", exerciseIds);

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
  const { data: workouts, error: workoutError } = await client
    .from("workouts")
    .select("id, workout_date")
    .in("id", workoutIds);

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
  const { data: sets, error: setError } = await client
    .from("sets")
    .select("workout_exercise_id, weight_kg, reps")
    .in(
      "workout_exercise_id",
      workoutExercises.map((item) => item.id),
    );

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
    if (set.weight_kg !== null && set.reps !== null) {
      const volume = set.weight_kg * set.reps;
      record.maxVolumeKg = Math.max(record.maxVolumeKg ?? 0, volume);
    }
    const workoutId = workoutIdByWorkoutExerciseId.get(set.workout_exercise_id);
    const workoutDate = workoutId ? dateByWorkoutId.get(workoutId) : null;
    if (workoutDate && (!record.lastWorkoutDate || workoutDate > record.lastWorkoutDate)) {
      record.lastWorkoutDate = workoutDate;
    }
  }

  return [...records.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "ja"));
}

async function insertSets(
  client: Client,
  input: Pick<CreateWorkoutInput, "sets" | "userId"> & { workoutExerciseId: string },
) {
  const validSets = input.sets.filter((set) => set.weightKg !== null || set.reps !== null);
  if (validSets.length === 0) {
    return;
  }

  const { error } = await client.from("sets").insert(
    validSets.map((set, index) => ({
      user_id: input.userId,
      workout_exercise_id: input.workoutExerciseId,
      set_number: index + 1,
      weight_kg: set.weightKg,
      reps: set.reps,
      rir: null,
      is_warmup: set.isWarmup,
    })),
  );

  if (error) {
    throw error;
  }
}

export async function createWorkout(client: Client, input: CreateWorkoutInput) {
  const { data: workout, error: workoutError } = await client
    .from("workouts")
    .insert({
      user_id: input.userId,
      workout_date: input.workoutDate,
      note: input.note,
    })
    .select("id")
    .single();

  if (workoutError) {
    throw workoutError;
  }

  try {
    const { data: workoutExercise, error: workoutExerciseError } = await client
      .from("workout_exercises")
      .insert({
        user_id: input.userId,
        workout_id: workout.id,
        exercise_id: input.exerciseId,
        display_order: 1,
        note: input.note,
      })
      .select("id")
      .single();

    if (workoutExerciseError) {
      throw workoutExerciseError;
    }

    await insertSets(client, {
      userId: input.userId,
      workoutExerciseId: workoutExercise.id,
      sets: input.sets,
    });
  } catch (error) {
    await client.from("workouts").delete().eq("id", workout.id);
    throw error;
  }
}

export async function updateWorkout(client: Client, input: UpdateWorkoutInput) {
  const { error: workoutError } = await client
    .from("workouts")
    .update({
      workout_date: input.workoutDate,
      note: input.note,
    })
    .eq("id", input.workoutId)
    .eq("user_id", input.userId);

  if (workoutError) {
    throw workoutError;
  }

  const { error: workoutExerciseError } = await client
    .from("workout_exercises")
    .update({
      exercise_id: input.exerciseId,
      note: input.note,
    })
    .eq("id", input.workoutExerciseId)
    .eq("user_id", input.userId);

  if (workoutExerciseError) {
    throw workoutExerciseError;
  }

  const { error: deleteSetError } = await client
    .from("sets")
    .delete()
    .eq("workout_exercise_id", input.workoutExerciseId)
    .eq("user_id", input.userId);

  if (deleteSetError) {
    throw deleteSetError;
  }

  await insertSets(client, {
    userId: input.userId,
    workoutExerciseId: input.workoutExerciseId,
    sets: input.sets,
  });
}

export async function deleteWorkout(client: Client, workoutId: string) {
  const { error } = await client.from("workouts").delete().eq("id", workoutId);

  if (error) {
    throw error;
  }
}
