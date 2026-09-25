import { estimateOneRepMax } from "@/lib/domain/one-rep-max";
import type { Profile } from "@/lib/supabase/database.types";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import { cardioInputToStorage, cardioStorageToDisplay, defaultCardioUnits } from "@/lib/workouts/cardio-units";
import type {
  BodyPart,
  CardioUnitSettings,
  CreateWorkoutSetInput,
  Exercise,
  WorkoutExercise,
} from "@/lib/workouts/types";
export const bodyWeightInputLabel = "自重";

export interface SetDraft {
  weightKg: string;
  reps: string;
  isWarmup: boolean;
  isAssisted: boolean;
  note: string;
  distanceKm: string;
  durationMin: string;
  speedKmh: string;
  caloriesKcal: string;
  leftReps: string;
  rightReps: string;
}

export interface EntryDraft {
  exerciseId: string;
  note: string;
  condition: string;
  elapsedSec: number | null;
  startedAt: number | null;
  lastSetInputAt: number | null;
  sets: SetDraft[];
}

export function isEntryDraft(value: unknown): value is EntryDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as EntryDraft;
  return [draft.exerciseId, draft.note, draft.condition].every(v => typeof v === "string") &&
    [draft.elapsedSec, draft.startedAt, draft.lastSetInputAt].every(v => v === null || (typeof v === "number" && Number.isFinite(v))) &&
    Array.isArray(draft.sets) && draft.sets.length <= 200 && draft.sets.every(set => set &&
      [set.weightKg, set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh, set.caloriesKcal, set.leftReps, set.rightReps].every(v => typeof v === "string") &&
      typeof set.isAssisted === "boolean" && typeof set.isWarmup === "boolean");
}

export function toNumberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function toWeightNumberOrNull(value: string, profile: Profile | null) {
  if (value.trim() === bodyWeightInputLabel) {
    return typeof profile?.body_weight_kg === "number" ? profile.body_weight_kg : null;
  }
  return toNumberOrNull(value);
}

export function createInitialSetDraft(): SetDraft {
  return {
    weightKg: "",
    reps: "",
    isWarmup: false,
    isAssisted: false,
    note: "",
    distanceKm: "",
    durationMin: "",
    speedKmh: "",
    caloriesKcal: "",
    leftReps: "",
    rightReps: "",
  };
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}


export function createSetDrafts(count: number) {
  return Array.from({ length: count }, () => createInitialSetDraft());
}

export function isBlankSetDraft(set: SetDraft) {
  return [set.weightKg, set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh,
    set.caloriesKcal, set.leftReps, set.rightReps].every((value) => value.trim() === "") &&
    !set.isWarmup && !set.isAssisted;
}

export function clampDefaultSetCount(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 5;
  }
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

export function formatWeightNumber(weightKg: number | null) {
  return weightKg === null ? "-" : weightKg.toFixed(1);
}

export function formatWeightInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === bodyWeightInputLabel) {
    return value;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : value;
}

export function formatSetLine(weightKg: number | null, reps: number | null) {
  return `${formatWeightNumber(weightKg)}kg x ${reps ?? "-"}`;
}

export function formatRmValue(weightKg: number | null, reps: number | null) {
  const rm = estimateOneRepMax(weightKg, reps);
  return rm === null ? "-" : rm.toFixed(1);
}

export function formatCardioStoredValue(
  metric: keyof CardioUnitSettings,
  value: number | null,
  units: CardioUnitSettings,
) {
  if (value === null) {
    return "-";
  }
  const converted = cardioStorageToDisplay(metric, value, units) ?? value;
  return String(Number(converted.toFixed(metric === "duration" ? 1 : 2)));
}

export function getDraftElapsedSec(draft: EntryDraft) {
  if (draft.startedAt !== null && draft.lastSetInputAt !== null) {
    return Math.max(0, Math.round((draft.lastSetInputAt - draft.startedAt) / 1000));
  }
  return draft.elapsedSec;
}

export function formatRm(weightKg: number | null, reps: number | null) {
  const value = formatRmValue(weightKg, reps);
  return value === "-" ? value : `${value}kg`;
}

export function toSetInputs(
  sets: SetDraft[],
  profile: Profile | null,
  cardioUnits: CardioUnitSettings = defaultCardioUnits,
  bilateralRepsEnabled = false,
): CreateWorkoutSetInput[] {
  return sets.map((set) => {
    const distance = toNumberOrNull(set.distanceKm);
    const duration = toNumberOrNull(set.durationMin);
    const speed = toNumberOrNull(set.speedKmh);
    const calories = toNumberOrNull(set.caloriesKcal);
    return ({
    weightKg: toWeightNumberOrNull(set.weightKg, profile),
    reps: bilateralRepsEnabled ? null : toNumberOrNull(set.reps),
    isWarmup: set.isWarmup,
    isAssisted: set.isAssisted,
    note: set.note.trim() || null,
    distanceKm: cardioInputToStorage("distance", distance, cardioUnits),
    durationSec: cardioInputToStorage("duration", duration, cardioUnits),
    speedKmh: cardioInputToStorage("speed", speed, cardioUnits),
    caloriesKcal: cardioInputToStorage("calories", calories, cardioUnits),
    leftReps: bilateralRepsEnabled ? toNumberOrNull(set.leftReps) : null,
    rightReps: bilateralRepsEnabled ? toNumberOrNull(set.rightReps) : null,
    });
  });
}

export function formatCardioDraftValue(value: number | null, digits = 2) {
  return value === null ? "" : String(Number(value.toFixed(digits)));
}

export function createSetDraftFromWorkoutSet(
  set: WorkoutExercise["sets"][number],
  cardioUnits: CardioUnitSettings = defaultCardioUnits,
): SetDraft {
  const distance = cardioStorageToDisplay("distance", set.distanceKm, cardioUnits);
  const duration = cardioStorageToDisplay("duration", set.durationSec, cardioUnits);
  const speed = cardioStorageToDisplay("speed", set.speedKmh, cardioUnits);
  const calories = cardioStorageToDisplay("calories", set.caloriesKcal, cardioUnits);
  return {
    weightKg: set.weightKg !== null ? set.weightKg.toFixed(1) : "",
    reps: set.reps !== null ? String(set.reps) : "",
    isWarmup: set.isWarmup,
    isAssisted: set.isAssisted,
    note: set.note ?? "",
    distanceKm: formatCardioDraftValue(distance),
    durationMin: formatCardioDraftValue(duration, 1),
    speedKmh: formatCardioDraftValue(speed),
    caloriesKcal: formatCardioDraftValue(calories, 1),
    leftReps: set.leftReps !== null ? String(set.leftReps) : set.reps !== null ? String(set.reps) : "",
    rightReps: set.rightReps !== null ? String(set.rightReps) : set.reps !== null ? String(set.reps) : "",
  };
}

export function createDraftFromWorkout(
  exercise: WorkoutExercise,
  cardioUnits: CardioUnitSettings = defaultCardioUnits,
): EntryDraft {
  return {
    exerciseId: exercise.exerciseId,
    note: exercise.note ?? "",
    condition: exercise.condition ?? "",
    elapsedSec: exercise.elapsedSec,
    startedAt: null,
    lastSetInputAt: null,
    sets: exercise.sets.map((set) => createSetDraftFromWorkoutSet(set, cardioUnits)),
  };
}

export function findExercise(exercises: Exercise[], exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

export function sortExercisesByMasterOrder(exercises: Exercise[], bodyParts: BodyPart[]) {
  const bodyPartOrder = new Map(bodyParts.map((bodyPart) => [bodyPart.id, bodyPart.displayOrder]));
  return [...exercises].sort((a, b) => {
    const bodyPartDelta =
      (bodyPartOrder.get(a.bodyPartId) ?? Number.MAX_SAFE_INTEGER) -
      (bodyPartOrder.get(b.bodyPartId) ?? Number.MAX_SAFE_INTEGER);
    if (bodyPartDelta !== 0) {
      return bodyPartDelta;
    }
    const exerciseDelta = a.displayOrder - b.displayOrder;
    if (exerciseDelta !== 0) {
      return exerciseDelta;
    }
    return a.name.localeCompare(b.name, "ja");
  });
}

export function estimateDraftCalories(
  draft: EntryDraft,
  exercises: Exercise[],
  profile: Profile | null,
) {
  return estimateWorkoutExerciseCalories({
    profile,
    exercise: findExercise(exercises, draft.exerciseId),
    sets: toSetInputs(
      draft.sets,
      profile,
      findExercise(exercises, draft.exerciseId)?.cardioUnits,
      findExercise(exercises, draft.exerciseId)?.bilateralRepsEnabled,
    ),
  });
}

export function getCurrentTimestamp() {
  return Date.now();
}

export function hasAnySetInput(draft: EntryDraft, profile: Profile | null) {
  return draft.sets.some((set) =>
    toWeightNumberOrNull(set.weightKg, profile) !== null ||
    [set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh, set.caloriesKcal,
      set.leftReps, set.rightReps].some((value) => value.trim() !== ""),
  );
}
