"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Copy, History, Plus, Save, Scale, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  return { weightKg: "", reps: "", isWarmup: false };
}

function createSetDrafts(count: number) {
  return Array.from({ length: count }, () => createInitialSetDraft());
}

function isBlankSetDraft(set: SetDraft) {
  return set.weightKg === "" && set.reps === "" && !set.isWarmup;
}

function clampDefaultSetCount(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 5;
  }
  return Math.min(10, Math.max(1, Math.trunc(value)));
}

function formatSetLine(weightKg: number | null, reps: number | null) {
  return `${weightKg ?? "-"}kg x ${reps ?? "-"}`;
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
  }));
}

function createDraftFromWorkout(exercise: WorkoutExercise): EntryDraft {
  return {
    exerciseId: exercise.exerciseId,
    note: exercise.note ?? "",
    sets: exercise.sets.map((set) => ({
      weightKg: set.weightKg !== null ? String(set.weightKg) : "",
      reps: set.reps !== null ? String(set.reps) : "",
      isWarmup: set.isWarmup,
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

function hasAnySetInput(draft: EntryDraft, profile: ReturnType<typeof useAuth>["profile"]) {
  return toSetInputs(draft.sets, profile).some((set) => set.weightKg !== null || set.reps !== null);
}

function PreviousWorkoutBlock({
  previousWorkout,
  onCopyAll,
}: {
  previousWorkout: WorkoutExercise | null;
  onCopyAll: () => void;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="font-semibold">前回の記録</h4>
        <button
          type="button"
          onClick={onCopyAll}
          disabled={!previousWorkout}
          className="flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-medium text-white disabled:opacity-40"
        >
          <Copy size={15} />
          まとめてコピー
        </button>
      </div>
      {previousWorkout ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 text-xs text-[var(--muted)]">
            {previousWorkout.sets.map((set) => (
              <span key={set.id} className="rounded-[8px] border border-[var(--border)] px-2 py-1">
                {set.isWarmup ? "W " : ""}
                {formatSetLine(set.weightKg, set.reps)}
              </span>
            ))}
          </div>
          {previousWorkout.note ? (
            <p className="text-sm text-[var(--muted)]">前回メモ：{previousWorkout.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">この種目の前回記録はまだありません．</p>
      )}
    </div>
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
  onSave: () => void;
  previousWorkout?: WorkoutExercise | null;
  profile: ReturnType<typeof useAuth>["profile"];
  selectedBodyPartId?: string;
  setSelectedBodyPartId?: (bodyPartId: string) => void;
}) {
  const selectedExercise = findExercise(exercises, draft.exerciseId);
  const filteredExercises =
    mode === "add" && selectedBodyPartId && selectedBodyPartId !== "all"
      ? exercises.filter((exercise) => exercise.bodyPartId === selectedBodyPartId)
      : exercises;
  const estimatedCalories = estimateDraftCalories(draft, exercises, profile);
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
      weightKg: source.weightKg !== null ? String(source.weightKg) : "",
      reps: source.reps !== null ? String(source.reps) : "",
      isWarmup: source.isWarmup,
    });
  };

  const copyPreviousHistory = () => {
    if (!previousWorkout) {
      return;
    }
    const copied = previousWorkout.sets.map((set) => ({
      weightKg: set.weightKg !== null ? String(set.weightKg) : "",
      reps: set.reps !== null ? String(set.reps) : "",
      isWarmup: set.isWarmup,
    }));
    while (copied.length < defaultSetCount) {
      copied.push(createInitialSetDraft());
    }
    onDraftChange({ ...draft, sets: copied, note: previousWorkout.note ?? "" });
  };

  return (
    <section className="space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">
          {mode === "add" ? "記録を追加" : selectedExercise?.name ?? "記録"}
        </h3>
        <div className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-strong)]">
          約{estimatedCalories}kcal
        </div>
      </div>

      {mode === "add" && selectedBodyPartId && setSelectedBodyPartId ? (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              onClick={() => setSelectedBodyPartId("all")}
              aria-pressed={selectedBodyPartId === "all"}
              className={[
                "min-h-10 rounded-[8px] border px-3 text-sm font-medium",
                selectedBodyPartId === "all"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
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
                  "min-h-10 rounded-[8px] border px-3 text-sm font-medium",
                  selectedBodyPartId === bodyPart.id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
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
            className="min-h-12 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            {filteredExercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {selectedExercise?.rackPosition || selectedExercise?.memo ? (
        <div className="space-y-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
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

      {mode === "add" ? (
        <PreviousWorkoutBlock previousWorkout={previousWorkout ?? null} onCopyAll={copyPreviousHistory} />
      ) : null}

      <div className="space-y-2">
        {draft.sets.map((set, index) => (
          <div
            key={index}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="rounded-[8px] bg-[var(--surface-soft)] px-2.5 py-1 text-sm font-semibold">
                セット {index + 1}
              </span>
              {index === firstHighestWeightSetIndex ? (
                <span className="flex min-h-8 items-center gap-1 rounded-[8px] border border-amber-400 bg-[#fff2b8] px-2.5 text-xs font-semibold text-amber-900 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)]">
                  <Trophy size={14} />
                  最高重量
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="block space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">重量 kg</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => applyBodyWeight(index)}
                      disabled={typeof profile?.body_weight_kg !== "number"}
                      aria-label="自重を入力"
                      title="自重を入力"
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--muted)] disabled:opacity-35"
                    >
                      <Scale size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyPreviousSetWeight(index)}
                      disabled={index === 0}
                      aria-label="前セットの重量をコピー"
                      title="前セットの重量をコピー"
                      className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--muted)] disabled:opacity-35"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <input
                  inputMode="decimal"
                  value={set.weightKg}
                  onChange={(event) => updateSet(index, { weightKg: event.target.value })}
                  className="min-h-12 min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3"
                />
              </div>
              <div className="block space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--muted)]">
                  <span className="min-w-0 flex-1">回数</span>
                  <button
                    type="button"
                    onClick={() => copyPreviousSetReps(index)}
                    disabled={index === 0}
                    aria-label="前セットの回数をコピー"
                    title="前セットの回数をコピー"
                    className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--muted)] disabled:opacity-35"
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <input
                  inputMode="numeric"
                  value={set.reps}
                  onChange={(event) => updateSet(index, { reps: event.target.value })}
                  className="min-h-12 min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3"
                />
              </div>
              <div className="col-span-2 block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">推定1RM</span>
                <div className="flex min-h-12 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm font-semibold">
                  {formatRm(toWeightNumberOrNull(set.weightKg, profile), toNumberOrNull(set.reps))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => copyPreviousSet(index)}
                disabled={index === 0}
                aria-label="前セットからコピー"
                title="前セットからコピー"
                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] disabled:opacity-40"
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
                  className="flex h-11 flex-1 items-center justify-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] disabled:opacity-40"
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
                className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] disabled:opacity-40"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSet}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-sm font-medium"
        >
          <Plus size={17} />
          セット追加
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-[var(--muted)]">メモ</span>
        <textarea
          value={draft.note}
          onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
          rows={3}
          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? "保存中" : mode === "add" ? "追加" : "更新"}
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--border)] px-4 py-3 font-semibold text-[var(--muted)] disabled:opacity-40"
          >
            <Trash2 size={18} />
            削除
          </button>
        ) : null}
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
}: WorkoutCalendarProps) {
  const { user, authStatus, profile, profileStatus } = useAuth();
  const todayKey = toDateKey(new Date());
  const defaultSetCount = clampDefaultSetCount(profile?.default_set_count);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => selectedDateOverride ?? todayKey);
  const effectiveSelectedDate = selectedDateOverride ?? selectedDate;
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [previousWorkout, setPreviousWorkout] = useState<WorkoutExercise | null>(null);
  const [selectedBodyPartId, setSelectedBodyPartId] = useState<string>("all");
  const [addDraft, setAddDraft] = useState<EntryDraft>(() => ({
    exerciseId: "",
    note: "",
    sets: createSetDrafts(5),
  }));
  const [editDrafts, setEditDrafts] = useState<Record<string, EntryDraft>>({});
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const cells = useMemo(() => getCalendarCells(month), [month]);
  const summariesByDate = useMemo(
    () => new Map(summaries.map((summary) => [summary.workoutDate, summary])),
    [summaries],
  );
  const totalCalories = useMemo(() => {
    const addCalories = isAddFormOpen ? estimateDraftCalories(addDraft, exercises, profile) : 0;
    const savedCalories = Object.values(editDrafts).reduce(
      (total, draft) => total + estimateDraftCalories(draft, exercises, profile),
      0,
    );
    return addCalories + savedCalories;
  }, [addDraft, editDrafts, exercises, isAddFormOpen, profile]);

  const loadMonth = useCallback(async () => {
    if (!user) {
      return;
    }
    const range = getMonthRange(month);
    setSummaries(await getWorkoutSummaries(client, range.start, range.end));
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
      setAddDraft((current) => ({
        ...current,
        exerciseId: current.exerciseId || nextExercises[0]?.id || "",
      }));
    } catch (loadError) {
      console.error("Workout data load error", loadError);
      setError("トレーニングデータの読み込みに失敗しました．");
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
        setError("カレンダーの読み込みに失敗しました．");
      });
    }
  }, [authStatus, loadMonth, profileStatus]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadSelectedDate().catch((loadError) => {
        console.error("Workout detail load error", loadError);
        setError("選択日の記録読み込みに失敗しました．");
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
    if (!filteredExercises.some((exercise) => exercise.id === addDraft.exerciseId)) {
      setAddDraft((current) => ({
        ...current,
        exerciseId: filteredExercises[0]?.id ?? "",
      }));
    }
  }, [addDraft.exerciseId, exercises, selectedBodyPartId]);

  const moveMonth = (delta: number) => setMonth((current) => addMonths(current, delta));
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (!showWorkoutDetails) {
      router.push(`/today?date=${dateKey}`);
    }
  };

  const handleAddSave = async () => {
    if (!user || !addDraft.exerciseId || savingKey) {
      return;
    }
    if (!hasAnySetInput(addDraft, profile)) {
      setIsAddFormOpen(false);
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
      setIsAddFormOpen(false);
    } catch (saveError) {
      console.error("Workout save error", saveError);
      setError("トレーニングの保存に失敗しました．入力値を確認してください．");
    } finally {
      setSavingKey(null);
    }
  };

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
      setError("重量または回数を入力してください．");
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
    } catch (saveError) {
      console.error("Workout update error", saveError);
      setError("トレーニングの更新に失敗しました．");
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
      setError("トレーニングの削除に失敗しました．");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div
      onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchStartX === null || !showCalendar) {
          return;
        }
        const endX = event.changedTouches[0]?.clientX ?? touchStartX;
        const delta = endX - touchStartX;
        if (Math.abs(delta) > 50) {
          moveMonth(delta > 0 ? -1 : 1);
        }
        setTouchStartX(null);
      }}
    >
      {showCalendar ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="前月"
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)]"
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="text-xl font-semibold">
              {month.getFullYear()}年{month.getMonth() + 1}月
            </h2>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="翌月"
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)]"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="grid grid-cols-7 justify-items-center gap-y-1 text-center">
            {weekdays.map((weekday) => (
              <div key={weekday} className="py-1 text-xs font-medium text-[var(--muted)]">
                {weekday}
              </div>
            ))}
            {cells.map((day, index) => {
              const dateKey = day
                ? toDateKey(new Date(month.getFullYear(), month.getMonth(), day))
                : null;
              const summary = dateKey ? summariesByDate.get(dateKey) : null;
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === effectiveSelectedDate;
              const summaryBodyParts = summary?.bodyParts.slice(0, 7) ?? [];
              return (
                <button
                  key={`${day ?? "blank"}-${index}`}
                  type="button"
                  disabled={!dateKey}
                  onClick={() => {
                    if (dateKey) {
                      handleDateClick(dateKey);
                    }
                  }}
                  className={[
                    "relative flex h-10 w-8 flex-col items-center justify-start rounded-[8px] pt-0.5 text-base font-medium",
                    dateKey ? "bg-transparent" : "invisible",
                    isSelected && !isToday ? "bg-[var(--surface-soft)]" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      isToday ? "accent-orb text-white" : "",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                  {summaryBodyParts.length > 0 ? (
                    <span className="mt-0.5 flex max-w-8 flex-wrap justify-center gap-0.5">
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

          <div className="mt-4">
            <Link
              href="/today"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 font-semibold !text-white"
            >
              <Plus size={18} />
              今日のトレーニングを追加
            </Link>
          </div>
        </>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[8px] border border-[var(--warning)] px-3 py-2 text-sm text-[var(--warning)]">
          {error}
        </div>
      ) : null}

      {showWorkoutDetails ? (
      <section className={[!showCalendar && detailsHeading ? "mt-0" : "mt-5", "space-y-3"].join(" ")}>
        {!showCalendar && detailsHeading ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {backHref ? (
                <Link
                  href={backHref}
                  aria-label="戻る"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)]"
                >
                  <ArrowLeft size={19} />
                </Link>
              ) : null}
              <h1 className="min-w-0 whitespace-nowrap text-xl font-semibold leading-tight">
                {detailsHeading}
              </h1>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddFormOpen(true)}
                aria-label="記録を追加"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow)]"
              >
                <Plus size={22} />
              </button>
              <div className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-strong)]">
                日合計 約{totalCalories}kcal
              </div>
            </div>
          </div>
        ) : (
        <div className="flex items-start justify-end gap-3">
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddFormOpen(true)}
              aria-label="記録を追加"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow)]"
            >
              <Plus size={22} />
            </button>
            <div className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent-strong)]">
              日合計 約{totalCalories}kcal
            </div>
          </div>
          {isLoading ? <span className="text-sm text-[var(--muted)]">読込中</span> : null}
        </div>
        )}

        {workouts.map((workout) => {
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
              onSave={() => void handleEditSave(workout)}
              profile={profile}
            />
          );
        })}

        {isAddFormOpen ? (
          <div
            className="fixed inset-0 z-30 flex items-end bg-black/45 px-3 pb-3"
            onClick={() => setIsAddFormOpen(false)}
          >
            <section
              className="safe-bottom max-h-[88dvh] w-full overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsAddFormOpen(false)}
                className="mb-3 flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 text-sm font-semibold"
              >
                <ArrowLeft size={17} />
                戻る
              </button>
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
            </section>
          </div>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}
