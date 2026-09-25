"use client";

import { ArrowUpRight, ChartNoAxesCombined, Download, History, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { WorkoutCalendar } from "@/components/calendar/workout-calendar";
import { formatGoalDate, isGoalDue } from "@/lib/goals/goals";
import { toDateKey } from "@/lib/workouts/date";

function GoalValue({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-[var(--text)]">{children}</p>;
}

export function HomeDashboard() {
  const { profile } = useAuth();
  const [today, setToday] = useState(() => toDateKey(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(toDateKey(new Date())), 60000);
    return () => window.clearInterval(timer);
  }, []);

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
  return (
    <main className="space-y-4 pb-16">
      <section className="ui-card p-3 sm:p-5">
        <WorkoutCalendar showWorkoutDetails={false} />
      </section>

      {hasGoals ? (
        <section className="ui-card overflow-hidden px-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] py-3.5">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Target size={18} className="text-[var(--muted)]" />目的・目標</h2>
            <Link href="/settings?section=goals&returnTo=%2F" className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-medium">管理・振り返り</Link>
          </div>
          <div className="divide-y divide-[var(--hairline)]">
            {purpose ? (
              <div className="py-3.5">
                <h3 className="text-sm font-semibold text-[var(--muted)]">目的</h3>
                <GoalValue>{purpose}</GoalValue>
              </div>
            ) : null}
            {visibleGoalDeadlines.map(({ label, date, value }) => (
              <div key={label} className="py-3.5">
                <h3 className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm font-semibold leading-snug text-[var(--muted)]">
                  <span className="shrink-0">{label}</span>
                  {date ? (
                    <span className="text-right text-[11px] font-normal">
                      ～{formatGoalDate(date)}
                    </span>
                  ) : null}
                </h3>
                <GoalValue>{value}</GoalValue>
                {isGoalDue(value, date ?? "", today) ? <Link href="/settings?section=goals&returnTo=%2F" className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] px-3 text-sm font-medium"><span>期限を迎えました。振り返りましょう</span><ArrowUpRight size={17} className="shrink-0" /></Link> : null}
              </div>
            ))}
            {finalGoal ? (
              <div className="py-3.5">
                <h3 className="text-sm font-semibold text-[var(--muted)]">最終目標</h3>
                <GoalValue>{finalGoal}</GoalValue>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <Link
        href="/history"
        className="ui-card ui-action w-full"
      >
        <History size={18} className="text-[var(--muted)]" />
        <span className="flex-1">履歴</span>
        <ArrowUpRight size={16} className="text-[var(--muted)]" />
      </Link>

      <Link href="/stats" className="ui-card ui-action w-full">
        <ChartNoAxesCombined size={18} className="text-[var(--muted)]" />
        <span className="flex-1">集計を表示</span>
        <ArrowUpRight size={16} className="text-[var(--muted)]" />
      </Link>
      <Link href="/export" className="ui-card ui-action w-full">
        <Download size={18} className="text-[var(--muted)]" />
        <span className="flex-1">データをエクスポート</span>
        <ArrowUpRight size={16} className="text-[var(--muted)]" />
      </Link>
    </main>
  );
}
