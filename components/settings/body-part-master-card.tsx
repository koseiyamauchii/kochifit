"use client";

import { Check, Menu } from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { bodyPartColorOptions, getBodyPartColorByColorKey } from "@/lib/workouts/body-part-colors";
import { getBodyParts, reorderBodyParts } from "@/lib/workouts/repository";
import type { BodyPart } from "@/lib/workouts/types";

export function BodyPartMasterCard() {
  const { authStatus, profileStatus, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [activeColorBodyPartId, setActiveColorBodyPartId] = useState<string | null>(null);
  const [draggingBodyPartId, setDraggingBodyPartId] = useState<string | null>(null);
  const [touchDraggingBodyPartId, setTouchDraggingBodyPartId] = useState<string | null>(null);
  const [, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touchDragBodyPartIdRef = useRef<string | null>(null);
  const touchDragTimerRef = useRef<number | null>(null);
  const pendingBodyPartsRef = useRef<BodyPart[] | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setError(null);
    try {
      setBodyParts(await getBodyParts(client));
    } catch (loadError) {
      console.error("Body part master load error", loadError);
      setError("部位マスタの読み込みに失敗しました。");
    }
  }, [client, user]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void load();
    }
  }, [authStatus, load, profileStatus]);

  const persistBodyParts = useCallback(
    async (nextBodyParts: BodyPart[]) => {
      if (!user) {
        return;
      }
      setIsSaving(true);
      setError(null);
      try {
        await reorderBodyParts(client, {
          userId: user.id,
          bodyParts: nextBodyParts.map((bodyPart) => ({
            id: bodyPart.id,
            colorKey: bodyPart.colorKey,
          })),
        });
      } catch (saveError) {
        console.error("Body part preference save error", saveError);
        setError("部位設定の保存に失敗しました。");
        await load();
      } finally {
        setIsSaving(false);
      }
    },
    [client, load, user],
  );

  const moveBodyPartById = (sourceBodyPartId: string, targetBodyPartId: string, placeAfter = false) => {
    if (sourceBodyPartId === targetBodyPartId) {
      return;
    }
    const sourceIndex = bodyParts.findIndex((bodyPart) => bodyPart.id === sourceBodyPartId);
    if (sourceIndex < 0) {
      return;
    }
    const next = [...bodyParts];
    const [moved] = next.splice(sourceIndex, 1);
    const targetIndex = next.findIndex((bodyPart) => bodyPart.id === targetBodyPartId);
    if (targetIndex < 0) {
      return;
    }
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    next.splice(insertIndex, 0, moved);
    const nextBodyParts = next.map((bodyPart, index) => ({ ...bodyPart, displayOrder: index + 1 }));
    setBodyParts(nextBodyParts);
    pendingBodyPartsRef.current = nextBodyParts;
  };

  const moveBodyPart = async (targetBodyPart: BodyPart) => {
    if (!draggingBodyPartId || draggingBodyPartId === targetBodyPart.id) {
      setDraggingBodyPartId(null);
      return;
    }

    moveBodyPartById(draggingBodyPartId, targetBodyPart.id);
    const pendingBodyParts = pendingBodyPartsRef.current;
    pendingBodyPartsRef.current = null;
    if (pendingBodyParts) {
      await persistBodyParts(pendingBodyParts);
    }
    setDraggingBodyPartId(null);
  };

  const updateBodyPartColor = (bodyPartId: string, colorKey: string) => {
    const nextBodyParts = bodyParts.map((item) => (item.id === bodyPartId ? { ...item, colorKey } : item));
    setBodyParts(nextBodyParts);
    void persistBodyParts(nextBodyParts);
  };

  const clearTouchDrag = () => {
    if (touchDragTimerRef.current !== null) {
      window.clearTimeout(touchDragTimerRef.current);
      touchDragTimerRef.current = null;
    }
    touchDragBodyPartIdRef.current = null;
    setTouchDraggingBodyPartId(null);
  };

  const startTouchDrag = (bodyPartId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") {
      return;
    }
    if (touchDragTimerRef.current !== null) {
      window.clearTimeout(touchDragTimerRef.current);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    pendingBodyPartsRef.current = null;
    touchDragTimerRef.current = window.setTimeout(() => {
      touchDragBodyPartIdRef.current = bodyPartId;
      setTouchDraggingBodyPartId(bodyPartId);
    }, 180);
  };

  const moveTouchDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const sourceBodyPartId = touchDragBodyPartIdRef.current;
    if (!sourceBodyPartId) {
      return;
    }
    event.preventDefault();
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-body-part-id]");
    const targetBodyPartId = target?.dataset.bodyPartId;
    if (targetBodyPartId && targetBodyPartId !== sourceBodyPartId) {
      const rect = target.getBoundingClientRect();
      moveBodyPartById(sourceBodyPartId, targetBodyPartId, event.clientY > rect.top + rect.height / 2);
    }
  };

  const finishTouchDrag = () => {
    const pendingBodyParts = pendingBodyPartsRef.current;
    clearTouchDrag();
    pendingBodyPartsRef.current = null;
    if (pendingBodyParts) {
      void persistBodyParts(pendingBodyParts);
    }
  };

  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        三本線を長押しして並べ替えます。ここで変更した順番は、種目マスタ、トレーニング記録、履歴の部位順に反映されます。
      </p>
      <div className="space-y-2">
        {bodyParts.map((bodyPart) => (
          <div
            key={bodyPart.id}
            data-body-part-id={bodyPart.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveBodyPart(bodyPart)}
            className={[
              "rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 transition-[transform,opacity,background-color] duration-150",
              touchDraggingBodyPartId === bodyPart.id ? "scale-[0.985] bg-[var(--accent-soft)] opacity-70" : "",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveColorBodyPartId((current) => (current === bodyPart.id ? null : bodyPart.id))
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className="color-orb h-4 w-4 shrink-0 rounded-full"
                  style={
                    {
                      "--color-orb": getBodyPartColorByColorKey(bodyPart.colorKey),
                    } as CSSProperties
                  }
                />
                <span className="min-w-0 flex-1 font-medium">{bodyPart.displayName}</span>
              </button>
              <button
                type="button"
                draggable
                onDragStart={() => setDraggingBodyPartId(bodyPart.id)}
                onPointerDown={(event) => startTouchDrag(bodyPart.id, event)}
                onPointerMove={moveTouchDrag}
                onPointerUp={finishTouchDrag}
                onPointerCancel={finishTouchDrag}
                aria-label={`${bodyPart.displayName}を並べ替え`}
                className="flex h-10 w-10 shrink-0 touch-none select-none items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] active:bg-[var(--accent-soft)] active:text-[var(--accent-strong)]"
              >
                <Menu size={20} />
              </button>
            </div>
            {activeColorBodyPartId === bodyPart.id ? (
              <div className="mt-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
                <div className="grid grid-cols-5 gap-2">
                  {bodyPartColorOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => updateBodyPartColor(bodyPart.id, option.key)}
                      aria-label={`${bodyPart.displayName}の色を${option.label}にする`}
                      aria-pressed={bodyPart.colorKey === option.key}
                      title={option.label}
                      className="flex h-10 items-center justify-center rounded-[12px] border border-transparent"
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          "color-orb flex h-7 w-7 items-center justify-center rounded-full transition-transform",
                          bodyPart.colorKey === option.key ? "scale-105" : "hover:scale-105",
                        ].join(" ")}
                        style={{ "--color-orb": option.color } as CSSProperties}
                      >
                        {bodyPart.colorKey === option.key ? (
                          <Check size={15} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
