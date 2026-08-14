"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import { getBodyParts, getExerciseRecords } from "@/lib/workouts/repository";
import type { BodyPart, ExerciseRecord } from "@/lib/workouts/types";

function formatNumber(value: number | null, suffix: string) {
  if (value === null) {
    return "-";
  }
  return `${Number(value.toFixed(1))}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${Number(year)}/${Number(month)}/${Number(day)}`;
}

export function RecordsOverview() {
  const { authStatus, profileStatus, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [records, setRecords] = useState<ExerciseRecord[]>([]);
  const [expandedBodyPartIds, setExpandedBodyPartIds] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedRecords = useMemo(
    () =>
      bodyParts.map((bodyPart) => ({
        bodyPart,
        records: records
          .filter((record) => record.bodyPartId === bodyPart.id)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      })),
    [bodyParts, records],
  );

  const loadRecords = useCallback(async () => {
    if (!user) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [nextBodyParts, nextRecords] = await Promise.all([
        getBodyParts(client),
        getExerciseRecords(client),
      ]);
      setBodyParts(nextBodyParts);
      setRecords(nextRecords);
    } catch (loadError) {
      console.error("Exercise records load error", loadError);
      setError("履歴の読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadRecords();
    }
  }, [authStatus, loadRecords, profileStatus]);

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
  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-[var(--warning)]">{error}</p> : null}

        {groupedRecords.map(({ bodyPart, records: bodyPartRecords }) => {
          const headerColor = getBodyPartColor(bodyPart.key, bodyPart.colorKey);
          const isExpanded = expandedBodyPartIds.has(bodyPart.id);
          const visibleRecords = isExpanded ? bodyPartRecords : bodyPartRecords.slice(0, 3);
          return (
            <section key={bodyPart.id} className="overflow-hidden rounded-[12px] bg-[var(--surface)] shadow-[var(--shadow)]">
              <h2 className="flex items-center gap-2 border-b border-[var(--hairline)] px-3 py-2.5 text-sm font-semibold">
                <span
                  aria-hidden="true"
                  className="color-orb h-3 w-3 shrink-0 rounded-full"
                  style={{ "--color-orb": headerColor } as CSSProperties}
                />
                <span className="min-w-0 truncate">{bodyPart.displayName}</span>
              </h2>
              {bodyPartRecords.length > 0 ? (
                <div className="space-y-2 p-2">
                  {visibleRecords.map((record) => (
                    <article
                      key={record.exerciseId}
                      className="rounded-[12px] bg-[var(--surface-soft)] p-3"
                    >
                      <h3 className="font-semibold">{record.exerciseName}</h3>
                      <dl className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                        <div className="rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5">
                          <dt className="text-xs text-[var(--muted)]">最高重量</dt>
                          <dd className="mt-1 font-semibold">
                            {formatNumber(record.maxWeightKg, "kg")}
                          </dd>
                        </div>
                        <div className="rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5">
                          <dt className="text-xs text-[var(--muted)]">最大量</dt>
                          <dd className="mt-1 font-semibold">
                            {formatNumber(record.maxVolumeKg, "kg")}
                          </dd>
                        </div>
                        <div className="rounded-[12px] bg-[var(--surface)] px-2.5 py-1.5">
                          <dt className="text-xs text-[var(--muted)]">最終</dt>
                          <dd className="mt-1 font-semibold">{formatDate(record.lastWorkoutDate)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {bodyPartRecords.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpandedBodyPart(bodyPart.id)}
                      className="flex min-h-10 w-full items-center justify-center rounded-[12px] bg-[var(--surface-soft)] text-sm font-semibold text-[var(--muted)]"
                    >
                      {isExpanded ? "閉じる" : "すべて表示（" + bodyPartRecords.length + "件）"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="m-2 rounded-[12px] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
                  {isLoading ? "読込中" : "記録なし"}
                </p>
              )}
            </section>
          );
        })}
    </div>
  );
}
