"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ScreenshotButton } from "@/components/screenshot-button";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import { getBodyPartWorkoutDistribution, getWorkoutStats } from "@/lib/workouts/repository";
import { RecordPeriodSelector } from "@/components/history/record-period-selector";
import { getRecordRange, type RecordPeriod } from "@/lib/workouts/period";
import { toDateKey } from "@/lib/workouts/date";
import type { BodyPartWorkoutDistribution, WorkoutStats } from "@/lib/workouts/types";

const emptyStats: WorkoutStats = {
  totalWorkoutDays: 0,
  monthWorkoutDays: 0,
  weeklyAverageWorkoutDays: 0,
  averageDailyCalories: 0,
};

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit: string;
}) {
  return (
    <div className="ui-card space-y-2 px-4 py-3.5">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="flex shrink-0 items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs text-[var(--muted)]">{unit}</span>
      </p>
    </div>
  );
}

export function StatsDashboard() {
  const captureRef = useRef<HTMLDivElement>(null);
  const { authStatus, profile, profileStatus, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [period, setPeriod] = useState<RecordPeriod>("month");
  const [stats, setStats] = useState<WorkoutStats>(emptyStats);
  const [distribution, setDistribution] = useState<BodyPartWorkoutDistribution[]>([]);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(toDateKey(new Date())), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated" || profileStatus !== "ready" || !user) return;
    let active = true;
    setError(null);
    setStatsLoading(true);
    const now = new Date(`${today}T12:00:00`);
    const range = getRecordRange(period, now);
    void Promise.all([
      getWorkoutStats(client, profile, now, range),
      getBodyPartWorkoutDistribution(client, range),
    ]).then(([nextStats, nextDistribution]) => {
      if (!active) return;
      setStats(nextStats);
      setDistribution(nextDistribution);
    }).catch(() => {
      if (active) setError("集計の読み込みに失敗しました。期間を選び直して再試行してください。");
    }).finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [authStatus, client, period, profile, profileStatus, retry, today, user]);

  const totalDistributedDays = distribution.reduce((total, item) => total + item.workoutDays, 0);
  const pieBackground = (() => {
    if (totalDistributedDays === 0) {
      return "var(--surface-soft)";
    }

    let cursor = 0;
    const stops = distribution.map((item) => {
      const start = cursor;
      const end = cursor + (item.workoutDays / totalDistributedDays) * 100;
      cursor = end;
      const color = getBodyPartColor(item.bodyPartKey, item.colorKey);
      return `${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  })();

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-wrap items-start gap-2">
        <ScreenshotButton targetRef={captureRef} filename={`KochiFit_集計_${period}_${today}.png`} disabled={statsLoading || Boolean(error)} />
        <Link href="/export" className="ui-action inline-flex min-h-11 items-center">データをエクスポート</Link>
      </div>
      <div ref={captureRef} className="space-y-4">
      <p className="text-sm font-semibold">KochiFit · トレーニング集計</p>
      <RecordPeriodSelector value={period} today={new Date(`${today}T12:00:00`)} onChange={value => {
        if (value !== period) { setStatsLoading(true); setPeriod(value); }
      }} />
      {statsLoading ? <p role="status" className="text-center text-sm text-[var(--muted)]">集計を読み込み中</p> : null}
      {!statsLoading && !error ? <>
      <section className="grid grid-cols-2 gap-2">
        <StatCard label="期間内の合計" value={stats.totalWorkoutDays} unit="日" />
        <StatCard label="期間内の今月" value={stats.monthWorkoutDays} unit="日" />
        <StatCard label="週平均" value={stats.weeklyAverageWorkoutDays} unit="日" />
        <StatCard label="実施日平均消費" value={stats.averageDailyCalories} unit="kcal" />
      </section>

      <section className="ui-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold">部位別トレーニング日数</h2>
        <div className="mt-3 grid grid-cols-[112px_1fr] items-center gap-3">
          <div className="relative h-[112px] w-[112px] rounded-full p-2">
            <div
              aria-hidden="true"
              className="color-donut h-full w-full rounded-full"
              style={{ background: pieBackground }}
            />
            <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-[var(--surface)] shadow-[var(--shadow)]">
              <span className="text-lg font-semibold">{totalDistributedDays}</span>
              <span className="text-xs text-[var(--muted)]">日</span>
            </div>
          </div>
          <div className="grid gap-2">
            {distribution.length > 0 ? (
              distribution.map((item) => {
                const percent =
                  totalDistributedDays > 0
                    ? Math.round((item.workoutDays / totalDistributedDays) * 100)
                    : 0;
                return (
                  <div
                    key={item.bodyPartId}
                    className="flex items-center justify-between gap-2 rounded-[12px] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="color-orb h-3 w-3 shrink-0 rounded-full"
                        style={
                          {
                            "--color-orb": getBodyPartColor(item.bodyPartKey, item.colorKey),
                          } as CSSProperties
                        }
                      />
                      <span className="truncate font-medium">{item.bodyPartName}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-semibold">{percent}%</span>
                      <span className="ml-1 text-[var(--muted)]">{item.workoutDays}日</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
                記録が増えると部位別の割合を表示します。
              </p>
            )}
          </div>
        </div>
      </section>

      </> : null}
      {error ? <div role="alert" className="space-y-2 text-sm text-[var(--warning)]"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="ui-action">再読み込み</button></div> : null}
      </div>
    </div>
  );
}
