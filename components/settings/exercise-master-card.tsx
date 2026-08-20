"use client";

import { AlertTriangle, ChevronDown, ChevronUp, Save, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import {
  archiveExercise,
  createExercise,
  getBodyParts,
  getExercises,
  reorderExercises,
  updateExercise,
} from "@/lib/workouts/repository";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import type { BodyPart, CardioMetric, Exercise } from "@/lib/workouts/types";

const cardioMetricOptions: Array<{ key: CardioMetric; label: string }> = [
  { key: "distance", label: "距離（km）" },
  { key: "duration", label: "時間（分）" },
  { key: "speed", label: "速さ（km/h）" },
  { key: "calories", label: "カロリー（kcal）" },
];

interface Draft {
  id: string | null;
  bodyPartId: string;
  name: string;
  displayOrder: string;
  rackPosition: string;
  memo: string;
  defaultSetCount: string;
  bodyWeightEnabled: boolean;
  bilateralRepsEnabled: boolean;
  cardioMetrics: CardioMetric[];
}

function createEmptyDraft(bodyPartId = "", displayOrder = 1): Draft {
  return {
    id: null,
    bodyPartId,
    name: "",
    displayOrder: String(displayOrder),
    rackPosition: "",
    memo: "",
    defaultSetCount: "",
    bodyWeightEnabled: false,
    bilateralRepsEnabled: false,
    cardioMetrics: ["distance", "duration", "speed", "calories"],
  };
}

function DraftPanel({
  bodyParts,
  draft,
  isSaving,
  onArchive,
  onClose,
  onDraftChange,
  onSave,
}: {
  bodyParts: BodyPart[];
  draft: Draft;
  isSaving: boolean;
  onArchive: () => void;
  onClose: () => void;
  onDraftChange: (draft: Draft) => void;
  onSave: () => void;
}) {
  const isCardio = bodyParts.find((bodyPart) => bodyPart.id === draft.bodyPartId)?.key === "cardio";
  const toggleCardioMetric = (metric: CardioMetric) => {
    const nextMetrics = draft.cardioMetrics.includes(metric)
      ? draft.cardioMetrics.filter((item) => item !== metric)
      : [...draft.cardioMetrics, metric];
    onDraftChange({ ...draft, cardioMetrics: nextMetrics });
  };

  return (
    <div className="mt-2 rounded-[12px] border border-[var(--accent)] bg-[var(--accent-soft)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold">{draft.id ? "種目を編集" : "種目を追加"}</h4>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface)]"
        >
          <X size={17} />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">種目名</span>
          <input
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">部位</span>
          <select
            value={draft.bodyPartId}
            onChange={(event) => onDraftChange({ ...draft, bodyPartId: event.target.value })}
            className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            {bodyParts.map((bodyPart) => (
              <option key={bodyPart.id} value={bodyPart.id}>
                {bodyPart.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">表示順</span>
            <input
              inputMode="numeric"
              value={draft.displayOrder}
              onChange={(event) => onDraftChange({ ...draft, displayOrder: event.target.value })}
              className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">器具位置</span>
            <input
              value={draft.rackPosition}
              onChange={(event) => onDraftChange({ ...draft, rackPosition: event.target.value })}
              className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
            />
          </label>
        </div>
        {isCardio ? (
          <fieldset className="space-y-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <legend className="px-1 text-sm font-medium text-[var(--muted)]">記録する項目（複数選択可）</legend>
            <div className="grid grid-cols-2 gap-2">
              {cardioMetricOptions.map((option) => (
                <label key={option.key} className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.cardioMetrics.includes(option.key)}
                    onChange={() => toggleCardioMetric(option.key)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">デフォルトセット数</span>
          <select
            value={draft.defaultSetCount}
            onChange={(event) => onDraftChange({ ...draft, defaultSetCount: event.target.value })}
            className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="">プロフィール設定を使用</option>
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>{value}セット</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-h-12 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.bodyWeightEnabled}
              onChange={(event) => onDraftChange({ ...draft, bodyWeightEnabled: event.target.checked })}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            自重入力を表示
          </label>
          <label className="flex min-h-12 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={draft.bilateralRepsEnabled}
              onChange={(event) => onDraftChange({ ...draft, bilateralRepsEnabled: event.target.checked })}
              className="h-5 w-5 accent-[var(--accent)]"
            />
            左右回数を記録
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">メモ</span>
          <textarea
            value={draft.memo}
            onChange={(event) => onDraftChange({ ...draft, memo: event.target.value })}
            rows={3}
            className="w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? "保存中" : "保存"}
          </button>
          <button
            type="button"
            onClick={onArchive}
            disabled={!draft.id || isSaving}
            className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-semibold text-[var(--muted)] disabled:opacity-40"
          >
            <Trash2 size={18} />
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExerciseMasterCard() {
  const { authStatus, profileStatus, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newDraftBodyPartId, setNewDraftBodyPartId] = useState<string | null>(null);
  const [expandedBodyPartIds, setExpandedBodyPartIds] = useState<Set<string>>(() => new Set());
  const [archiveTarget, setArchiveTarget] = useState<Draft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedBodyPartId, setSavedBodyPartId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groupedExercises = useMemo(
    () =>
      bodyParts.map((bodyPart) => ({
        bodyPart,
        exercises: exercises
          .filter((exercise) => exercise.bodyPartId === bodyPart.id)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      })),
    [bodyParts, exercises],
  );

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setError(null);
    try {
      const [nextBodyParts, nextExercises] = await Promise.all([
        getBodyParts(client),
        getExercises(client),
      ]);
      setBodyParts(nextBodyParts);
      setExercises(nextExercises);
    } catch (loadError) {
      console.error("Exercise master load error", loadError);
      setError("種目マスタの読み込みに失敗しました。");
    }
  }, [client, user]);


  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void load();
    }
  }, [authStatus, load, profileStatus]);

  const selectExercise = (exercise: Exercise) => {
    setDraft({
      id: exercise.id,
      bodyPartId: exercise.bodyPartId,
      name: exercise.name,
      displayOrder: String(exercise.displayOrder),
      rackPosition: exercise.rackPosition ?? "",
      memo: exercise.memo ?? "",
      defaultSetCount: exercise.defaultSetCount ? String(exercise.defaultSetCount) : "",
      bodyWeightEnabled: exercise.bodyWeightEnabled,
      bilateralRepsEnabled: exercise.bilateralRepsEnabled,
      cardioMetrics: exercise.cardioMetrics,
    });
    setNewDraftBodyPartId(null);
    setMessage(null);
    setSavedBodyPartId(null);
    setError(null);
  };

  const toggleExpandedBodyPart = (bodyPartId: string) => {
    setExpandedBodyPartIds((current) => {
      const next = new Set(current);
      if (next.has(bodyPartId)) {
        next.delete(bodyPartId);
      } else {
        next.add(bodyPartId);
      }
      return next;
    });
  };

  const startNew = (bodyPartId = bodyParts[0]?.id ?? "") => {
    const nextOrder = exercises.filter((exercise) => exercise.bodyPartId === bodyPartId).length + 1;
    setDraft(createEmptyDraft(bodyPartId, nextOrder));
    setNewDraftBodyPartId(bodyPartId);
    setMessage(null);
    setSavedBodyPartId(null);
    setError(null);
  };

  const save = async () => {
    if (!user || !draft) {
      return;
    }
    if (!draft.name.trim() || !draft.bodyPartId) {
      setError("種目名と部位を入力してください。");
      return;
    }
    const isCardio = bodyParts.find((bodyPart) => bodyPart.id === draft.bodyPartId)?.key === "cardio";
    if (isCardio && draft.cardioMetrics.length === 0) {
      setError("有酸素種目は記録項目を1つ以上選択してください．");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setSavedBodyPartId(null);
    setError(null);
    try {
      const displayOrder = Math.max(1, Math.trunc(Number(draft.displayOrder) || 1));
      const input = {
        userId: user.id,
        bodyPartId: draft.bodyPartId,
        name: draft.name,
        displayOrder,
        rackPosition: draft.rackPosition.trim() || null,
        memo: draft.memo.trim() || null,
        defaultSetCount: draft.defaultSetCount ? Number(draft.defaultSetCount) : null,
        bodyWeightEnabled: draft.bodyWeightEnabled,
        bilateralRepsEnabled: draft.bilateralRepsEnabled,
        cardioMetrics: isCardio ? draft.cardioMetrics : [],
      };
      if (draft.id) {
        await updateExercise(client, draft.id, input);
      } else {
        await createExercise(client, input);
      }
      await load();
      notifyMasterDataChanged();
      setDraft(null);
      setNewDraftBodyPartId(null);
      setArchiveTarget(null);
      setMessage("保存しました。");
    } catch (saveError) {
      console.error("Exercise master save error", saveError);
      setError("種目の保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const archive = async () => {
    if (!archiveTarget?.id) {
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setSavedBodyPartId(null);
    setError(null);
    try {
      await archiveExercise(client, archiveTarget.id);
      await load();
      notifyMasterDataChanged();
      setDraft(null);
      setNewDraftBodyPartId(null);
      setArchiveTarget(null);
      setMessage("種目を非表示にしました。");
    } catch (archiveError) {
      console.error("Exercise archive error", archiveError);
      setError("種目の非表示化に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const requestArchive = () => {
    if (draft?.id) {
      setArchiveTarget(draft);
    }
  };

  const notifyMasterDataChanged = () => {
    window.dispatchEvent(new Event("kochifit:master-data-changed"));
  };

  const persistExerciseOrderIds = async (bodyPartId: string, exerciseIds: string[]) => {
    if (!user) {
      return;
    }
    try {
      await reorderExercises(client, {
        userId: user.id,
        bodyPartId,
        exerciseIds,
      });
      notifyMasterDataChanged();
      setSavedBodyPartId(bodyPartId);
      setMessage(null);
    } catch (reorderError) {
      console.error("Exercise reorder error", reorderError);
      setError("並び順の保存に失敗しました。");
      await load();
    }
  };

  useEffect(() => {
    if (!message && !savedBodyPartId) {
      return;
    }
    const timer = window.setTimeout(() => {
      setMessage(null);
      setSavedBodyPartId(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [message, savedBodyPartId]);

  const moveExerciseByDelta = (exercise: Exercise, delta: -1 | 1) => {
    const currentGroup = exercises
      .filter((item) => item.bodyPartId === exercise.bodyPartId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const sourceIndex = currentGroup.findIndex((item) => item.id === exercise.id);
    const targetIndex = sourceIndex + delta;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= currentGroup.length) {
      return;
    }
    const nextGroup = [...currentGroup];
    [nextGroup[sourceIndex], nextGroup[targetIndex]] = [nextGroup[targetIndex], nextGroup[sourceIndex]];
    const nextExercises = exercises.map((item) => {
      const nextIndex = nextGroup.findIndex((groupItem) => groupItem.id === item.id);
      return nextIndex >= 0 ? { ...item, displayOrder: nextIndex + 1 } : item;
    });
    setExercises(nextExercises);
    void persistExerciseOrderIds(exercise.bodyPartId, nextGroup.map((item) => item.id));
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--muted)]">上下ボタンで並べ替えます。</p>

      <div className="space-y-4">
        {groupedExercises.map(({ bodyPart, exercises: bodyPartExercises }) => {
          const headerColor = getBodyPartColor(bodyPart.key, bodyPart.colorKey);
          const isExpanded = expandedBodyPartIds.has(bodyPart.id);
          const visibleExercises = isExpanded ? bodyPartExercises : bodyPartExercises.slice(0, 3);
          return (
            <section key={bodyPart.id} className="overflow-hidden rounded-[12px] bg-[var(--surface)] shadow-[var(--shadow)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-3 py-2.5">
                <h3 className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold">
                  <span
                    aria-hidden="true"
                    className="color-orb h-3 w-3 shrink-0 rounded-full"
                    style={{ "--color-orb": headerColor } as CSSProperties}
                  />
                  <span className="min-w-0 truncate">{bodyPart.displayName}</span>
                  {savedBodyPartId === bodyPart.id ? (
                    <span className="shrink-0 text-xs font-medium text-teal-500">保存しました。</span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  onClick={() => startNew(bodyPart.id)}
                  className="rounded-[12px] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]"
                >
                  追加
                </button>
              </div>
              <div className="space-y-2 p-2">
                {draft && !draft.id && newDraftBodyPartId === bodyPart.id ? (
                  <DraftPanel
                    bodyParts={bodyParts}
                    draft={draft}
                    isSaving={isSaving}
                    onArchive={requestArchive}
                    onClose={() => {
                      setDraft(null);
                      setNewDraftBodyPartId(null);
                    }}
                    onDraftChange={setDraft}
                    onSave={() => void save()}
                  />
                ) : null}
                <div className="grid gap-2">
                  {visibleExercises.map((exercise, index) => (
                    <div key={exercise.id}>
                      <div
                        className="flex w-full min-w-0 items-center gap-2 rounded-[14px] bg-[var(--surface-soft)] px-3 py-2 transition-colors duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => selectExercise(exercise)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{exercise.name}</span>
                            {exercise.rackPosition || exercise.memo ? (
                              <span className="block truncate text-sm text-[var(--muted)]">
                                {exercise.rackPosition ? "器具位置：" + exercise.rackPosition : ""}
                                {exercise.rackPosition && exercise.memo ? " / " : ""}
                                {exercise.memo ? "メモ：" + exercise.memo : ""}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveExerciseByDelta(exercise, -1)}
                            disabled={index === 0}
                            aria-label={`${exercise.name}を上へ移動`}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-30"
                          >
                            <ChevronUp size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveExerciseByDelta(exercise, 1)}
                            disabled={index === visibleExercises.length - 1}
                            aria-label={`${exercise.name}を下へ移動`}
                            className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-30"
                          >
                            <ChevronDown size={20} />
                          </button>
                        </div>
                      </div>
                      {draft?.id === exercise.id ? (
                        <DraftPanel
                          bodyParts={bodyParts}
                          draft={draft}
                          isSaving={isSaving}
                          onArchive={requestArchive}
                          onClose={() => setDraft(null)}
                          onDraftChange={setDraft}
                          onSave={() => void save()}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
                {bodyPartExercises.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpandedBodyPart(bodyPart.id)}
                    className="mt-2 flex min-h-10 w-full items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-sm font-semibold text-[var(--muted)]"
                  >
                    {isExpanded ? "閉じる" : "すべて表示（" + bodyPartExercises.length + "件）"}
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {message ? <p className="text-sm font-medium text-teal-500">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
      {archiveTarget ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/45 px-3 pb-3"
          onClick={() => setArchiveTarget(null)}
        >
          <section
            className="safe-bottom w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-100 text-amber-800">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold">種目を削除しますか？</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {archiveTarget.name} を種目マスタから非表示にします。過去のトレーニング記録は残ります。
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                disabled={isSaving}
                className="min-h-12 rounded-[12px] border border-[var(--border)] px-4 font-semibold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void archive()}
                disabled={isSaving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--warning)] px-4 font-semibold text-white disabled:opacity-50"
              >
                <Trash2 size={18} />
                {isSaving ? "削除中" : "削除"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
