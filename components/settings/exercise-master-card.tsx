"use client";

import { AlertTriangle, Menu, Save, Trash2, X } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { BodyPart, Exercise } from "@/lib/workouts/types";

interface Draft {
  id: string | null;
  bodyPartId: string;
  name: string;
  displayOrder: string;
  rackPosition: string;
  memo: string;
}

function createEmptyDraft(bodyPartId = "", displayOrder = 1): Draft {
  return {
    id: null,
    bodyPartId,
    name: "",
    displayOrder: String(displayOrder),
    rackPosition: "",
    memo: "",
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
            <span className="text-sm font-medium text-[var(--muted)]">ラック位置</span>
            <input
              value={draft.rackPosition}
              onChange={(event) => onDraftChange({ ...draft, rackPosition: event.target.value })}
              className="min-h-12 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3"
            />
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
  const [draggingExerciseId, setDraggingExerciseId] = useState<string | null>(null);
  const [touchDraggingExerciseId, setTouchDraggingExerciseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const touchDragExerciseIdRef = useRef<string | null>(null);
  const touchDragTimerRef = useRef<number | null>(null);
  const pendingExerciseOrderRef = useRef<{ bodyPartId: string; exerciseIds: string[] } | null>(null);

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
    });
    setNewDraftBodyPartId(null);
    setMessage(null);
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
    setIsSaving(true);
    setMessage(null);
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
      };
      if (draft.id) {
        await updateExercise(client, draft.id, input);
      } else {
        await createExercise(client, input);
      }
      await load();
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
    setError(null);
    try {
      await archiveExercise(client, archiveTarget.id);
      await load();
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
      setMessage("並び順を保存しました。");
    } catch (reorderError) {
      console.error("Exercise reorder error", reorderError);
      setError("並び順の保存に失敗しました。");
      await load();
    }
  };

  const moveExerciseById = (sourceExerciseId: string, targetExerciseId: string, placeAfter = false) => {
    if (sourceExerciseId === targetExerciseId) {
      return;
    }
    let nextOrder: { bodyPartId: string; exerciseIds: string[] } | null = null;

    setExercises((current) => {
      const sourceExercise = current.find((exercise) => exercise.id === sourceExerciseId);
      const targetExercise = current.find((exercise) => exercise.id === targetExerciseId);
      if (!sourceExercise || !targetExercise || sourceExercise.bodyPartId !== targetExercise.bodyPartId) {
        return current;
      }

      const currentGroup = current
        .filter((exercise) => exercise.bodyPartId === targetExercise.bodyPartId)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      const sourceIndex = currentGroup.findIndex((exercise) => exercise.id === sourceExerciseId);
      if (sourceIndex < 0) {
        return current;
      }

      const nextGroup = [...currentGroup];
      const [moved] = nextGroup.splice(sourceIndex, 1);
      const targetIndex = nextGroup.findIndex((exercise) => exercise.id === targetExerciseId);
      if (targetIndex < 0) {
        return current;
      }
      const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
      nextGroup.splice(insertIndex, 0, moved);
      nextOrder = {
        bodyPartId: targetExercise.bodyPartId,
        exerciseIds: nextGroup.map((exercise) => exercise.id),
      };
      return current.map((exercise) => {
        const nextIndex = nextGroup.findIndex((item) => item.id === exercise.id);
        return nextIndex >= 0 ? { ...exercise, displayOrder: nextIndex + 1 } : exercise;
      });
    });

    if (nextOrder) {
      pendingExerciseOrderRef.current = nextOrder;
    }
  };

  const moveExercise = async (targetExercise: Exercise) => {
    if (!user || !draggingExerciseId || draggingExerciseId === targetExercise.id) {
      setDraggingExerciseId(null);
      return;
    }
    moveExerciseById(draggingExerciseId, targetExercise.id);
    const pendingOrder = pendingExerciseOrderRef.current;
    pendingExerciseOrderRef.current = null;
    if (pendingOrder) {
      await persistExerciseOrderIds(pendingOrder.bodyPartId, pendingOrder.exerciseIds);
    }
    setDraggingExerciseId(null);
  };

  const clearTouchDrag = () => {
    if (touchDragTimerRef.current !== null) {
      window.clearTimeout(touchDragTimerRef.current);
      touchDragTimerRef.current = null;
    }
    touchDragExerciseIdRef.current = null;
    setTouchDraggingExerciseId(null);
  };

  const startTouchDrag = (exerciseId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }
    if (touchDragTimerRef.current !== null) {
      window.clearTimeout(touchDragTimerRef.current);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pendingExerciseOrderRef.current = null;
    touchDragTimerRef.current = window.setTimeout(() => {
      touchDragExerciseIdRef.current = exerciseId;
      setTouchDraggingExerciseId(exerciseId);
    }, 180);
  };

  const moveTouchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sourceExerciseId = touchDragExerciseIdRef.current;
    if (!sourceExerciseId) {
      return;
    }
    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-exercise-id]");
    const targetExerciseId = target?.dataset.exerciseId;
    if (targetExerciseId && targetExerciseId !== sourceExerciseId) {
      const rect = target.getBoundingClientRect();
      moveExerciseById(sourceExerciseId, targetExerciseId, event.clientY > rect.top + rect.height / 2);
    }
  };

  const finishTouchDrag = () => {
    const pendingOrder = pendingExerciseOrderRef.current;
    clearTouchDrag();
    pendingExerciseOrderRef.current = null;
    if (pendingOrder) {
      void persistExerciseOrderIds(pendingOrder.bodyPartId, pendingOrder.exerciseIds);
    }
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--muted)]">三本線を長押しして並べ替えます。</p>

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
                  {visibleExercises.map((exercise) => (
                    <div
                      key={exercise.id}
                      data-exercise-id={exercise.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void moveExercise(exercise)}
                    >
                      <div
                        className={[
                          "flex w-full min-w-0 items-center gap-2 rounded-[14px] bg-[var(--surface-soft)] px-3 py-2 transition-[transform,opacity,background-color] duration-150",
                          touchDraggingExerciseId === exercise.id ? "scale-[0.985] bg-[var(--accent-soft)] opacity-70" : "",
                        ].join(" ")}
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
                                {exercise.rackPosition ? "ラック：" + exercise.rackPosition : ""}
                                {exercise.rackPosition && exercise.memo ? " / " : ""}
                                {exercise.memo ? "メモ：" + exercise.memo : ""}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDraggingExerciseId(exercise.id)}
                          onPointerDown={(event) => startTouchDrag(exercise.id, event)}
                          onPointerMove={moveTouchDrag}
                          onPointerUp={finishTouchDrag}
                          onPointerCancel={clearTouchDrag}
                          aria-label={exercise.name + "を並べ替え"}
                          className="flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] active:bg-[var(--accent-soft)] active:text-[var(--accent-strong)]"
                        >
                          <Menu size={20} />
                        </button>
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

      {message ? <p className="mt-3 text-sm text-emerald-500">{message}</p> : null}
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
