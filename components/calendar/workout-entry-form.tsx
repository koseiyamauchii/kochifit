"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { defaultCardioUnits, getCardioUnitLabels } from "@/lib/workouts/cardio-units";
import type {
  BodyPart,
  CardioUnitSettings,
  Exercise,
  ExerciseRecord,
  Workout,
  WorkoutExercise,
} from "@/lib/workouts/types";
import { Check, Copy, History, PersonStanding, Plus, Settings2, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SetAnnotations, WorkoutCardHeader, WorkoutMemoSummary } from "./workout-card-parts";

import {
  bodyWeightInputLabel,
  clampDefaultSetCount,
  createInitialSetDraft,
  createSetDraftFromWorkoutSet,
  createSetDrafts,
  EntryDraft,
  estimateDraftCalories,
  findExercise,
  formatCardioStoredValue,
  formatRm,
  formatRmValue,
  formatSetLine,
  formatWeightInput,
  formatWeightNumber,
  getCurrentTimestamp,
  hasAnySetInput,
  SetDraft,
  sortExercisesByMasterOrder,
  toNumberOrNull,
  toWeightNumberOrNull,
} from "@/lib/workouts/entry-draft";
export function PreviousWorkoutBlock({
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
                  <div className="flex items-center justify-between gap-2">
                  <span>
                    {isCardio
                      ? `${formatCardioStoredValue("distance", set.distanceKm, cardioUnits)}${cardioUnitLabels.distance} / ${formatCardioStoredValue("duration", set.durationSec, cardioUnits)}${cardioUnitLabels.duration} / ${formatCardioStoredValue("speed", set.speedKmh, cardioUnits)}${cardioUnitLabels.speed}`
                      : bilateralRepsEnabled
                        ? `${formatWeightNumber(set.weightKg)}kg / 左${set.leftReps ?? set.reps ?? "-"}回 / 右${set.rightReps ?? set.reps ?? "-"}回`
                        : formatSetLine(set.weightKg, set.reps)}
                  </span>
                  {!isCardio && set.isAssisted ? <span className="shrink-0">補助あり</span> : null}
                  </div>
                  {set.note ? <span className="block whitespace-pre-wrap break-words">{set.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
          {previousWorkout.note ? (
            <p className="whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{previousWorkout.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">この種目の前回記録はまだありません。</p>
      )}
    </div>
  );
}

export function WorkoutReadOnlyCard({
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
  sessionNumber?: number;
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
      <WorkoutCardHeader title={showDate ? workout.workoutDate.replaceAll("-", "/") : exercise.exerciseName} sessionNumber={sessionNumber}>
          <span>
            {exercise.sets.length}セット
          </span>
      </WorkoutCardHeader>
      <WorkoutMemoSummary note={exercise.note} masterMemo={masterExercise?.memo} />
      {showDate && exercise.condition ? <p className="whitespace-pre-wrap break-words border-b border-[var(--hairline)] px-3 py-2 text-xs text-[var(--muted)]">体調・コンディション：{exercise.condition}</p> : null}
      <div className={[isCardio ? "grid-cols-[2.4rem_1fr_1fr_1fr]" : "grid-cols-[2.4rem_0.9fr_1.3fr_0.9fr_2.5rem]", "grid gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)]"].join(" ")}>
        <span>セット</span>
        <span>{isCardio ? "距離" : "重量"}</span>
        <span>{isCardio ? "時間" : "回数"}</span>
        <span>{isCardio ? "速さ" : "RM"}</span>
        {!isCardio ? <span className="text-center">補助</span> : null}
      </div>
      <div className="divide-y divide-[var(--hairline)] px-3">
        {exercise.sets.map((set, index) => (
          <div key={set.id} className="py-1.5">
            <div className={[isCardio ? "grid-cols-[2.4rem_1fr_1fr_1fr]" : "grid-cols-[2.4rem_0.9fr_1.3fr_0.9fr_2.5rem]", "grid min-h-7 items-center gap-1.5 text-xs"].join(" ")}>
              <span className="font-semibold text-[var(--muted)]">{set.isWarmup ? "W" : index + 1}</span>
              <span className="font-medium">{isCardio ? `${formatCardioStoredValue("distance", set.distanceKm, cardioUnits)}${cardioUnitLabels.distance}` : `${formatWeightNumber(set.weightKg)}kg`}</span>
              <span className="font-medium">{isCardio ? `${formatCardioStoredValue("duration", set.durationSec, cardioUnits)}${cardioUnitLabels.duration}` : masterExercise?.bilateralRepsEnabled ? `左${set.leftReps ?? set.reps ?? "-"}/右${set.rightReps ?? set.reps ?? "-"}` : `${set.reps ?? "-"}回`}</span>
              <span className="font-semibold text-[var(--muted)]">{isCardio ? `${formatCardioStoredValue("speed", set.speedKmh, cardioUnits)}${cardioUnitLabels.speed}` : formatRm(set.weightKg, set.reps ?? (Math.max(set.leftReps ?? 0, set.rightReps ?? 0) || null))}</span>
              {!isCardio ? <span aria-label={set.isAssisted ? "補助あり" : "補助なし"} className="text-center text-[var(--muted)]">{set.isAssisted ? "あり" : "なし"}</span> : null}
            </div>
            {isCardio && set.caloriesKcal !== null ? <p className="mt-1 text-xs text-[var(--muted)]">カロリー：{formatCardioStoredValue("calories", set.caloriesKcal, cardioUnits)}{cardioUnitLabels.calories}</p> : null}
            <SetAnnotations note={set.note} isAssisted={set.isAssisted} isCardio={isCardio} showAssistance={false} />
          </div>
        ))}
      </div>
      {!isCardio && maxWeightKg !== null ? <div className="border-t border-[var(--hairline)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">最高重量：{Number(maxWeightKg.toFixed(1))}kg</div> : null}
    </button>
  );
}

export function WorkoutEntryForm({
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
        <WorkoutCardHeader title={recordDate ? recordDate.replaceAll("-", "/") : headerTitle} sessionNumber={mode === "edit" ? sessionNumber : undefined} onClose={onHeaderClick}>
          <span>{mode === "edit" ? `${draft.sets.length}セット` : `約${estimatedCalories}kcal`}</span>
        </WorkoutCardHeader>
      )}
      <div className="space-y-2.5 p-2.5">
      {draftNotice}
      {recordDate && draft.condition ? <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm">体調・コンディション：{draft.condition}</p> : null}

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
                ? "grid-cols-[minmax(0,1fr)_minmax(3.25rem,1fr)_minmax(3.25rem,1fr)_minmax(0,0.85fr)_2rem]"
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
                    aria-label={`セット${index + 1}の重量`}
                    value={set.weightKg}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => updateSet(index, { weightKg: event.target.value })}
                    onBlur={(event) => updateSet(index, { weightKg: formatWeightInput(event.target.value) })}
                    className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-1.5 pr-6 text-sm"
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
                          aria-label={`セット${index + 1}の${key === "leftReps" ? "左" : "右"}回数`}
                          className="min-h-10 w-full min-w-0 rounded-[12px] bg-[var(--surface)] px-1.5 pr-5 text-sm"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-xs text-[var(--muted)]">回</span>
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
                    aria-label={`セット${index + 1}の回数`}
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
                    className="assistance-checkbox h-5 w-5"
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
