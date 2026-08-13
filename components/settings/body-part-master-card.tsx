"use client";

import { Check, ChevronDown, ChevronUp, GripVertical, Save } from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const moveBodyPart = (targetBodyPart: BodyPart) => {
    if (!draggingBodyPartId || draggingBodyPartId === targetBodyPart.id) {
      setDraggingBodyPartId(null);
      return;
    }

    setBodyParts((current) => {
      const sourceIndex = current.findIndex((bodyPart) => bodyPart.id === draggingBodyPartId);
      const targetIndex = current.findIndex((bodyPart) => bodyPart.id === targetBodyPart.id);
      if (sourceIndex < 0 || targetIndex < 0) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((bodyPart, index) => ({ ...bodyPart, displayOrder: index + 1 }));
    });
    setDraggingBodyPartId(null);
  };

  const saveOrder = async () => {
    if (!user) {
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      await reorderBodyParts(client, {
        userId: user.id,
        bodyParts: bodyParts.map((bodyPart) => ({
          id: bodyPart.id,
          colorKey: bodyPart.colorKey,
        })),
      });
      await load();
      setActiveColorBodyPartId(null);
      setMessage("部位の順番を保存しました。");
    } catch (saveError) {
      console.error("Body part order save error", saveError);
      setError("部位の順番保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  const updateBodyPartColor = (bodyPartId: string, colorKey: string) => {
    setBodyParts((current) =>
      current.map((item) => (item.id === bodyPartId ? { ...item, colorKey } : item)),
    );
  };

  const moveBodyPartByIndex = (index: number, delta: number) => {
    setBodyParts((current) => {
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next.map((bodyPart, bodyPartIndex) => ({
        ...bodyPart,
        displayOrder: bodyPartIndex + 1,
      }));
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void saveOrder()}
          disabled={isSaving}
          className="flex min-h-10 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-50"
        >
          <Save size={16} />
          {isSaving ? "保存中" : "保存"}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">
        ここで変更した順番は、種目マスタ、トレーニング記録、履歴の部位順に反映されます。
      </p>
      <div className="space-y-2">
        {bodyParts.map((bodyPart, index) => (
          <div
            key={bodyPart.id}
            draggable
            onDragStart={() => setDraggingBodyPartId(bodyPart.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveBodyPart(bodyPart)}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveColorBodyPartId((current) => (current === bodyPart.id ? null : bodyPart.id))
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <GripVertical size={18} className="shrink-0 text-[var(--muted)]" />
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
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => moveBodyPartByIndex(index, -1)}
                  disabled={index === 0}
                  aria-label={`${bodyPart.displayName}を上へ移動`}
                  className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBodyPartByIndex(index, 1)}
                  disabled={index === bodyParts.length - 1}
                  aria-label={`${bodyPart.displayName}を下へ移動`}
                  className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-35"
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            {activeColorBodyPartId === bodyPart.id ? (
              <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
                <div className="grid grid-cols-5 gap-2">
                  {bodyPartColorOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => updateBodyPartColor(bodyPart.id, option.key)}
                      aria-label={`${bodyPart.displayName}の色を${option.label}にする`}
                      aria-pressed={bodyPart.colorKey === option.key}
                      title={option.label}
                      className="flex h-10 items-center justify-center rounded-[8px] border border-transparent"
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
      {message ? <p className="mt-3 text-sm text-emerald-500">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
