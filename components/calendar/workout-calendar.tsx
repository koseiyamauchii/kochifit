"use client";

import { Check, ChevronLeft, ChevronRight, Copy, History, PersonStanding, Plus, Settings2, Trash2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SetAnnotations, WorkoutCardHeader } from "./workout-card-parts";
import { readWorkoutDraft, workoutDraftKey, writeWorkoutDraft } from "@/lib/workouts/draft-storage";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import {
  cardioInputToStorage,
  cardioStorageToDisplay,
  defaultCardioUnits,
  getCardioUnitLabels,
} from "@/lib/workouts/cardio-units";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import {
  addMonths,
  getCalendarCells,
  getCalendarRange,
  startOfMonth,
  toDateKey,
} from "@/lib/workouts/date";
import {
  createWorkout,
  deleteWorkout,
  getBodyParts,
  getExerciseRecords,
  getExercises,
  getLatestWorkoutForExerciseBeforeDate,
  getWorkoutsForExercise,
  getWorkoutSummaries,
  getWorkoutsByDate,
  updateWorkoutExerciseConditions,
  updateWorkout,
} from "@/lib/workouts/repository";
import type {
  BodyPart,
  CardioUnitSettings,
  CreateWorkoutSetInput,
  Exercise,
  Workout,
  WorkoutExercise,
  ExerciseRecord,
  WorkoutSummary,
} from "@/lib/workouts/types";

const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
const bodyWeightInputLabel = "自重";

interface SetDraft {
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

interface EntryDraft {
  exerciseId: string;
  note: string;
  condition: string;
  elapsedSec: number | null;
  startedAt: number | null;
  lastSetInputAt: number | null;
  sets: SetDraft[];
}

function isEntryDraft(value: unknown): value is EntryDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as EntryDraft;
  return [draft.exerciseId, draft.note, draft.condition].every(v => typeof v === "string") &&
    [draft.elapsedSec, draft.startedAt, draft.lastSetInputAt].every(v => v === null || (typeof v === "number" && Number.isFinite(v))) &&
    Array.isArray(draft.sets) && draft.sets.length <= 200 && draft.sets.every(set => set &&
      [set.weightKg, set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh, set.caloriesKcal, set.leftReps, set.rightReps].every(v => typeof v === "string") &&
      typeof set.isAssisted === "boolean" && typeof set.isWarmup === "boolean");
}

interface WorkoutCalendarProps {
  backHref?: string;
  detailsHeading?: string;
  showCalendar?: boolean;
  showWorkoutDetails?: boolean;
  selectedDateOverride?: string;
  showAddForm?: boolean;
  exerciseFilterId?: string;
  exerciseHistoryId?: string;
}

function toNumberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toWeightNumberOrNull(value: string, profile: ReturnType<typeof useAuth>["profile"]) {
  if (value.trim() === bodyWeightInputLabel) {
    return typeof profile?.body_weight_kg === "number" ? profile.body_weight_kg : null;
  }
  return toNumberOrNull(value);
}

function createInitialSetDraft(): SetDraft {
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

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}


function createSetDrafts(count: number) {
  return Array.from({ length: count }, () => createInitialSetDraft());
}

function isBlankSetDraft(set: SetDraft) {
  return [set.weightKg, set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh,
    set.caloriesKcal, set.leftReps, set.rightReps].every((value) => value.trim() === "") &&
    !set.isWarmup && !set.isAssisted;
}

function clampDefaultSetCount(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 5;
  }
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

function formatWeightNumber(weightKg: number | null) {
  return weightKg === null ? "-" : weightKg.toFixed(1);
}

function formatWeightInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === bodyWeightInputLabel) {
    return value;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : value;
}

function formatSetLine(weightKg: number | null, reps: number | null) {
  return `${formatWeightNumber(weightKg)}kg x ${reps ?? "-"}`;
}

function estimateOneRepMax(weightKg: number | null, reps: number | null) {
  if (weightKg === null || reps === null || weightKg <= 0 || reps <= 0) {
    return null;
  }
  if (reps === 1) {
    return weightKg;
  }
  return weightKg * (1 + reps / 30);
}

function formatRmValue(weightKg: number | null, reps: number | null) {
  const rm = estimateOneRepMax(weightKg, reps);
  return rm === null ? "-" : rm.toFixed(1);
}

function hasSetMeasurementInput(set: SetDraft) {
  return [
    set.weightKg,
    set.reps,
    set.distanceKm,
    set.durationMin,
    set.speedKmh,
    set.caloriesKcal,
    set.leftReps,
    set.rightReps,
  ].some((value) => value.trim() !== "");
}

function formatCardioStoredValue(
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

function getDraftElapsedSec(draft: EntryDraft) {
  if (draft.startedAt !== null && draft.lastSetInputAt !== null) {
    return Math.max(0, Math.round((draft.lastSetInputAt - draft.startedAt) / 1000));
  }
  return draft.elapsedSec;
}

function formatRm(weightKg: number | null, reps: number | null) {
  const value = formatRmValue(weightKg, reps);
  return value === "-" ? value : `${value}kg`;
}

function toSetInputs(
  sets: SetDraft[],
  profile: ReturnType<typeof useAuth>["profile"],
  cardioUnits: CardioUnitSettings = defaultCardioUnits,
): CreateWorkoutSetInput[] {
  return sets.map((set) => {
    const distance = toNumberOrNull(set.distanceKm);
    const duration = toNumberOrNull(set.durationMin);
    const speed = toNumberOrNull(set.speedKmh);
    const calories = toNumberOrNull(set.caloriesKcal);
    return ({
    weightKg: toWeightNumberOrNull(set.weightKg, profile),
    reps: toNumberOrNull(set.reps),
    isWarmup: set.isWarmup,
    isAssisted: set.isAssisted,
    note: set.note.trim() || null,
    distanceKm: cardioInputToStorage("distance", distance, cardioUnits),
    durationSec: cardioInputToStorage("duration", duration, cardioUnits),
    speedKmh: cardioInputToStorage("speed", speed, cardioUnits),
    caloriesKcal: cardioInputToStorage("calories", calories, cardioUnits),
    leftReps: toNumberOrNull(set.leftReps),
    rightReps: toNumberOrNull(set.rightReps),
    });
  });
}

function formatCardioDraftValue(value: number | null, digits = 2) {
  return value === null ? "" : String(Number(value.toFixed(digits)));
}

function createSetDraftFromWorkoutSet(
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

function createDraftFromWorkout(
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

function findExercise(exercises: Exercise[], exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

function sortExercisesByMasterOrder(exercises: Exercise[], bodyParts: BodyPart[]) {
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

function estimateDraftCalories(
  draft: EntryDraft,
  exercises: Exercise[],
  profile: ReturnType<typeof useAuth>["profile"],
) {
  return estimateWorkoutExerciseCalories({
    profile,
    exercise: findExercise(exercises, draft.exerciseId),
    sets: toSetInputs(
      draft.sets,
      profile,
      findExercise(exercises, draft.exerciseId)?.cardioUnits,
    ),
  });
}

function getCurrentTimestamp() {
  return Date.now();
}

function hasAnySetInput(draft: EntryDraft, profile: ReturnType<typeof useAuth>["profile"]) {
  return draft.sets.some((set) =>
    toWeightNumberOrNull(set.weightKg, profile) !== null ||
    [set.reps, set.note, set.distanceKm, set.durationMin, set.speedKmh, set.caloriesKcal,
      set.leftReps, set.rightReps].some((value) => value.trim() !== ""),
  );
}

function PreviousWorkoutBlock({
  bilateralRepsEnabled,
  cardioUnits,
  historyReturnHref,
  isCopyConfirmed,
  isCardio,
  previousWorkout,
  onCopyAll,
}: {
  bilateralRepsEnabled: boolean;
  cardioUnits: CardioUnitSettings;
  historyReturnHref: string;
  isCopyConfirmed: boolean;
  isCardio: boolean;
  previousWorkout: WorkoutExercise | null;
  onCopyAll: () => void;
}) {
  const cardioUnitLabels = getCardioUnitLabels(cardioUnits);
  return (
    <div className="rounded-[12px] bg-[var(--surface-soft)] p-2 ring-1 ring-[var(--border)]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-[var(--muted)]">前回の記録</h4>
        <div className="flex shrink-0 items-center gap-2">
          {previousWorkout ? (
            <Link
              href={`/history/exercise?exercise=${previousWorkout.exerciseId}&returnTo=${encodeURIComponent(historyReturnHref)}`}
              className="rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
            >
              詳細
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onCopyAll}
            disabled={!previousWorkout}
            aria-label="前回の記録をコピー"
            className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-40"
          >
            {isCopyConfirmed ? <Check size={17} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>
      {previousWorkout ? (
        <div className="space-y-2">
          <div className="space-y-1.5 text-xs text-[var(--muted)]">
            {previousWorkout.sets.map((set, index) => (
              <div key={set.id} className="grid grid-cols-[3.5rem_1fr] items-start gap-2 rounded-[12px] bg-[var(--surface)] px-2.5 py-1">
                <span className="font-semibold">{set.isWarmup ? "W" : "セット " + (index + 1)}</span>
                <div className="min-w-0 space-y-1">
                  <span className="block">
                    {isCardio
                      ? `${formatCardioStoredValue("distance", set.distanceKm, cardioUnits)}${cardioUnitLabels.distance} / ${formatCardioStoredValue("duration", set.durationSec, cardioUnits)}${cardioUnitLabels.duration} / ${formatCardioStoredValue("speed", set.speedKmh, cardioUnits)}${cardioUnitLabels.speed}`
                      : bilateralRepsEnabled
                        ? `${formatWeightNumber(set.weightKg)}kg / 左${set.leftReps ?? set.reps ?? "-"}回 / 右${set.rightReps ?? set.reps ?? "-"}回`
                        : formatSetLine(set.weightKg, set.reps)}
                  </span>
                  {!isCardio && set.isAssisted ? <span className="block">補助あり</span> : null}
                  {set.note ? <span className="block whitespace-pre-wrap break-words">メモ：{set.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
          {previousWorkout.note ? (
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--muted)]">前回メモ：{previousWorkout.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">この種目の前回記録はまだありません。</p>
      )}
    </div>
  );
}

function WorkoutReadOnlyCard({
  exerciseRecords,
  exercises,
  onEdit,
  sessionNumber,
  showDate = false,
  workout,
}: {
  exerciseRecords: ExerciseRecord[];
  exercises: Exercise[];
  onEdit: () => void;
  sessionNumber: number;
  showDate?: boolean;
  workout: Workout;
}) {
  const exercise = workout.exercises[0];
  if (!exercise) {
    return null;
  }
  const masterExercise = findExercise(exercises, exercise.exerciseId);
  const isCardio = masterExercise?.bodyPartKey === "cardio";
  const cardioUnits = masterExercise?.cardioUnits ?? defaultCardioUnits;
  const cardioUnitLabels = getCardioUnitLabels(cardioUnits);
  const maxWeightKg = exerciseRecords.find((record) => record.exerciseId === exercise.exerciseId)?.maxWeightKg ?? null;

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-expanded="false"
      className="ui-card block w-full overflow-hidden text-left"
    >
      <WorkoutCardHeader title={exercise.exerciseName} sessionNumber={sessionNumber}>
          {showDate ? (
            <span>{workout.workoutDate.replaceAll("-", "/")}</span>
          ) : null}
          <span>
            {exercise.sets.length}セット
          </span>
      </WorkoutCardHeader>
      <div className={isCardio ? "grid grid-cols-[2.4rem_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]" : "grid grid-cols-[2.4rem_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]"}>
        <span>セット</span>
        <span>{isCardio ? "距離" : "重量"}</span>
        <span>{isCardio ? "時間" : "回数"}</span>
        <span>{isCardio ? "速さ" : "RM"}</span>
      </div>
      <div className="divide-y divide-[var(--hairline)] px-3">
        {exercise.sets.map((set, index) => (
          <div key={set.id} className="py-1.5">
            <div className="grid min-h-7 grid-cols-[2.4rem_1fr_1fr_1fr] items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--muted)]">{set.isWarmup ? "W" : index + 1}</span>
              <span className="font-medium">{isCardio ? `${formatCardioStoredValue("distance", set.distanceKm, cardioUnits)}${cardioUnitLabels.distance}` : `${formatWeightNumber(set.weightKg)}kg`}</span>
              <span className="font-medium">{isCardio ? `${formatCardioStoredValue("duration", set.durationSec, cardioUnits)}${cardioUnitLabels.duration}` : masterExercise?.bilateralRepsEnabled ? `左${set.leftReps ?? set.reps ?? "-"}/右${set.rightReps ?? set.reps ?? "-"}` : `${set.reps ?? "-"}回`}</span>
              <span className="font-semibold text-[var(--muted)]">{isCardio ? `${formatCardioStoredValue("speed", set.speedKmh, cardioUnits)}${cardioUnitLabels.speed}` : formatRm(set.weightKg, set.reps ?? (Math.max(set.leftReps ?? 0, set.rightReps ?? 0) || null))}</span>
            </div>
            {isCardio && set.caloriesKcal !== null ? <p className="mt-1 text-xs text-[var(--muted)]">カロリー：{formatCardioStoredValue("calories", set.caloriesKcal, cardioUnits)}{cardioUnitLabels.calories}</p> : null}
            <SetAnnotations note={set.note} isAssisted={set.isAssisted} isCardio={isCardio} />
          </div>
        ))}
      </div>
      {exercise.note ? (
        <div className="whitespace-pre-wrap break-words border-t border-[var(--hairline)] px-3 py-2 text-xs text-[var(--muted)]">
          メモ：{exercise.note}
        </div>
      ) : null}
      {masterExercise?.memo ? (
        <div className="whitespace-pre-wrap break-words border-t border-[var(--hairline)] px-3 py-2 text-xs text-[var(--muted)]">
          共通メモ（種目マスタ）：{masterExercise.memo}
        </div>
      ) : null}
      {!isCardio && maxWeightKg !== null ? <div className="border-t border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">最高重量：{Number(maxWeightKg.toFixed(1))}kg</div> : null}
    </button>
  );
}

function WorkoutEntryForm({
  bodyParts,
  defaultSetCount,
  draft,
  exercises,
  exerciseRecords,
  historyReturnHref,
  isSaving,
  masterReturnHref,
  mode,
  onDelete,
  onDraftChange,
  onHeaderClick,
  onSave,
  previousWorkout,
  profile,
  sessionNumber,
  recordDate,
  draftNotice,
  selectedBodyPartId,
  setSelectedBodyPartId,
}: {
  bodyParts: BodyPart[];
  defaultSetCount: number;
  draft: EntryDraft;
  exercises: Exercise[];
  exerciseRecords: ExerciseRecord[];
  historyReturnHref: string;
  isSaving: boolean;
  masterReturnHref?: string;
  mode: "add" | "edit";
  onDelete?: () => void;
  onDraftChange: (draft: EntryDraft) => void;
  onHeaderClick?: () => void;
  onSave: () => void;
  previousWorkout?: WorkoutExercise | null;
  profile: ReturnType<typeof useAuth>["profile"];
  sessionNumber?: number;
  recordDate?: string;
  draftNotice?: React.ReactNode;
  selectedBodyPartId?: string;
  setSelectedBodyPartId?: (bodyPartId: string) => void;
}) {
  const [confirmedAction, setConfirmedAction] = useState<string | null>(null);
  const selectedExercise = findExercise(exercises, draft.exerciseId);
  const isCardio = selectedExercise?.bodyPartKey === "cardio";
  const cardioUnits = selectedExercise?.cardioUnits ?? defaultCardioUnits;
  const cardioUnitLabels = getCardioUnitLabels(cardioUnits);
  const formDefaultSetCount = clampDefaultSetCount(
    selectedExercise?.defaultSetCount ?? (isCardio ? 1 : defaultSetCount),
  );
  const headerTitle = selectedExercise?.name ?? "種目を追加してください";
  const sortedExercises = useMemo(
    () => sortExercisesByMasterOrder(exercises, bodyParts),
    [bodyParts, exercises],
  );
  const filteredExercises =
    mode === "add" && selectedBodyPartId && selectedBodyPartId !== "all"
      ? sortedExercises.filter((exercise) => exercise.bodyPartId === selectedBodyPartId)
      : sortedExercises;
  const estimatedCalories = estimateDraftCalories(draft, exercises, profile);
  const exerciseRecord = exerciseRecords.find((record) => record.exerciseId === draft.exerciseId);
  const maxWeightKg = exerciseRecord?.maxWeightKg ?? null;
  const canSave = Boolean(draft.exerciseId && hasAnySetInput(draft, profile));
  const draftWeights = draft.sets.map((set) => toWeightNumberOrNull(set.weightKg, profile));
  const liveMaxWeight = draftWeights.reduce<number | null>(
    (maximum, value) => value === null ? maximum : Math.max(maximum ?? value, value),
    null,
  );
  const firstHighestWeightSetIndex = liveMaxWeight !== null &&
    (maxWeightKg === null || liveMaxWeight > maxWeightKg)
    ? draftWeights.findIndex((weight) => weight === liveMaxWeight)
    : -1;

  const showConfirmation = (key: string) => {
    setConfirmedAction(key);
    window.setTimeout(() => setConfirmedAction((current) => current === key ? null : current), 1500);
  };

  const updateSet = (index: number, nextSet: Partial<SetDraft>) => {
    onDraftChange({
      ...draft,
      lastSetInputAt: mode === "add" ? getCurrentTimestamp() : draft.lastSetInputAt,
      sets: draft.sets.map((set, setIndex) =>
        setIndex === index ? { ...set, ...nextSet } : set,
      ),
    });
  };

  const addSet = () => {
    onDraftChange({
      ...draft,
      lastSetInputAt: mode === "add" ? getCurrentTimestamp() : draft.lastSetInputAt,
      sets: [...draft.sets, createInitialSetDraft()],
    });
  };

  const removeSet = (index: number) => {
    onDraftChange({
      ...draft,
      lastSetInputAt: mode === "add" ? getCurrentTimestamp() : draft.lastSetInputAt,
      sets: draft.sets.filter((_, setIndex) => setIndex !== index),
    });
  };

  const copyPreviousSet = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, source);
      showConfirmation(`set-${index}`);
    }
  };

  const copyPreviousSetWeight = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, { weightKg: source.weightKg });
      showConfirmation(`weight-${index}`);
    }
  };

  const copyPreviousSetReps = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, { reps: source.reps });
      showConfirmation(`reps-${index}`);
    }
  };

  const copyPreviousSetSideReps = (index: number, key: "leftReps" | "rightReps") => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, { [key]: source[key] });
      showConfirmation(`${key}-${index}`);
    }
  };

  const applyBodyWeight = (index: number) => {
    if (typeof profile?.body_weight_kg !== "number") {
      return;
    }
    updateSet(index, { weightKg: bodyWeightInputLabel });
    showConfirmation(`body-${index}`);
  };

  const copyPreviousHistorySet = (index: number) => {
    const source = previousWorkout?.sets[index] ?? previousWorkout?.sets[0];
    if (!source) {
      return;
    }
    updateSet(index, createSetDraftFromWorkoutSet(source, cardioUnits));
    showConfirmation(`history-${index}`);
  };

  const copyPreviousHistory = () => {
    if (!previousWorkout) {
      return;
    }
    const copied = previousWorkout.sets.map((set) =>
      createSetDraftFromWorkoutSet(set, cardioUnits),
    );
    while (copied.length < formDefaultSetCount) {
      copied.push(createInitialSetDraft());
    }
    onDraftChange({ ...draft, sets: copied, note: previousWorkout.note ?? "" });
    showConfirmation("history-all");
  };

  return (
    <section className="ui-card overflow-hidden">
      {mode === "add" && !selectedExercise ? null : (
        <WorkoutCardHeader title={headerTitle} sessionNumber={mode === "edit" ? sessionNumber : undefined} onClose={onHeaderClick}>
          {recordDate ? <span>{recordDate.replaceAll("-", "/")}</span> : null}
          <span>{mode === "edit" ? `${draft.sets.length}セット` : `約${estimatedCalories}kcal`}</span>
        </WorkoutCardHeader>
      )}
      <div className="space-y-2.5 p-2.5">
      {draftNotice}

      {mode === "add" && selectedBodyPartId && setSelectedBodyPartId ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={() => setSelectedBodyPartId("all")}
              aria-pressed={selectedBodyPartId === "all"}
              className={[
                "min-h-9 rounded-[12px] px-3 text-xs font-medium",
                selectedBodyPartId === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-soft)] text-[var(--text)]",
              ].join(" ")}
            >
              すべて
            </button>
            {bodyParts.map((bodyPart) => (
              <button
                key={bodyPart.id}
                type="button"
                onClick={() => setSelectedBodyPartId(bodyPart.id)}
                aria-pressed={selectedBodyPartId === bodyPart.id}
                className={[
                  "min-h-9 rounded-[12px] px-3 text-xs font-medium",
                  selectedBodyPartId === bodyPart.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-soft)] text-[var(--text)]",
                ].join(" ")}
              >
                {bodyPart.displayName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "add" ? (
        <div className="grid grid-cols-[1fr_2.75rem] items-end gap-2">
        <label className="block min-w-0 space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">種目</span>
          <select
            value={draft.exerciseId}
            onChange={(event) => {
              const nextExercise = findExercise(exercises, event.target.value);
              const nextCount = clampDefaultSetCount(
                nextExercise?.defaultSetCount ?? (nextExercise?.bodyPartKey === "cardio" ? 1 : defaultSetCount),
              );
              onDraftChange({
                ...draft,
                exerciseId: event.target.value,
                condition: "",
                elapsedSec: null,
                startedAt: event.target.value ? getCurrentTimestamp() : null,
                lastSetInputAt: event.target.value ? getCurrentTimestamp() : null,
                sets: createSetDrafts(nextCount),
              });
            }}
            className="form-field-muted min-h-11 w-full appearance-none rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--text)]"
          >
            <option value="">種目を追加してください</option>
            {filteredExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
        <Link
          href={`/settings?section=exercises&returnTo=${encodeURIComponent(masterReturnHref ?? "/today")}`}
          aria-label="種目マスタを開く"
          title="種目マスタ"
          className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-[var(--muted)]"
        >
          <Settings2 size={19} />
        </Link>
        </div>
      ) : null}

      {mode === "add" && filteredExercises.length === 0 ? (
        <p className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">
          種目マスタで種目を追加してください。
        </p>
      ) : null}

      {selectedExercise?.rackPosition || selectedExercise?.memo ? (
        <div className="space-y-1 rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm">
          {selectedExercise.rackPosition ? (
            <p>
              <span className="text-[var(--muted)]">器具位置：</span>
              <span className="font-medium">{selectedExercise.rackPosition}</span>
            </p>
          ) : null}
          {selectedExercise.memo ? (
            <p>
              <span className="text-[var(--muted)]">メモ：</span>
              <span className="font-medium">{selectedExercise.memo}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {previousWorkout !== undefined ? (
        <PreviousWorkoutBlock
          bilateralRepsEnabled={selectedExercise?.bilateralRepsEnabled ?? false}
          cardioUnits={cardioUnits}
          historyReturnHref={historyReturnHref}
          isCopyConfirmed={confirmedAction === "history-all"}
          isCardio={isCardio}
          previousWorkout={previousWorkout ?? null}
          onCopyAll={copyPreviousHistory}
        />
      ) : null}

      <div className="space-y-2">
        {draft.sets.map((set, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[12px] bg-[var(--surface-soft)] p-2 ring-1 ring-[var(--border)]"
          >
            <div className="workout-card-header -mx-2 -mt-2 mb-2 flex items-center justify-between gap-2 border-b border-[var(--hairline)] px-2.5 py-1.5">
              <span className="text-xs font-semibold">
                セット {index + 1}
              </span>
              {index === firstHighestWeightSetIndex ? (
                <span className="flex min-h-6 items-center gap-1 rounded-[12px] bg-amber-100 px-2 text-[11px] font-semibold text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.25)]">
                  <Trophy size={14} />
                  最高重量
                </span>
              ) : null}
            </div>
            {isCardio ? (
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["distanceKm", "距離", cardioUnitLabels.distance, "decimal"],
                  ["durationMin", "時間", cardioUnitLabels.duration, "decimal"],
                  ["speedKmh", "速さ", cardioUnitLabels.speed, "decimal"],
                  ["caloriesKcal", "カロリー", cardioUnitLabels.calories, "decimal"],
                ] as const).map(([key, label, unit, inputMode]) => (
                  <label key={key} className="min-w-0 space-y-1">
                    <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
                    <span className="relative block">
                      <input
                        inputMode={inputMode}
                        value={set[key]}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => updateSet(index, { [key]: event.target.value })}
                        className="min-h-10 w-full rounded-[12px] bg-[var(--surface)] px-3 pr-12 text-sm"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-[var(--muted)]">{unit}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
            <div className={[
              "grid gap-2",
              selectedExercise?.bilateralRepsEnabled
                ? "grid-cols-[1.15fr_0.9fr_0.9fr_1fr_2.5rem]"
                : "grid-cols-[1.2fr_1fr_1fr_2.5rem]",
            ].join(" ")}>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">重量</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {selectedExercise?.bodyWeightEnabled ? <button
                      type="button"
                      onClick={() => applyBodyWeight(index)}
                      disabled={typeof profile?.body_weight_kg !== "number"}
                      aria-label="自重を入力"
                      title="自重を入力"
                      className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                    >
                      {confirmedAction === `body-${index}` ? <Check size={18} className="text-emerald-500" /> : <PersonStanding size={19} />}
                    </button> : null}
                    <button
                      type="button"
                      onClick={() => copyPreviousSetWeight(index)}
                      disabled={index === 0}
                      aria-label="前セットの重量をコピー"
                      title="前セットの重量をコピー"
                      className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                    >
                      {confirmedAction === `weight-${index}` ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    inputMode="decimal"
                    value={set.weightKg}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => updateSet(index, { weightKg: event.target.value })}
                    onBlur={(event) => updateSet(index, { weightKg: formatWeightInput(event.target.value) })}
                    className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-3 pr-9 text-sm"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-medium text-[var(--muted)]">
                    kg
                  </span>
                </div>
              </div>
              {selectedExercise?.bilateralRepsEnabled ? (
                <>
                  {(["leftReps", "rightReps"] as const).map((key) => (
                    <div key={key} className="min-w-0 space-y-1">
                      <div className="flex h-8 items-center justify-between gap-0.5 text-xs font-medium text-[var(--muted)]">
                        <span>{key === "leftReps" ? "左" : "右"}</span>
                        <button
                          type="button"
                          onClick={() => copyPreviousSetSideReps(index, key)}
                          disabled={index === 0}
                          aria-label={`前セットの${key === "leftReps" ? "左" : "右"}回数をコピー`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface)] disabled:opacity-35"
                        >
                          {confirmedAction === `${key}-${index}` ? <Check size={15} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          inputMode="numeric"
                          value={set[key]}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) => updateSet(index, { [key]: event.target.value })}
                          className="min-h-10 w-full rounded-[12px] bg-[var(--surface)] px-3 pr-8 text-sm"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-[var(--muted)]">回</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">回数</span>
                  <button
                    type="button"
                    onClick={() => copyPreviousSetReps(index)}
                    disabled={index === 0}
                    aria-label="前セットの回数をコピー"
                    title="前セットの回数をコピー"
                    className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                  >
                    {confirmedAction === `reps-${index}` ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    inputMode="numeric"
                    value={set.reps}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => updateSet(index, { reps: event.target.value })}
                    className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-3 pr-8 text-sm"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-medium text-[var(--muted)]">
                    回
                  </span>
                </div>
              </div>}
              <div className="min-w-0 space-y-1">
                <div className="flex h-8 items-center text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">推定1RM</span>
                </div>
                <div className="flex min-h-10 w-full min-w-0 items-center gap-1 rounded-[12px] bg-[var(--surface)] px-3 text-sm font-semibold">
                  <span className="min-w-0 flex-1 truncate">
                    {formatRmValue(
                      toWeightNumberOrNull(set.weightKg, profile),
                      selectedExercise?.bilateralRepsEnabled
                        ? Math.max(toNumberOrNull(set.leftReps) ?? 0, toNumberOrNull(set.rightReps) ?? 0) || null
                        : toNumberOrNull(set.reps),
                    )}
                  </span>
                  <span className="text-xs font-medium text-[var(--muted)]">kg</span>
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex h-8 items-center justify-center text-[10px] font-medium text-[var(--muted)]">補助</div>
                <label className="flex h-10 items-center justify-center rounded-[12px] bg-[var(--surface)]">
                  <input
                    type="checkbox"
                    checked={set.isAssisted}
                    onChange={(event) => updateSet(index, { isAssisted: event.target.checked })}
                    aria-label={`セット${index + 1}の補助あり`}
                    className="h-5 w-5"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </label>
              </div>
            </div>
            )}
            <label className="mt-2 block space-y-1">
              <span className="text-xs font-medium text-[var(--muted)]">メモ</span>
              <textarea
                value={set.note}
                onChange={(event) => updateSet(index, { note: event.target.value })}
                onFocus={(event) => {
                  const target = event.currentTarget;
                  window.setTimeout(() => target.scrollIntoView({ block: "center", inline: "nearest" }), 180);
                }}
                rows={2}
                className="w-full scroll-mt-24 scroll-mb-40 rounded-[12px] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => copyPreviousSet(index)}
                disabled={index === 0}
                aria-label="前セットからコピー"
                title="前セットからコピー"
                className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-40"
              >
                {confirmedAction === `set-${index}` ? <Check size={17} className="text-emerald-500" /> : <Copy size={17} />}
                <span className="text-xs">前セット</span>
              </button>
              {mode === "add" ? (
                <button
                  type="button"
                  onClick={() => copyPreviousHistorySet(index)}
                  disabled={!previousWorkout}
                  aria-label="前回履歴からコピー"
                  title="前回履歴からコピー"
                  className="flex h-9 flex-1 items-center justify-center gap-1 rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-40"
                >
                  {confirmedAction === `history-${index}` ? <Check size={17} className="text-emerald-500" /> : <History size={17} />}
                  <span className="text-xs">前回</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => removeSet(index)}
                disabled={draft.sets.length === 1}
                aria-label="セットを削除"
                className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-40"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSet}
          className="flex min-h-9 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--surface-soft)] text-sm font-medium"
        >
          <Plus size={17} />
          セット追加
        </button>
      </div>

      {mode === "edit" && !recordDate ? (
        <p className="text-right text-xs text-[var(--muted)]">約{estimatedCalories}kcal</p>
      ) : null}

      {onDelete ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="flex min-h-10 w-full items-center justify-center gap-1 rounded-[12px] bg-[var(--surface-soft)] px-3 py-2.5 text-sm font-semibold text-[var(--muted)] disabled:opacity-40"
          >
            <Trash2 size={17} />
            削除
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || isSaving}
            className="flex min-h-10 w-full items-center justify-center gap-1 rounded-[12px] bg-[var(--accent)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Check size={17} />
            {isSaving ? "確定中" : "記録を確定"}
          </button>
        </div>
      ) : null}
      </div>
    </section>
  );
}

export function WorkoutCalendar({
  backHref,
  detailsHeading,
  exerciseFilterId,
  exerciseHistoryId,
  showCalendar = true,
  showWorkoutDetails = true,
  selectedDateOverride,
  showAddForm = false,
}: WorkoutCalendarProps) {
  const { user, authStatus, profile, profileStatus } = useAuth();
  const todayKey = toDateKey(new Date());
  const defaultSetCount = clampDefaultSetCount(profile?.default_set_count);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => selectedDateOverride ?? todayKey);
  const effectiveSelectedDate = selectedDateOverride ?? selectedDate;
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [previousWorkout, setPreviousWorkout] = useState<WorkoutExercise | null>(null);
  const [editPreviousWorkouts, setEditPreviousWorkouts] = useState<Record<string, WorkoutExercise | null>>({});
  const [selectedBodyPartId, setSelectedBodyPartId] = useState<string>("all");
  const [addDraft, setAddDraft] = useState<EntryDraft>(() => ({
    exerciseId: "",
    note: "",
    condition: "",
    elapsedSec: null,
    startedAt: null,
    lastSetInputAt: null,
    sets: createSetDrafts(5),
  }));
  const [editDrafts, setEditDrafts] = useState<Record<string, EntryDraft>>({});
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingBaseline, setEditingBaseline] = useState<string | null>(null);
  const [dayConditionDraft, setDayConditionDraft] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draftReadyKey, setDraftReadyKey] = useState<string | null>(null);
  const [persistedDraft, setPersistedDraft] = useState("");
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const confirmUnsavedNavigationRef = useRef<(() => boolean) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthRequest = useRef(0);
  const detailRequest = useRef(0);
  const [detailsLoading, setDetailsLoading] = useState(true);

  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const addStorageKey = user ? workoutDraftKey(user.id, effectiveSelectedDate) : null;
  const activeStorageKey = showAddForm ? addStorageKey : user && editingWorkoutId
    ? workoutDraftKey(user.id, effectiveSelectedDate, editingWorkoutId) : null;
  const activeLocalDraft = showAddForm ? addDraft : editingWorkoutId ? editDrafts[editingWorkoutId] : null;
  const activeDraftSnapshot = activeStorageKey && activeLocalDraft ? activeStorageKey + JSON.stringify(activeLocalDraft) : "";
  const isDraftProtected = Boolean(activeDraftSnapshot && activeDraftSnapshot === persistedDraft);

  useEffect(() => {
    if (!showAddForm || !addStorageKey) return;
    setDraftStorageError(null);
    setPersistedDraft("");
    try {
      const saved = readWorkoutDraft(window.localStorage, addStorageKey, isEntryDraft);
      const value = saved?.value ?? { exerciseId: "", note: "", condition: "", elapsedSec: null, startedAt: null, lastSetInputAt: null, sets: createSetDrafts(defaultSetCount) };
      setAddDraft(value);
      setDraftReadyKey(addStorageKey);
      if (saved) setPersistedDraft(addStorageKey + JSON.stringify(saved.value));
    } catch {
      setDraftReadyKey(null);
      setDraftStorageError("下書きを読み込めません。元の下書きは残しています。確定前に内容を確認してください。");
    }
    // Profile refresh must not reset a restored draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addStorageKey, showAddForm]);

  useEffect(() => {
    if (!activeStorageKey || !activeLocalDraft || savingKey || draftStorageError ||
      (showAddForm && draftReadyKey !== activeStorageKey)) return;
    try {
      if (activeLocalDraft.exerciseId) {
        writeWorkoutDraft(window.localStorage, activeStorageKey, activeLocalDraft, showAddForm ? null : editingBaseline);
        setPersistedDraft(activeDraftSnapshot);
      }
    } catch {
      setPersistedDraft("");
      setDraftStorageError("端末への下書き保存に失敗しました。閉じる前にチェックで記録を確定してください。");
    }
  }, [activeDraftSnapshot, activeLocalDraft, activeStorageKey, draftReadyKey, draftStorageError, editingBaseline, savingKey, showAddForm]);

  const clearLocalDraft = useCallback((key: string | null) => {
    if (!key) return;
    try { window.localStorage.removeItem(key); } catch { /* Cleanup failure must not resubmit a confirmed record. */ }
    setPersistedDraft("");
  }, []);

  const calendarPages = useMemo(
    () =>
      [-1, 0, 1].map((offset) => {
        const pageMonth = addMonths(month, offset);
        return {
          key: `${pageMonth.getFullYear()}-${pageMonth.getMonth()}`,
          month: pageMonth,
          cells: getCalendarCells(pageMonth),
        };
      }),
    [month],
  );
  const summariesByDate = useMemo(
    () => new Map(summaries.map((summary) => [summary.workoutDate, summary])),
    [summaries],
  );
  const isAddFormActive = showAddForm;
  const totalCalories = useMemo(() => {
    const addCalories = isAddFormActive ? estimateDraftCalories(addDraft, exercises, profile) : 0;
    const savedCalories = Object.values(editDrafts).reduce(
      (total, draft) => total + estimateDraftCalories(draft, exercises, profile),
      0,
    );
    return addCalories + savedCalories;
  }, [addDraft, editDrafts, exercises, isAddFormActive, profile]);
  const isAddDraftDirty =
    showAddForm &&
    (addDraft.sets.some(hasSetMeasurementInput) || addDraft.sets.some(set => set.note.trim()) || Boolean(addDraft.note.trim()));
  const editingExerciseId = editingWorkoutId ? (editDrafts[editingWorkoutId]?.exerciseId ?? "") : "";
  const isEditDraftDirty = Boolean(
    editingWorkoutId &&
    editingBaseline &&
    JSON.stringify(editDrafts[editingWorkoutId]) !== editingBaseline,
  );
  const hasUnprotectedDraft = (isAddDraftDirty || isEditDraftDirty) && !isDraftProtected;
  const resolvedDetailsHeading = exerciseHistoryId
    ? `${findExercise(exercises, exerciseHistoryId)?.name ?? "種目"}の記録履歴`
    : detailsHeading;
  const displayWorkouts = useMemo(() => {
    const ascending = [...workouts].sort((a, b) =>
      exerciseHistoryId
        ? a.workoutDate.localeCompare(b.workoutDate) || a.createdAt.localeCompare(b.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
    const filtered = exerciseFilterId
      ? ascending.flatMap((workout) => {
          const matchingExercises = workout.exercises.filter(
            (exercise) => exercise.exerciseId === exerciseFilterId,
          );
          return matchingExercises.length > 0
            ? [{ ...workout, exercises: matchingExercises }]
            : [];
        })
      : ascending;
    return profile?.session_sort_order === "asc" ? filtered : filtered.reverse();
  }, [exerciseFilterId, exerciseHistoryId, profile?.session_sort_order, workouts]);
  const savedDayCondition = useMemo(() => {
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const condition = exercise.condition?.trim();
        if (condition) {
          return condition;
        }
      }
    }
    return "";
  }, [workouts]);
  const isDayConditionDirty = dayConditionDraft.trim() !== savedDayCondition;
  const sessionNumberByWorkoutId = useMemo(
    () => new Map(
      [...workouts]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((workout, index) => [workout.id, index + 1]),
    ),
    [workouts],
  );

  useEffect(() => {
    setDayConditionDraft(savedDayCondition);
  }, [effectiveSelectedDate, savedDayCondition]);

  const loadMonth = useCallback(async () => {
    if (!user || !showCalendar) {
      return;
    }
    const request = ++monthRequest.current;
    const range = getCalendarRange(month);
    setSummaries([]);
    const nextSummaries = await getWorkoutSummaries(
      client, range.start, range.end, false,
    );
    if (monthRequest.current === request) {
      setSummaries(nextSummaries);
    }
  }, [client, month, showCalendar, user]);

  const loadSelectedDate = useCallback(async () => {
    if (!user || !showWorkoutDetails || showAddForm) {
      return;
    }
    setDetailsLoading(true);
    const request = ++detailRequest.current;
    try {
      const nextWorkouts = exerciseHistoryId
        ? await getWorkoutsForExercise(client, exerciseHistoryId)
        : await getWorkoutsByDate(client, effectiveSelectedDate);
      if (detailRequest.current === request) setWorkouts(nextWorkouts);
    } finally {
      if (detailRequest.current === request) setDetailsLoading(false);
    }
  }, [client, effectiveSelectedDate, exerciseHistoryId, showAddForm, showWorkoutDetails, user]);

  useEffect(() => {
    setEditDrafts((current) => {
      const next: Record<string, EntryDraft> = {};
      for (const workout of workouts) {
        const exercise = workout.exercises[0];
        if (exercise) {
          next[workout.id] = workout.id === editingWorkoutId && current[workout.id]
            ? current[workout.id]
            : createDraftFromWorkout(exercise, findExercise(exercises, exercise.exerciseId)?.cardioUnits);
        }
      }
      return next;
    });
  }, [editingWorkoutId, exercises, workouts]);

  const loadPreviousWorkout = useCallback(async () => {
    if (!user || !addDraft.exerciseId) {
      setPreviousWorkout(null);
      return;
    }
    setPreviousWorkout(
      await getLatestWorkoutForExerciseBeforeDate(client, addDraft.exerciseId, effectiveSelectedDate),
    );
  }, [addDraft.exerciseId, client, effectiveSelectedDate, user]);

  const loadEditPreviousWorkout = useCallback(
    async (workoutId: string, exerciseId: string) => {
      if (!user || !exerciseId) {
        setEditPreviousWorkouts((current) => ({ ...current, [workoutId]: null }));
        return;
      }
      const latest = await getLatestWorkoutForExerciseBeforeDate(client, exerciseId, effectiveSelectedDate);
      setEditPreviousWorkouts((current) => ({ ...current, [workoutId]: latest }));
    },
    [client, effectiveSelectedDate, user],
  );
  const loadBaseData = useCallback(async () => {
    if (!user || !showWorkoutDetails) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [nextBodyParts, nextExercises] = await Promise.all([
        getBodyParts(client),
        getExercises(client),
      ]);
      setBodyParts(nextBodyParts);
      setExercises(nextExercises);
    } catch (loadError) {
      console.error("Workout data load error", loadError);
      setError("トレーニングデータの読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [client, showWorkoutDetails, user]);

  useEffect(() => {
    if (!user || !showWorkoutDetails || profileStatus !== "ready") {
      return;
    }
    let active = true;
    const ids = new Set(showAddForm
      ? [addDraft.exerciseId]
      : workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.exerciseId)));
    const selected = exercises.filter((exercise) => ids.has(exercise.id));
    setExerciseRecords([]);
    if (selected.length > 0) {
      void getExerciseRecords(client, selected).then((records) => {
        if (active) setExerciseRecords(records);
      }).catch((recordError) => {
        if (active) {
          console.error("Exercise record load error", recordError);
          setError("最高記録の読み込みに失敗しました。");
        }
      });
    }
    return () => { active = false; };
  }, [addDraft.exerciseId, client, exercises, profileStatus, showAddForm, showWorkoutDetails, user, workouts]);

  useEffect(() => {
    if (selectedDateOverride) {
      setSelectedDate(selectedDateOverride);
    }
  }, [selectedDateOverride]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadBaseData();
    }
  }, [authStatus, loadBaseData, profileStatus]);

  useEffect(() => {
    const handleMasterDataChange = () => {
      if (authStatus === "authenticated" && profileStatus === "ready") {
        void loadBaseData();
      }
    };
    window.addEventListener("kochifit:master-data-changed", handleMasterDataChange);
    return () => window.removeEventListener("kochifit:master-data-changed", handleMasterDataChange);
  }, [authStatus, loadBaseData, profileStatus]);
  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadMonth().catch((loadError) => {
        console.error("Workout summary load error", loadError);
        setError("カレンダーの読み込みに失敗しました。");
      });
    }
  }, [authStatus, loadMonth, profileStatus]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadSelectedDate().catch((loadError) => {
        console.error("Workout detail load error", loadError);
        setError("選択日の記録読み込みに失敗しました。");
      });
    }
  }, [authStatus, loadSelectedDate, profileStatus]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadPreviousWorkout().catch((loadError) => {
        console.error("Previous workout load error", loadError);
        setPreviousWorkout(null);
      });
    }
  }, [authStatus, loadPreviousWorkout, profileStatus]);

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      profileStatus !== "ready" ||
      !editingWorkoutId ||
      !editingExerciseId
    ) {
      return;
    }
    void loadEditPreviousWorkout(editingWorkoutId, editingExerciseId).catch((loadError) => {
      console.error("Previous edit workout load error", loadError);
      setEditPreviousWorkouts((current) => ({ ...current, [editingWorkoutId]: null }));
    });
  }, [authStatus, editingExerciseId, editingWorkoutId, loadEditPreviousWorkout, profileStatus]);
  useEffect(() => {
    setAddDraft((current) => {
      if (current.sets.every(isBlankSetDraft)) {
        return { ...current, sets: createSetDrafts(defaultSetCount) };
      }
      return current;
    });
  }, [defaultSetCount]);

  useEffect(() => {
    if (isLoading || exercises.length === 0 || selectedBodyPartId === "all") return;
    const filteredExercises =
      selectedBodyPartId === "all"
        ? exercises
        : exercises.filter((exercise) => exercise.bodyPartId === selectedBodyPartId);
    if (addDraft.exerciseId && !filteredExercises.some((exercise) => exercise.id === addDraft.exerciseId)) {
      setAddDraft((current) => ({
        ...current,
        exerciseId: "",
      }));
    }
  }, [addDraft.exerciseId, exercises, isLoading, selectedBodyPartId]);

  const moveMonth = (delta: number) => setMonth((current) => addMonths(current, delta));
  const monthPickerDateKey = toDateKey(month);
  const jumpCalendarToDate = (dateKey: string) => {
    const nextDate = parseDateKey(dateKey);
    if (!nextDate) {
      return;
    }
    setMonth(startOfMonth(nextDate));
    setSelectedDate(dateKey);
  };
  const jumpToToday = () => jumpCalendarToDate(todayKey);
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (!showWorkoutDetails) {
      router.push(`/today?date=${dateKey}`);
    }
  };

  const handleAddSave = useCallback(async () => {
    if (!user || !addDraft.exerciseId || savingKey || saveInFlight.current) {
      return;
    }
    if (!hasAnySetInput(addDraft, profile)) {
      return;
    }

    saveInFlight.current = true;
    setSavingKey("add");
    setError(null);
    try {
      await createWorkout(client, {
        userId: user.id,
        workoutDate: effectiveSelectedDate,
        exerciseId: addDraft.exerciseId,
        note: addDraft.note.trim() || null,
        condition: addDraft.condition.trim() || null,
        elapsedSec: getDraftElapsedSec(addDraft),
        sets: toSetInputs(
          addDraft.sets,
          profile,
          findExercise(exercises, addDraft.exerciseId)?.cardioUnits,
        ),
      });
      clearLocalDraft(addStorageKey);
      setAddDraft({
        exerciseId: "",
        note: "",
        condition: "",
        elapsedSec: null,
        startedAt: null,
        lastSetInputAt: null,
        sets: createSetDrafts(defaultSetCount),
      });
      setPreviousWorkout(null);
      await Promise.all([loadMonth(), loadSelectedDate()]);
      if (showAddForm && backHref) {
        router.push(backHref);
      }
    } catch (saveError) {
      console.error("Workout save error", saveError);
      setError("トレーニングの保存に失敗しました。入力値を確認してください。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  }, [
    addDraft,
    addStorageKey,
    clearLocalDraft,
    backHref,
    client,
    defaultSetCount,
    effectiveSelectedDate,
    exercises,
    loadMonth,
    loadSelectedDate,
    profile,
    router,
    savingKey,
    showAddForm,
    user,
  ]);

  const confirmUnsavedNavigation = useCallback(() => {
    if ((!hasUnprotectedDraft && !isDayConditionDirty) || savingKey) {
      return true;
    }
    return window.confirm("保存していない内容があります。保存せず戻りますか？");
  }, [hasUnprotectedDraft, isDayConditionDirty, savingKey]);

  useEffect(() => {
    confirmUnsavedNavigationRef.current = confirmUnsavedNavigation;
  }, [confirmUnsavedNavigation]);

  const handleBackNavigation = useCallback(() => {
    if (!backHref) {
      return;
    }
    if ((confirmUnsavedNavigationRef.current ?? confirmUnsavedNavigation)()) {
      router.push(backHref);
    }
  }, [backHref, confirmUnsavedNavigation, router]);

  useEffect(() => {
    if (!hasUnprotectedDraft && !isDayConditionDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnprotectedDraft, isDayConditionDirty]);

  useEffect(() => {
    if (!hasUnprotectedDraft && !isDayConditionDirty) {
      return;
    }
    const handleNavigationConfirm = (event: Event) => {
      const scope = event instanceof CustomEvent ? event.detail?.scope : undefined;
      if (scope && scope !== "page") {
        return;
      }
      if (!confirmUnsavedNavigation()) {
        event.preventDefault();
      }
    };
    window.addEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
    return () => window.removeEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
  }, [confirmUnsavedNavigation, hasUnprotectedDraft, isDayConditionDirty]);

  useEffect(() => {
    if ((!hasUnprotectedDraft && !isDayConditionDirty) || !backHref) {
      return;
    }
    window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    const handlePopState = () => {
      if ((confirmUnsavedNavigationRef.current ?? confirmUnsavedNavigation)()) {
        router.push(backHref);
        return;
      }
      window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [backHref, confirmUnsavedNavigation, hasUnprotectedDraft, isDayConditionDirty, router]);

  const handleDayConditionSave = async () => {
    if (!user || savingKey || workouts.length === 0) {
      return;
    }
    const workoutExerciseIds = workouts.flatMap((workout) =>
      workout.exercises.map((exercise) => exercise.id),
    );
    const activeEditDraft = editingWorkoutId ? editDrafts[editingWorkoutId] : null;
    const activeEditWasClean = Boolean(
      activeEditDraft && editingBaseline && JSON.stringify(activeEditDraft) === editingBaseline,
    );
    setSavingKey("day-condition");
    setError(null);
    try {
      const nextCondition = dayConditionDraft.trim() || null;
      await updateWorkoutExerciseConditions(client, user.id, workoutExerciseIds, nextCondition);
      setWorkouts((current) => current.map((workout) => ({
        ...workout,
        exercises: workout.exercises.map((exercise) => ({
          ...exercise,
          condition: nextCondition,
        })),
      })));
      setEditDrafts((current) => Object.fromEntries(
        Object.entries(current).map(([workoutId, draft]) => [
          workoutId,
          { ...draft, condition: nextCondition ?? "" },
        ]),
      ));
      if (activeEditDraft && activeEditWasClean) {
        setEditingBaseline(JSON.stringify({
          ...activeEditDraft,
          condition: nextCondition ?? "",
        }));
      }
    } catch (conditionError) {
      console.error("Workout condition update error", conditionError);
      setError("体調・コンディションの保存に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };

  const handleEditSave = async (workout: Workout) => {
    if (!user || savingKey || saveInFlight.current) {
      return;
    }
    const workoutExercise = workout.exercises[0];
    const draft = editDrafts[workout.id];
    if (!workoutExercise || !draft) {
      return;
    }
    if (!hasAnySetInput(draft, profile)) {
      setError("重量または回数を入力してください。");
      return;
    }

    saveInFlight.current = true;
    setSavingKey(workout.id);
    setError(null);
    try {
      await updateWorkout(client, {
        userId: user.id,
        workoutId: workout.id,
        workoutExerciseId: workoutExercise.id,
        workoutDate: workout.workoutDate,
        exerciseId: draft.exerciseId,
        note: draft.note.trim() || null,
        condition: draft.condition.trim() || null,
        elapsedSec: draft.elapsedSec,
        sets: toSetInputs(
          draft.sets,
          profile,
          findExercise(exercises, draft.exerciseId)?.cardioUnits,
        ),
      });
      clearLocalDraft(activeStorageKey);
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
      setEditingWorkoutId(null);
      setEditingBaseline(null);
    } catch (saveError) {
      console.error("Workout update error", saveError);
      setError("トレーニングの更新に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };

  const handleDelete = async (workoutId: string) => {
    if (!window.confirm("この記録を削除しますか？")) {
      return;
    }
    setSavingKey(workoutId);
    setError(null);
    try {
      await deleteWorkout(client, workoutId);
      if (user) clearLocalDraft(workoutDraftKey(user.id, effectiveSelectedDate, workoutId));
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
      setEditingWorkoutId(null);
      setEditingBaseline(null);
    } catch (deleteError) {
      console.error("Workout delete error", deleteError);
      setError("トレーニングの削除に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };
  const isSwipeNavigationEnabled = showCalendar;
  const dragOffset = touchStartX === null || !isSwipeNavigationEnabled ? 0 : Math.max(-280, Math.min(280, touchDeltaX));

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isSwipeNavigationEnabled) {
      return;
    }
    setTouchStartX(event.touches[0]?.clientX ?? null);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || !isSwipeNavigationEnabled) {
      return;
    }
    const currentX = event.touches[0]?.clientX ?? touchStartX;
    setTouchDeltaX(currentX - touchStartX);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || !isSwipeNavigationEnabled) {
      return;
    }
    const delta = touchDeltaX || (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(delta) > 50) {
      moveMonth(delta > 0 ? -1 : 1);
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  const handleTouchCancel = () => {
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  const swipeHandlers = isSwipeNavigationEnabled
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
      }
    : {};

  const draftNotice = activeLocalDraft?.exerciseId ? <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--muted)]">
          <p role="status">{draftStorageError ?? (isDraftProtected ? "下書き保存済み（この端末）・チェックで記録を確定" : "下書きを保存中")}</p>
          <button type="button" disabled={Boolean(savingKey)} className="shrink-0 rounded-lg px-2 py-1 underline" onClick={() => {
            if (!window.confirm("この下書きを破棄しますか？確定済みの記録は変更されません。")) return;
            clearLocalDraft(activeStorageKey);
            setDraftStorageError(null);
            if (showAddForm) {
              setAddDraft({ exerciseId: "", note: "", condition: "", elapsedSec: null, startedAt: null, lastSetInputAt: null, sets: createSetDrafts(defaultSetCount) });
              setDraftReadyKey(addStorageKey);
            } else { setEditingWorkoutId(null); setEditingBaseline(null); }
          }}>下書きを破棄</button>
        </div> : null;

  return (
    <div {...swipeHandlers}>
      {showCalendar ? (
        <>
          <div className="mb-4 flex min-h-10 items-center justify-between gap-2">
            <label className="relative flex min-h-10 min-w-0 cursor-pointer items-center rounded-[12px] text-base font-semibold tracking-tight sm:text-lg">
              <span className="whitespace-nowrap">
                {month.getFullYear()}年{month.getMonth() + 1}月
              </span>
              <input
                type="date"
                value={monthPickerDateKey}
                onChange={(event) => jumpCalendarToDate(event.target.value)}
                aria-label="表示する日付を選択"
                className="absolute inset-0 w-full min-w-0 cursor-pointer opacity-0"
              />
            </label>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={jumpToToday}
              aria-label="今日へ戻る"
              className="ui-today-button text-sm font-semibold"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="前月"
              className="ui-icon-button text-[var(--muted)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="翌月"
              className="ui-icon-button text-[var(--muted)]"
            >
              <ChevronRight size={19} />
            </button>
            </div>
          </div>

          <div className="overflow-hidden">
            <div
              className={[
                "flex will-change-transform",
                touchStartX === null ? "transition-transform duration-200 ease-out" : "transition-none",
              ].join(" ")}
              style={{ transform: `translateX(calc(-100% + ${dragOffset}px))` }}
            >
              {calendarPages.map((page) => (
                <div
                  key={page.key}
                  className="grid w-full shrink-0 grid-cols-7 justify-items-center gap-y-1.5 text-center"
                >
                  {weekdays.map((weekday) => (
                    <div key={weekday} className="pb-2 text-[11px] font-medium text-[var(--muted)]">
                      {weekday}
                    </div>
                  ))}
                  {page.cells.map((cell) => {
                    const summary = summariesByDate.get(cell.dateKey);
                    const isToday = cell.dateKey === todayKey;
                    const isSelected = cell.dateKey === effectiveSelectedDate;
                    const summaryBodyParts = summary?.bodyParts.slice(0, 7) ?? [];
                    return (
                      <button
                        key={`${page.key}-${cell.dateKey}`}
                        type="button"
                        onClick={() => handleDateClick(cell.dateKey)}
                        className={[
                          "calendar-day relative flex h-11 w-full max-w-11 flex-col items-center justify-start rounded-[12px] pt-0.5 text-sm font-medium",
                          cell.isCurrentMonth ? "bg-transparent" : "bg-transparent opacity-40",
                          isSelected && !isToday ? "bg-[var(--surface-soft)]" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-8 w-8 items-center justify-center rounded-full",
                            isToday ? "accent-orb text-white" : "",
                          ].join(" ")}
                        >
                          {cell.day}
                        </span>
                        {summaryBodyParts.length > 0 ? (
                          <span
                            className={[
                              "absolute bottom-0 flex max-w-8 flex-wrap justify-center gap-0.5",
                              cell.isCurrentMonth ? "" : "opacity-60",
                            ].join(" ")}
                          >
                            {summaryBodyParts.map((bodyPart) => {
                              const color = getBodyPartColor(bodyPart.key, bodyPart.colorKey);
                              return (
                                <span
                                  key={bodyPart.key}
                                  aria-hidden="true"
                                  className="color-orb h-1.5 w-1.5 rounded-full"
                                  style={{ "--color-orb": color } as CSSProperties}
                                />
                              );
                            })}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/today"
            aria-label="今日のトレーニングを追加"
            className="ui-fab"
          >
            <Plus size={22} />
          </Link>
        </>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[12px] border border-[var(--warning)] px-3 py-2 text-sm text-[var(--warning)]">
          {error}
        </div>
      ) : null}

      {showWorkoutDetails ? (
      <section className={[!showCalendar && detailsHeading ? "mt-0" : "mt-5", "space-y-3"].join(" ")}>

        {!showCalendar && detailsHeading ? (
          <div className={showAddForm ? "sticky top-0 z-30 -mx-3 flex items-center justify-between gap-2 bg-[color-mix(in_srgb,var(--background)_82%,transparent)] px-3 py-2 backdrop-blur-xl" : "flex items-center justify-between gap-2"}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {backHref ? (
                showAddForm ? (
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    aria-label="閉じる"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
                  >
                    <X size={22} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    aria-label="戻る"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )
              ) : null}
              <h1 className="min-w-0 truncate whitespace-nowrap text-base font-semibold leading-tight sm:text-lg">
                {resolvedDetailsHeading}
              </h1>
            </div>
            {showAddForm ? (
              <button
                type="button"
                onClick={() => void handleAddSave()}
                disabled={!addDraft.exerciseId || !hasAnySetInput(addDraft, profile) || savingKey === "add"}
                aria-label="記録を保存"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"
              >
                <Check size={22} />
              </button>
            ) : exerciseHistoryId ? null : (
              <div className="shrink-0 whitespace-nowrap rounded-[12px] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
                合計 約{totalCalories}kcal
              </div>
            )}
          </div>
        ) : (
        <div className="flex items-start justify-end gap-3">
          <div className="flex flex-col items-end gap-2">
            <div className="whitespace-nowrap rounded-[12px] border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]">
              合計 約{totalCalories}kcal
            </div>
          </div>
          {isLoading ? <span className="text-sm text-[var(--muted)]">読込中</span> : null}
        </div>
        )}

        {!showCalendar && !showAddForm && !exerciseHistoryId && workouts.length > 0 ? (
          <section className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2.5 shadow-[var(--shadow)]">
            <h2 className="text-xs font-semibold text-[var(--muted)]">体調・コンディション</h2>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={dayConditionDraft}
                onChange={(event) => setDayConditionDraft(event.target.value)}
                placeholder="その日の体調など"
                className="h-10 min-w-0 flex-1 rounded-[12px] bg-[var(--surface)] px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleDayConditionSave()}
                disabled={!isDayConditionDirty || savingKey === "day-condition"}
                aria-label="体調・コンディションを保存"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"
              >
                <Check size={20} />
              </button>
            </div>
          </section>
        ) : null}

        {showCalendar ? (
          <Link
            href={`/today/add?date=${effectiveSelectedDate}`}
            aria-label="記録を追加"
            className="ui-fab"
          >
            <Plus size={20} />
          </Link>
        ) : null}

        {!showCalendar && !showAddForm && !exerciseHistoryId ? (
          <Link
            href={`/today/add?date=${effectiveSelectedDate}`}
            aria-label="記録を追加"
            className="ui-fab"
          >
            <Plus size={22} />
          </Link>
        ) : null}

        {showAddForm ? (
          <WorkoutEntryForm
            bodyParts={bodyParts}
            defaultSetCount={defaultSetCount}
            draft={addDraft}
            draftNotice={draftNotice}
            exerciseRecords={exerciseRecords}
            exercises={exercises}
            historyReturnHref={`/today/add?date=${effectiveSelectedDate}`}
            isSaving={savingKey === "add"}
            masterReturnHref={`/today/add?date=${effectiveSelectedDate}`}
            mode="add"
            onDraftChange={setAddDraft}
            onSave={() => void handleAddSave()}
            previousWorkout={previousWorkout}
            profile={profile}
            selectedBodyPartId={selectedBodyPartId}
            setSelectedBodyPartId={setSelectedBodyPartId}
          />
        ) : null}

        {!showCalendar && !showAddForm && !isLoading && !detailsLoading && workouts.length === 0 ? (
          exerciseHistoryId ? (
            <p className="flex min-h-[calc(100svh-13rem)] items-center justify-center text-center text-sm font-medium text-[var(--muted)]">
              この種目の記録はまだありません
            </p>
          ) : (
            <Link
              href={`/today/add?date=${effectiveSelectedDate}`}
              className="flex min-h-[calc(100svh-13rem)] items-center justify-center text-center text-sm font-medium text-[var(--muted)]"
            >
              タップして種目を追加
            </Link>
          )
        ) : null}

        {!showAddForm ? displayWorkouts.map((workout, index) => {
          if (!showCalendar && editingWorkoutId !== workout.id) {
            return (
            <WorkoutReadOnlyCard
              key={workout.id}
              exerciseRecords={exerciseRecords}
              exercises={exercises}
              onEdit={() => {
                let value = editDrafts[workout.id];
                if (!value || !user) return;
                const baseline = JSON.stringify(value);
                try {
                  const saved = readWorkoutDraft(window.localStorage, workoutDraftKey(user.id, effectiveSelectedDate, workout.id), isEntryDraft);
                  if (saved) {
                    if (saved.baseline !== baseline && !window.confirm("記録が更新されています。以前の下書きを復元しますか？キャンセルすると下書きを破棄して最新の記録から編集します。")) {
                      clearLocalDraft(workoutDraftKey(user.id, effectiveSelectedDate, workout.id));
                    } else value = saved.value;
                  }
                  setDraftStorageError(null);
                } catch { setDraftStorageError("下書きを読み込めません。自動保存を停止しています。"); }
                setEditDrafts(current => ({ ...current, [workout.id]: value }));
                setEditingWorkoutId(workout.id);
                setEditingBaseline(baseline);
              }}
              sessionNumber={sessionNumberByWorkoutId.get(workout.id) ?? index + 1}
              showDate={Boolean(exerciseHistoryId)}
              workout={workout}
            />
            );
          }
            const draft = editDrafts[workout.id];
            if (!draft || workout.exercises.length === 0) {
              return null;
            }
            return (
              <WorkoutEntryForm
                key={workout.id}
                bodyParts={bodyParts}
                defaultSetCount={defaultSetCount}
                draft={draft}
                draftNotice={draftNotice}
                exerciseRecords={exerciseRecords}
                exercises={exercises}
                historyReturnHref={exerciseHistoryId
                  ? backHref ?? "/history"
                  : `/today?date=${effectiveSelectedDate}${exerciseFilterId ? `&exercise=${encodeURIComponent(exerciseFilterId)}` : ""}`}
                isSaving={savingKey === workout.id}
                mode="edit"
                recordDate={exerciseHistoryId ? workout.workoutDate : undefined}
                onDelete={() => void handleDelete(workout.id)}
                onDraftChange={(nextDraft) =>
                  setEditDrafts((current) => ({ ...current, [workout.id]: nextDraft }))
                }
                onHeaderClick={() => {
                  if (confirmUnsavedNavigation()) {
                    const workoutExercise = workout.exercises[0];
                    if (workoutExercise) {
                      setEditDrafts((current) => ({
                        ...current,
                        [workout.id]: createDraftFromWorkout(
                          workoutExercise,
                          findExercise(exercises, workoutExercise.exerciseId)?.cardioUnits,
                        ),
                      }));
                    }
                    setEditingWorkoutId(null);
                    setEditingBaseline(null);
                  }
                }}
                onSave={() => void handleEditSave(workout)}
                previousWorkout={editPreviousWorkouts[workout.id] ?? null}
                profile={profile}
                sessionNumber={sessionNumberByWorkoutId.get(workout.id) ?? index + 1}
              />
            );
        }) : null}

      </section>
      ) : null}
    </div>
  );
}
