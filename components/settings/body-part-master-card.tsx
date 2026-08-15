"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { CSSProperties } from "react";
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
  const [, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyPartsRef = useRef<BodyPart[]>([]);

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
    bodyPartsRef.current = bodyParts;
  }, [bodyParts]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void load();
    }
  }, [authStatus, load, profileStatus]);

  const notifyMasterDataChanged = useCallback(() => {
    window.dispatchEvent(new Event("kochifit:master-data-changed"));
  }, []);

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
        notifyMasterDataChanged();
      } catch (saveError) {
        console.error("Body part preference save error", saveError);
        setError("部位設定の保存に失敗しました。");
        await load();
      } finally {
        setIsSaving(false);
      }
    },
    [client, load, notifyMasterDataChanged, user],
  );

  const moveBodyPartByDelta = (bodyPartId: string, delta: -1 | 1) => {
    const currentBodyParts = bodyPartsRef.current;
    const sourceIndex = currentBodyParts.findIndex((bodyPart) => bodyPart.id === bodyPartId);
    const targetIndex = sourceIndex + delta;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= currentBodyParts.length) {
      return;
    }
    const nextBodyParts = [...currentBodyParts];
    [nextBodyParts[sourceIndex], nextBodyParts[targetIndex]] = [nextBodyParts[targetIndex], nextBodyParts[sourceIndex]];
    const orderedBodyParts = nextBodyParts.map((bodyPart, index) => ({ ...bodyPart, displayOrder: index + 1 }));
    bodyPartsRef.current = orderedBodyParts;
    setBodyParts(orderedBodyParts);
    void persistBodyParts(orderedBodyParts);
  };

  const updateBodyPartColor = (bodyPartId: string, colorKey: string) => {
    const nextBodyParts = bodyPartsRef.current.map((item) => (item.id === bodyPartId ? { ...item, colorKey } : item));
    bodyPartsRef.current = nextBodyParts;
    setBodyParts(nextBodyParts);
    void persistBodyParts(nextBodyParts);
  };


  return (
    <section className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        三本線を長押しして並べ替えます。ここで変更した順番は、種目マスタ、トレーニング記録、履歴の部位順に反映されます。
      </p>
      <div className="space-y-2">
        {bodyParts.map((bodyPart, index) => (
          <div
            key={bodyPart.id}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 transition-colors duration-150"
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
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBodyPartByDelta(bodyPart.id, -1)}
                  disabled={index === 0}
                  aria-label={`${bodyPart.displayName}を上へ移動`}
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-30"
                >
                  <ChevronUp size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => moveBodyPartByDelta(bodyPart.id, 1)}
                  disabled={index === bodyParts.length - 1}
                  aria-label={`${bodyPart.displayName}を下へ移動`}
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--surface)] text-[var(--muted)] disabled:opacity-30"
                >
                  <ChevronDown size={20} />
                </button>
              </div>
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
