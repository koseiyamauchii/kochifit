"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedRecords = useMemo(
    () =>
      bodyParts.map((bodyPart) => ({
        bodyPart,
        records: records
          .filter((record) => record.bodyPartId === bodyPart.id)
          .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "ja")),
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
      setError("履歴の読み込みに失敗しました．");
    } finally {
      setIsLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadRecords();
    }
  }, [authStatus, loadRecords, profileStatus]);

  return (
    <section className="rounded-[8px] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-base font-semibold">履歴</h1>
        <button
          type="button"
          onClick={() => void loadRecords()}
          className="flex min-h-9 items-center gap-2 rounded-[8px] bg-[var(--surface-soft)] px-3 text-sm font-medium"
        >
          <RefreshCw size={16} />
          更新
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}

      <div className="mt-4 space-y-5">
        {groupedRecords.map(({ bodyPart, records: bodyPartRecords }) => (
          <section key={bodyPart.id} className="space-y-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{bodyPart.displayName}</h2>
            {bodyPartRecords.length > 0 ? (
              <div className="space-y-2">
                {bodyPartRecords.map((record) => (
                  <article
                    key={record.exerciseId}
                    className="rounded-[8px] bg-[var(--surface-soft)] p-3"
                  >
                    <h3 className="font-semibold">{record.exerciseName}</h3>
                    <dl className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                      <div className="rounded-[8px] bg-[var(--surface)] px-2.5 py-1.5">
                        <dt className="text-xs text-[var(--muted)]">最高重量</dt>
                        <dd className="mt-1 font-semibold">
                          {formatNumber(record.maxWeightKg, "kg")}
                        </dd>
                      </div>
                      <div className="rounded-[8px] bg-[var(--surface)] px-2.5 py-1.5">
                        <dt className="text-xs text-[var(--muted)]">最大量</dt>
                        <dd className="mt-1 font-semibold">
                          {formatNumber(record.maxVolumeKg, "kg")}
                        </dd>
                      </div>
                      <div className="rounded-[8px] bg-[var(--surface)] px-2.5 py-1.5">
                        <dt className="text-xs text-[var(--muted)]">最終</dt>
                        <dd className="mt-1 font-semibold">{formatDate(record.lastWorkoutDate)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
                {isLoading ? "読込中" : "記録なし"}
              </p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
