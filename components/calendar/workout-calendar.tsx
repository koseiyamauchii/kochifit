"use client";

import { ChevronLeft, ChevronRight, Copy, History, Plus, Save, Scale, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import { estimateWorkoutExerciseCalories } from "@/lib/workouts/calories";
import {
  addMonths,
  getCalendarCells,
  getMonthRange,
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
  getWorkoutSummaries,
  getWorkoutsByDate,
  updateWorkout,
} from "@/lib/workouts/repository";
import type {
  BodyPart,
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
  note: string;
}

interface EntryDraft {
  exerciseId: string;
  note: string;
  sets: SetDraft[];
}

interface WorkoutCalendarProps {
  backHref?: string;
  detailsHeading?: string;
  showCalendar?: boolean;
  showWorkoutDetails?: boolean;
  selectedDateOverride?: string;
  showAddForm?: boolean;
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
  return { weightKg: "", reps: "", isWarmup: false, note: "" };
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
  return set.weightKg === "" && set.reps === "" && !set.isWarmup && set.note.trim() === "";
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

function formatWorkoutCreatedTime(createdAt: string | null | undefined) {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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

function formatRm(weightKg: number | null, reps: number | null) {
  const rm = estimateOneRepMax(weightKg, reps);
  return rm === null ? "-" : `${rm.toFixed(1)}kg`;
}

function toSetInputs(
  sets: SetDraft[],
  profile: ReturnType<typeof useAuth>["profile"],
): CreateWorkoutSetInput[] {
  return sets.map((set) => ({
    weightKg: toWeightNumberOrNull(set.weightKg, profile),
    reps: toNumberOrNull(set.reps),
    isWarmup: set.isWarmup,
    note: set.note.trim() || null,
  }));
}

function createDraftFromWorkout(exercise: WorkoutExercise): EntryDraft {
  return {
    exerciseId: exercise.exerciseId,
    note: exercise.note ?? "",
    sets: exercise.sets.map((set) => ({
      weightKg: set.weightKg !== null ? set.weightKg.toFixed(1) : "",
      reps: set.reps !== null ? String(set.reps) : "",
      isWarmup: set.isWarmup,
      note: set.note ?? "",
    })),
  };
}

function findExercise(exercises: Exercise[], exerciseId: string) {
  return exercises.find((exercise) => exercise.id === exerciseId) ?? null;
}

function estimateDraftCalories(
  draft: EntryDraft,
  exercises: Exercise[],
  profile: ReturnType<typeof useAuth>["profile"],
) {
  return estimateWorkoutExerciseCalories({
    profile,
    exercise: findExercise(exercises, draft.exerciseId),
    sets: toSetInputs(draft.sets, profile),
  });
}

function findBodyPart(bodyParts: BodyPart[], exercise: Exercise | null) {
  if (!exercise) {
    return null;
  }
  return bodyParts.find((bodyPart) => bodyPart.id === exercise.bodyPartId) ?? null;
}

function getExerciseBodyPartColor(bodyParts: BodyPart[], exercise: Exercise | null) {
  const bodyPart = findBodyPart(bodyParts, exercise);
  return bodyPart
    ? getBodyPartColor(bodyPart.key, bodyPart.colorKey)
    : getBodyPartColor(exercise?.bodyPartKey ?? null);
}

function hasAnySetInput(draft: EntryDraft, profile: ReturnType<typeof useAuth>["profile"]) {
  return toSetInputs(draft.sets, profile).some(
    (set) => set.weightKg !== null || set.reps !== null || set.note !== null,
  );
}

function PreviousWorkoutBlock({
  previousWorkout,
  onCopyAll,
}: {
  previousWorkout: WorkoutExercise | null;
  onCopyAll: () => void;
}) {
  return (
    <div className="rounded-[12px] bg-[var(--surface-soft)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-semibold">前回の記録</h4>
        <div className="flex shrink-0 items-center gap-2">
          {previousWorkout ? (
            <Link
              href={`/today?date=${previousWorkout.workoutDate}`}
              className="rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)]"
            >
              詳細
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onCopyAll}
            disabled={!previousWorkout}
            className="flex min-h-9 items-center gap-1.5 rounded-[12px] bg-[var(--accent)] px-3 text-sm font-medium text-white disabled:opacity-40"
          >
            <Copy size={15} />
            コピー
          </button>
        </div>
      </div>
      {previousWorkout ? (
        <div className="space-y-2">
          <div className="space-y-1.5 text-xs text-[var(--muted)]">
            {previousWorkout.sets.map((set, index) => (
              <div key={set.id} className="grid grid-cols-[3.5rem_1fr] items-start gap-2 rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5">
                <span className="font-semibold">{set.isWarmup ? "W" : "セット " + (index + 1)}</span>
                <span className="min-w-0">
                  {formatSetLine(set.weightKg, set.reps)}
                  {set.note ? ` / ${set.note}` : ""}
                </span>
              </div>
            ))}
          </div>
          {previousWorkout.note ? (
            <p className="text-sm text-[var(--muted)]">前回メモ：{previousWorkout.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">この種目の前回記録はまだありません。</p>
      )}
    </div>
  );
}

function WorkoutReadOnlyCard({
  bodyParts,
  exercises,
  onEdit,
  workout,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  onEdit: () => void;
  workout: Workout;
}) {
  const exercise = workout.exercises[0];
  if (!exercise) {
    return null;
  }
  const masterExercise = findExercise(exercises, exercise.exerciseId);
  const bodyPartColor = getExerciseBodyPartColor(bodyParts, masterExercise);
  const createdTime = formatWorkoutCreatedTime(workout.createdAt);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="block w-full overflow-hidden rounded-[12px] bg-[var(--surface)] text-left shadow-[var(--shadow)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-3 py-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden="true"
            className="color-orb h-3 w-3 shrink-0 rounded-full"
            style={{ "--color-orb": bodyPartColor } as CSSProperties}
          />
          <span className="min-w-0 truncate">{exercise.exerciseName}</span>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">
          {createdTime ? (
            <span className="rounded-[12px] bg-[var(--surface-soft)] px-2 py-1">追加 {createdTime}</span>
          ) : null}
          <span className="rounded-[12px] bg-[var(--surface-soft)] px-2 py-1">
            {exercise.sets.length}セット
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[2.4rem_1fr_1fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
        <span>セット</span>
        <span>重量</span>
        <span>回数</span>
        <span>RM</span>
      </div>
      <div className="divide-y divide-[var(--hairline)] px-3">
        {exercise.sets.map((set, index) => (
          <div key={set.id} className="py-1.5">
            <div className="grid min-h-7 grid-cols-[2.4rem_1fr_1fr_1fr] items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--muted)]">{set.isWarmup ? "W" : index + 1}</span>
              <span className="font-medium">{formatWeightNumber(set.weightKg)}kg</span>
              <span className="font-medium">{set.reps ?? "-"}回</span>
              <span className="font-semibold text-[var(--muted)]">{formatRm(set.weightKg, set.reps)}</span>
            </div>
            {set.note ? <p className="mt-1 text-xs text-[var(--muted)]">メモ：{set.note}</p> : null}
          </div>
        ))}
      </div>
      {exercise.note ? (
        <div className="border-t border-[var(--hairline)] px-3 py-2 text-xs text-[var(--muted)]">
          メモ：{exercise.note}
        </div>
      ) : null}
    </button>
  );
}

function WorkoutEntryForm({
  bodyParts,
  defaultSetCount,
  draft,
  exercises,
  exerciseRecords,
  isSaving,
  mode,
  onDelete,
  onDraftChange,
  onHeaderClick,
  onSave,
  previousWorkout,
  profile,
  selectedBodyPartId,
  setSelectedBodyPartId,
}: {
  bodyParts: BodyPart[];
  defaultSetCount: number;
  draft: EntryDraft;
  exercises: Exercise[];
  exerciseRecords: ExerciseRecord[];
  isSaving: boolean;
  mode: "add" | "edit";
  onDelete?: () => void;
  onDraftChange: (draft: EntryDraft) => void;
  onHeaderClick?: () => void;
  onSave: () => void;
  previousWorkout?: WorkoutExercise | null;
  profile: ReturnType<typeof useAuth>["profile"];
  selectedBodyPartId?: string;
  setSelectedBodyPartId?: (bodyPartId: string) => void;
}) {
  const selectedExercise = findExercise(exercises, draft.exerciseId);
  const headerTitle = selectedExercise?.name ?? "種目を追加してください";
  const filteredExercises =
    mode === "add" && selectedBodyPartId && selectedBodyPartId !== "all"
      ? exercises.filter((exercise) => exercise.bodyPartId === selectedBodyPartId)
      : exercises;
  const estimatedCalories = estimateDraftCalories(draft, exercises, profile);
  const exerciseBodyPartColor = getExerciseBodyPartColor(bodyParts, selectedExercise);
  const exerciseRecord = exerciseRecords.find((record) => record.exerciseId === draft.exerciseId);
  const maxWeightKg = exerciseRecord?.maxWeightKg ?? null;
  const canSave = Boolean(draft.exerciseId && hasAnySetInput(draft, profile));
  const firstHighestWeightSetIndex = draft.sets.findIndex((set) => {
    const weightKg = toWeightNumberOrNull(set.weightKg, profile);
    return maxWeightKg !== null && weightKg !== null && weightKg >= maxWeightKg;
  });

  const updateSet = (index: number, nextSet: Partial<SetDraft>) => {
    onDraftChange({
      ...draft,
      sets: draft.sets.map((set, setIndex) =>
        setIndex === index ? { ...set, ...nextSet } : set,
      ),
    });
  };

  const addSet = () => {
    onDraftChange({ ...draft, sets: [...draft.sets, createInitialSetDraft()] });
  };

  const removeSet = (index: number) => {
    onDraftChange({ ...draft, sets: draft.sets.filter((_, setIndex) => setIndex !== index) });
  };

  const copyPreviousSet = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, source);
    }
  };

  const copyPreviousSetWeight = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, { weightKg: source.weightKg });
    }
  };

  const copyPreviousSetReps = (index: number) => {
    const source = draft.sets[index - 1];
    if (source) {
      updateSet(index, { reps: source.reps });
    }
  };

  const applyBodyWeight = (index: number) => {
    if (typeof profile?.body_weight_kg !== "number") {
      return;
    }
    updateSet(index, { weightKg: bodyWeightInputLabel });
  };

  const copyPreviousHistorySet = (index: number) => {
    const source = previousWorkout?.sets[index] ?? previousWorkout?.sets[0];
    if (!source) {
      return;
    }
    updateSet(index, {
      weightKg: source.weightKg !== null ? source.weightKg.toFixed(1) : "",
      reps: source.reps !== null ? String(source.reps) : "",
      isWarmup: source.isWarmup,
      note: source.note ?? "",
    });
  };

  const copyPreviousHistory = () => {
    if (!previousWorkout) {
      return;
    }
    const copied = previousWorkout.sets.map((set) => ({
      weightKg: set.weightKg !== null ? set.weightKg.toFixed(1) : "",
      reps: set.reps !== null ? String(set.reps) : "",
      isWarmup: set.isWarmup,
      note: set.note ?? "",
    }));
    while (copied.length < defaultSetCount) {
      copied.push(createInitialSetDraft());
    }
    onDraftChange({ ...draft, sets: copied, note: previousWorkout.note ?? "" });
  };

  return (
    <section className="overflow-hidden rounded-[12px] bg-[var(--surface)] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="color-orb h-3 w-3 shrink-0 rounded-full"
            style={{ "--color-orb": exerciseBodyPartColor } as CSSProperties}
          />
          <div className="min-w-0">
            {onHeaderClick ? (
              <button
                type="button"
                onClick={onHeaderClick}
                className="min-w-0 text-left"
                aria-label={headerTitle + "を閉じる"}
              >
                <h3 className="min-w-0 truncate text-sm font-semibold">{headerTitle}</h3>
              </button>
            ) : (
              <h3 className="min-w-0 truncate text-sm font-semibold">{headerTitle}</h3>
            )}
          </div>
        </div>
        <div className="shrink-0 whitespace-nowrap rounded-[12px] bg-[var(--surface-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted)]">
          約{estimatedCalories}kcal
        </div>
      </div>
      <div className="space-y-2.5 p-2.5">

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
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">種目</span>
          <select
            value={draft.exerciseId}
            onChange={(event) => onDraftChange({ ...draft, exerciseId: event.target.value })}
            className="min-h-11 w-full rounded-[12px] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text)] ring-1 ring-[var(--border)]"
          >
            <option value="">種目を追加してください</option>
            {filteredExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === "add" && filteredExercises.length === 0 ? (
        <p className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">
          種目マスタで種目を追加してください。
        </p>
      ) : null}

      {mode === "add" && filteredExercises.length > 0 && !hasAnySetInput(draft, profile) ? (
        <p className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--muted)]">
          重量、回数、メモのいずれかを入力してください。
        </p>
      ) : null}

      {selectedExercise?.rackPosition || selectedExercise?.memo ? (
        <div className="space-y-1 rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm">
          {selectedExercise.rackPosition ? (
            <p>
              <span className="text-[var(--muted)]">ラック位置：</span>
              <span className="font-medium">{selectedExercise.rackPosition}</span>
            </p>
          ) : null}
          {selectedExercise.memo ? (
            <p>
              <span className="text-[var(--muted)]">種目メモ：</span>
              <span className="font-medium">{selectedExercise.memo}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {previousWorkout !== undefined ? (
        <PreviousWorkoutBlock previousWorkout={previousWorkout ?? null} onCopyAll={copyPreviousHistory} />
      ) : null}

      <div className="space-y-2">
        {draft.sets.map((set, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[12px] bg-[var(--surface-soft)] p-2"
          >
            <div className="-mx-2 -mt-2 mb-2 flex items-center justify-between gap-2 bg-[var(--accent)] px-2.5 py-1.5 text-white">
              <span className="text-xs font-semibold">
                セット {index + 1}
              </span>
              {index === firstHighestWeightSetIndex ? (
                <span className="flex min-h-6 items-center gap-1 rounded-[12px] bg-white/20 px-2 text-[11px] font-semibold text-white">
                  <Trophy size={14} />
                  最高重量
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">重量 kg</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => applyBodyWeight(index)}
                      disabled={typeof profile?.body_weight_kg !== "number"}
                      aria-label="自重を入力"
                      title="自重を入力"
                      className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                    >
                      <Scale size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPreviousSetWeight(index)}
                      disabled={index === 0}
                      aria-label="前セットの重量をコピー"
                      title="前セットの重量をコピー"
                      className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>
                <input
                  inputMode="decimal"
                  value={set.weightKg}
                  onChange={(event) => updateSet(index, { weightKg: event.target.value })}
                  onBlur={(event) => updateSet(index, { weightKg: formatWeightInput(event.target.value) })}
                  className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-3 text-sm"
                />
              </div>
              <div className="min-w-0 space-y-1">
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
                    <Copy size={18} />
                  </button>
                </div>
                <input
                  inputMode="numeric"
                  value={set.reps}
                  onChange={(event) => updateSet(index, { reps: event.target.value })}
                  className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-3 text-sm"
                />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex h-8 items-center text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">推定1RM</span>
                </div>
                <div className="flex min-h-10 w-full min-w-0 items-center rounded-[12px] bg-[var(--surface)] px-3 text-sm font-semibold">
                  {formatRm(toWeightNumberOrNull(set.weightKg, profile), toNumberOrNull(set.reps))}
                </div>
              </div>
            </div>
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
                <Copy size={17} />
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
                  <History size={17} />
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
            <Save size={17} />
            {isSaving ? "保存中" : "保存"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? "保存中" : "保存"}
        </button>
      )}
      </div>
    </section>
  );
}

export function WorkoutCalendar({
  backHref,
  detailsHeading,
  showCalendar = true,
  showWorkoutDetails = true,
  selectedDateOverride,
  showAddForm = false,
}: WorkoutCalendarProps) {
  const { user, authStatus, profile, profileStatus } = useAuth();
  const todayKey = toDateKey(new Date());
  const todayDay = Number(todayKey.slice(-2));
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
    sets: createSetDrafts(5),
  }));
  const [editDrafts, setEditDrafts] = useState<Record<string, EntryDraft>>({});
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const confirmUnsavedAddNavigationRef = useRef<(() => boolean) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const client = useMemo(() => createClient(), []);
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
    (Boolean(addDraft.exerciseId) ||
      addDraft.note.trim() !== "" ||
      addDraft.sets.some((set) => !isBlankSetDraft(set)));
  const editingExerciseId = editingWorkoutId ? (editDrafts[editingWorkoutId]?.exerciseId ?? "") : "";

  const loadMonth = useCallback(async () => {
    if (!user) {
      return;
    }
    const previousRange = getMonthRange(addMonths(month, -1));
    const nextRange = getMonthRange(addMonths(month, 1));
    setSummaries(await getWorkoutSummaries(client, previousRange.start, nextRange.end));
  }, [client, month, user]);

  const loadSelectedDate = useCallback(async () => {
    if (!user) {
      return;
    }
    const nextWorkouts = await getWorkoutsByDate(client, effectiveSelectedDate);
    setWorkouts(nextWorkouts);
    setEditDrafts((current) => {
      const next: Record<string, EntryDraft> = {};
      for (const workout of nextWorkouts) {
        const exercise = workout.exercises[0];
        if (exercise) {
          next[workout.id] = current[workout.id] ?? createDraftFromWorkout(exercise);
        }
      }
      return next;
    });
  }, [client, effectiveSelectedDate, user]);

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
    if (!user) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [nextBodyParts, nextExercises] = await Promise.all([
        getBodyParts(client),
        getExercises(client),
      ]);
      const nextExerciseRecords = await getExerciseRecords(client);
      setBodyParts(nextBodyParts);
      setExercises(nextExercises);
      setExerciseRecords(nextExerciseRecords);
    } catch (loadError) {
      console.error("Workout data load error", loadError);
      setError("トレーニングデータの読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [client, user]);

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
  }, [addDraft.exerciseId, exercises, selectedBodyPartId]);

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
    if (!user || !addDraft.exerciseId || savingKey) {
      return;
    }
    if (!hasAnySetInput(addDraft, profile)) {
      return;
    }

    setSavingKey("add");
    setError(null);
    try {
      await createWorkout(client, {
        userId: user.id,
        workoutDate: effectiveSelectedDate,
        exerciseId: addDraft.exerciseId,
        note: addDraft.note.trim() || null,
        sets: toSetInputs(addDraft.sets, profile),
      });
      setAddDraft((current) => ({
        exerciseId: current.exerciseId,
        note: "",
        sets: createSetDrafts(defaultSetCount),
      }));
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
      if (showAddForm && backHref) {
        router.push(backHref);
      }
    } catch (saveError) {
      console.error("Workout save error", saveError);
      setError("トレーニングの保存に失敗しました。入力値を確認してください。");
    } finally {
      setSavingKey(null);
    }
  }, [
    addDraft,
    backHref,
    client,
    defaultSetCount,
    effectiveSelectedDate,
    loadMonth,
    loadPreviousWorkout,
    loadSelectedDate,
    profile,
    router,
    savingKey,
    showAddForm,
    user,
  ]);

  const confirmUnsavedAddNavigation = useCallback(() => {
    if (!isAddDraftDirty || savingKey) {
      return true;
    }
    return window.confirm("保存していない内容があります。保存せず戻りますか？");
  }, [isAddDraftDirty, savingKey]);

  useEffect(() => {
    confirmUnsavedAddNavigationRef.current = confirmUnsavedAddNavigation;
  }, [confirmUnsavedAddNavigation]);

  const handleBackNavigation = useCallback(() => {
    if (!backHref) {
      return;
    }
    if ((confirmUnsavedAddNavigationRef.current ?? confirmUnsavedAddNavigation)()) {
      router.push(backHref);
    }
  }, [backHref, confirmUnsavedAddNavigation, router]);

  useEffect(() => {
    if (!isAddDraftDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isAddDraftDirty]);

  useEffect(() => {
    if (!showAddForm) {
      return;
    }
    const handleNavigationConfirm = (event: Event) => {
      if (!confirmUnsavedAddNavigation()) {
        event.preventDefault();
      }
    };
    window.addEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
    return () => window.removeEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
  }, [confirmUnsavedAddNavigation, showAddForm]);

  useEffect(() => {
    if (!showAddForm || !backHref) {
      return;
    }
    window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    const handlePopState = () => {
      if ((confirmUnsavedAddNavigationRef.current ?? confirmUnsavedAddNavigation)()) {
        router.push(backHref);
        return;
      }
      window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [backHref, confirmUnsavedAddNavigation, router, showAddForm]);

  const handleEditSave = async (workout: Workout) => {
    if (!user || savingKey) {
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
        sets: toSetInputs(draft.sets, profile),
      });
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
      setEditingWorkoutId(null);
    } catch (saveError) {
      console.error("Workout update error", saveError);
      setError("トレーニングの更新に失敗しました。");
    } finally {
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
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
    } catch (deleteError) {
      console.error("Workout delete error", deleteError);
      setError("トレーニングの削除に失敗しました。");
    } finally {
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

  return (
    <div {...swipeHandlers}>
      {showCalendar ? (
        <>
          <div className="relative mb-3 min-h-9">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="前月"
              className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface-soft)]"
            >
              <ChevronLeft size={19} />
            </button>
            <label className="absolute left-1/2 top-0 flex min-h-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-[12px] px-2 text-base font-semibold">
              <span>
                {month.getFullYear()}年{month.getMonth() + 1}月
              </span>
              <input
                type="date"
                value={monthPickerDateKey}
                onChange={(event) => jumpCalendarToDate(event.target.value)}
                aria-label="表示する日付を選択"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button
              type="button"
              onClick={jumpToToday}
              aria-label="今日へ戻る"
              className="absolute left-[calc(50%+3.8rem)] top-0 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-xs font-semibold"
            >
              {todayDay}
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="翌月"
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-[12px] bg-[var(--surface-soft)]"
            >
              <ChevronRight size={19} />
            </button>
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
                  className="grid w-full shrink-0 grid-cols-7 justify-items-center gap-y-1 text-center"
                >
                  {weekdays.map((weekday) => (
                    <div key={weekday} className="py-0.5 text-[11px] font-medium text-[var(--muted)]">
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
                          "relative flex h-9 w-8 flex-col items-center justify-start rounded-[12px] pt-0.5 text-sm font-medium",
                          cell.isCurrentMonth ? "bg-transparent" : "bg-transparent opacity-40",
                          isSelected && !isToday ? "bg-[var(--surface-soft)]" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-[30px] w-[30px] items-center justify-center rounded-full",
                            isToday ? "accent-orb text-white" : "",
                          ].join(" ")}
                        >
                          {cell.day}
                        </span>
                        {summaryBodyParts.length > 0 ? (
                          <span
                            className={[
                              "mt-0.5 flex max-w-8 flex-wrap justify-center gap-0.5",
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
            className="fixed bottom-12 right-10 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] !text-white shadow-[var(--shadow)]"
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {backHref ? (
                showAddForm ? (
                  <button
                    type="button"
                    onClick={handleBackNavigation}
                    aria-label="戻る"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
                  >
                    <ChevronLeft size={22} />
                  </button>
                ) : (
                  <Link
                    href={backHref}
                    aria-label="戻る"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
                  >
                    <ChevronLeft size={22} />
                  </Link>
                )
              ) : null}
              <h1 className="min-w-0 whitespace-nowrap text-base font-semibold leading-tight sm:text-lg">
                {detailsHeading}
              </h1>
            </div>
            <div className="shrink-0 whitespace-nowrap rounded-[12px] bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)]">
              合計 約{totalCalories}kcal
            </div>
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

        {showCalendar ? (
          <Link
            href={`/today/add?date=${effectiveSelectedDate}`}
            aria-label="記録を追加"
            className="fixed bottom-12 right-10 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow)]"
          >
            <Plus size={20} />
          </Link>
        ) : null}

        {!showCalendar && !showAddForm ? (
          <Link
            href={`/today/add?date=${effectiveSelectedDate}`}
            aria-label="記録を追加"
            className="fixed bottom-12 right-10 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow)]"
          >
            <Plus size={22} />
          </Link>
        ) : null}

        {showAddForm ? (
          <WorkoutEntryForm
            bodyParts={bodyParts}
            defaultSetCount={defaultSetCount}
            draft={addDraft}
            exerciseRecords={exerciseRecords}
            exercises={exercises}
            isSaving={savingKey === "add"}
            mode="add"
            onDraftChange={setAddDraft}
            onSave={() => void handleAddSave()}
            previousWorkout={previousWorkout}
            profile={profile}
            selectedBodyPartId={selectedBodyPartId}
            setSelectedBodyPartId={setSelectedBodyPartId}
          />
        ) : null}

        {!showAddForm ? workouts.map((workout) => (
          !showCalendar && editingWorkoutId !== workout.id ? (
            <WorkoutReadOnlyCard
              key={workout.id}
              bodyParts={bodyParts}
              exercises={exercises}
              onEdit={() => setEditingWorkoutId(workout.id)}
              workout={workout}
            />
          ) : (() => {
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
                exerciseRecords={exerciseRecords}
                exercises={exercises}
                isSaving={savingKey === workout.id}
                mode="edit"
                onDelete={() => void handleDelete(workout.id)}
                onDraftChange={(nextDraft) =>
                  setEditDrafts((current) => ({ ...current, [workout.id]: nextDraft }))
                }
                onHeaderClick={() => setEditingWorkoutId(null)}
                onSave={() => void handleEditSave(workout)}
                previousWorkout={editPreviousWorkouts[workout.id] ?? null}
                profile={profile}
              />
            );
          })()
        )) : null}

      </section>
      ) : null}
    </div>
  );
}
