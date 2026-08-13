"use client";

import { History } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { WorkoutCalendar } from "@/components/calendar/workout-calendar";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import { getBodyPartWorkoutDistribution, getWorkoutStats } from "@/lib/workouts/repository";
import type { BodyPartWorkoutDistribution, WorkoutStats } from "@/lib/workouts/types";

const emptyStats: WorkoutStats = {
  totalWorkoutDays: 0,
  monthWorkoutDays: 0,
  weeklyAverageWorkoutDays: 0,
  averageDailyCalories: 0,
};

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function GoalValue({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[13px] font-medium leading-5 text-[var(--text)]">{children}</p>;
}

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
    <div className="flex min-h-12 items-center justify-between gap-2 rounded-[8px] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow)]">
      <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
      <p className="flex shrink-0 items-baseline gap-1">
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-xs text-[var(--muted)]">{unit}</span>
      </p>
    </div>
  );
}

export function HomeDashboard() {
  const { authStatus, profile, profileStatus, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<WorkoutStats>(emptyStats);
  const [distribution, setDistribution] = useState<BodyPartWorkoutDistribution[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) {
      return;
    }
    setError(null);
    try {
      const [nextStats, nextDistribution] = await Promise.all([
        getWorkoutStats(client, profile),
        getBodyPartWorkoutDistribution(client),
      ]);
      setStats(nextStats);
      setDistribution(nextDistribution);
    } catch (loadError) {
      console.error("Workout stats load error", loadError);
      setError("集計の読み込みに失敗しました．");
    }
  }, [client, profile, user]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadStats();
    }
  }, [authStatus, loadStats, profileStatus]);

  const goalDeadlines: Array<{ label: string; date: string | null; value: string | null | undefined }> = [
    {
      label: "1か月目標",
      date: profile?.one_month_goal_date ?? null,
      value: profile?.one_month_goal_text,
    },
    {
      label: "3か月目標",
      date: profile?.three_month_goal_date ?? null,
      value: profile?.three_month_goal_text,
    },
    {
      label: "1年目標",
      date: profile?.one_year_goal_date ?? null,
      value: profile?.one_year_goal_text,
    },
  ];
  const purpose = profile?.training_purpose?.trim() ?? "";
  const finalGoal = profile?.final_goal?.trim() ?? "";
  const visibleGoalDeadlines = goalDeadlines
    .map(({ label, date, value }) => ({ label, date, value: value?.trim() ?? "" }))
    .filter(({ value }) => value);
  const hasGoals = Boolean(purpose || finalGoal || visibleGoalDeadlines.length > 0);
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
    <main className="space-y-4">
      <section className="rounded-[8px] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
        <WorkoutCalendar showWorkoutDetails={false} />
      </section>

      {hasGoals ? (
        <section className="space-y-2 rounded-[8px] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
          <div className="grid gap-2">
            {purpose ? (
              <div className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-2">
                <h3 className="text-sm font-semibold">目的</h3>
                <GoalValue>{purpose}</GoalValue>
              </div>
            ) : null}
            {visibleGoalDeadlines.map(({ label, date, value }) => (
              <div key={label} className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-2">
                <h3 className="flex items-baseline justify-between gap-2 text-sm font-semibold leading-snug">
                  <span className="shrink-0">{label}</span>
                  {date ? (
                    <span className="min-w-0 truncate text-right text-sm font-medium text-[var(--muted)]">
                      （～{formatDate(date)}）
                    </span>
                  ) : null}
                </h3>
                <GoalValue>{value}</GoalValue>
              </div>
            ))}
            {finalGoal ? (
              <div className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-2">
                <h3 className="text-sm font-semibold">最終目標</h3>
                <GoalValue>{finalGoal}</GoalValue>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <Link
        href="/history"
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--surface)] px-3 py-2 text-sm font-semibold shadow-[var(--shadow)]"
      >
        <History size={18} />
        履歴
      </Link>

      <section className="grid grid-cols-2 gap-2">
        <StatCard label="合計" value={stats.totalWorkoutDays} unit="日" />
        <StatCard label="今月" value={stats.monthWorkoutDays} unit="日" />
        <StatCard label="週平均" value={stats.weeklyAverageWorkoutDays} unit="日" />
        <StatCard label="日平均消費" value={stats.averageDailyCalories} unit="kcal" />
      </section>

      <section className="rounded-[8px] bg-[var(--surface)] p-3 shadow-[var(--shadow)]">
        <h2 className="text-base font-semibold">部位別トレーニング日数</h2>
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
                    className="flex items-center justify-between gap-2 rounded-[8px] bg-[var(--surface-soft)] px-2.5 py-1.5 text-xs"
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
              <p className="rounded-[8px] bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--muted)]">
                記録が増えると部位別の割合を表示します．
              </p>
            )}
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-[var(--warning)]">{error}</p> : null}
    </main>
  );
}
