"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { goalPeriodStart, shiftGoalMonth, type GoalKind } from "@/lib/goals/goals";
import { getGoalProgress, type GoalProgress } from "@/lib/goals/repository";
import { toDateKey } from "@/lib/workouts/date";
import type { Database } from "@/lib/supabase/database.types";

export function GoalProgressView({ progress }: { progress: GoalProgress }) {
  return <div className="rounded-xl bg-[var(--surface-soft)] p-3">
    <div className="grid grid-cols-2 gap-3"><p><span className="text-2xl font-semibold">{progress.workoutDays}</span><span className="ml-1 text-xs text-[var(--muted)]">日トレーニング</span></p><p><span className="text-2xl font-semibold">{progress.setCount}</span><span className="ml-1 text-xs text-[var(--muted)]">セット記録</span></p></div>
    {progress.exercises.some(e => e.maxWeightKg !== null) ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium">期間中の最高重量</summary><ul className="mt-2 space-y-1">{progress.exercises.filter(e => e.maxWeightKg !== null).map(e => <li key={e.name} className="flex justify-between gap-3"><span>{e.name}</span><span className="shrink-0">{e.maxWeightKg} kg</span></li>)}</ul></details> : null}
  </div>;
}

export function GoalReviewForm({ goal, onComplete, periodStart }: {
  goal: { key: GoalKind; label: string; months: number; text: string; deadline: string };
  onComplete: () => Promise<void>;
  periodStart?: string;
}) {
  const { user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [start, setStart] = useState(periodStart ?? goalPeriodStart(goal.deadline, goal.months));
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [achieved, setAchieved] = useState<boolean | null>(null);
  const [percent, setPercent] = useState("");
  const [reflection, setReflection] = useState("");
  const [action, setAction] = useState("");
  const [nextText, setNextText] = useState("");
  const [nextDate, setNextDate] = useState(() => shiftGoalMonth(toDateKey(new Date()), goal.months));
  const [tomorrow] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 1); return toDateKey(date); });
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const submitted = useRef<Database["public"]["Functions"]["complete_goal_review"]["Args"] | null>(null);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const dirty = achieved !== null || Boolean(reflection || action || nextText || percent);

  useEffect(() => {
    if (!dirty) return;
    const onNav = (event: Event) => {
      if (!completed.current && !window.confirm("振り返りはまだ保存されていません。閉じますか？")) event.preventDefault();
    };
    const onUnload = (event: BeforeUnloadEvent) => { if (!completed.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("kochifit:confirm-navigation", onNav);
    window.addEventListener("beforeunload", onUnload);
    return () => { window.removeEventListener("kochifit:confirm-navigation", onNav); window.removeEventListener("beforeunload", onUnload); };
  }, [dirty]);

  useEffect(() => {
    let active = true;
    setProgress(null);
    setStatsError(false);
    if (!start || start > goal.deadline) return;
    void getGoalProgress(client, start, goal.deadline).then(value => { if (active) setProgress(value); }).catch(() => { if (active) setStatsError(true); });
    return () => { active = false; };
  }, [client, goal.deadline, retry, start]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || inFlight.current || !progress || achieved === null || !percent || Number(percent) < 0 || Number(percent) > 100) return;
    if (!reflection.trim() || !action.trim() || !nextText.trim() || !Number.isInteger(Number(percent))) {
      setError("振り返り・次に取り組むこと・次の目標を入力し、達成度は整数で指定してください。");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    requestId.current ??= crypto.randomUUID();
    try {
      submitted.current ??= {
        p_id: requestId.current, p_goal_kind: goal.key, p_goal_text: goal.text, p_goal_deadline: goal.deadline,
        p_period_start: start, p_achieved: achieved, p_achievement_percent: Number(percent), p_reflection: reflection.trim(), p_next_action: action.trim(),
        p_next_goal_text: nextText.trim(), p_next_goal_deadline: nextDate, p_progress: progress,
      };
      setAttempted(true);
      const { error } = await client.rpc("complete_goal_review", submitted.current);
      if (error) throw error;
      completed.current = true;
      await onComplete();
    } catch {
      setError("振り返りを保存できませんでした。通信またはDB設定を確認してください。目標が別の画面で変更された場合は再読み込みが必要です。");
    } finally { inFlight.current = false; setSaving(false); }
  };
  return <form onSubmit={event => void save(event)} className="space-y-4 border-t border-[var(--hairline)] pt-4">
    <fieldset disabled={saving || attempted} className="space-y-4">
    <div><h4 className="flex items-center gap-2 text-base font-semibold"><RotateCcw size={17} />目標を達成できましたか？</h4><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">実績を参考に振り返ります。達成度は自己評価です。</p></div>
    <label className="block space-y-1 text-sm">実績を集計する開始日<input type="date" required max={goal.deadline} value={start} onChange={e => setStart(e.target.value)} className="ui-field" /></label>
    <p className="text-xs text-[var(--muted)]">集計期間：{start} ～ {goal.deadline}</p>
    {progress ? <GoalProgressView progress={progress} /> : statsError ? <button type="button" onClick={() => setRetry(n => n + 1)} className="text-sm text-[var(--warning)] underline">実績の読み込みに失敗しました。再試行</button> : <p role="status" className="text-sm text-[var(--muted)]">実績を読み込み中</p>}
    <div role="group" aria-label="目標の達成結果" className="grid grid-cols-2 gap-2">{[{ value: true, label: "達成できた" }, { value: false, label: "まだ途中" }].map(option => <button key={option.label} type="button" aria-pressed={achieved === option.value} onClick={() => { setAchieved(option.value); if (option.value) setPercent("100"); }} className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${achieved === option.value ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)]"}`}>{option.label}</button>)}</div>
    <label className="block space-y-1 text-sm">達成度（0～100％）<input type="number" inputMode="numeric" min="0" max="100" step="1" required value={percent} onChange={e => setPercent(e.target.value)} className="ui-field" /></label>
    <label className="block space-y-1 text-sm">どのくらい達成できたか<textarea required maxLength={2000} value={reflection} onChange={e => setReflection(e.target.value)} rows={3} className="ui-field" placeholder="実際の数値や、できたこと・難しかったこと" /></label>
    <label className="block space-y-1 text-sm">次はどうしたいか<textarea required maxLength={2000} value={action} onChange={e => setAction(e.target.value)} rows={3} className="ui-field" placeholder="続けたいこと、変えたいこと" /></label>
    <div className="space-y-3 rounded-2xl bg-[var(--surface-soft)] p-3"><h4 className="ui-section-title">次の{goal.label}</h4><label className="block space-y-1 text-sm">内容<textarea required maxLength={200} value={nextText} onChange={e => setNextText(e.target.value)} rows={2} className="ui-field" /></label><label className="block space-y-1 text-sm">期限<input type="date" required min={tomorrow} value={nextDate} onChange={e => setNextDate(e.target.value)} className="ui-field" /></label></div>
    </fieldset>
    <button type="submit" disabled={saving || !progress || achieved === null} className="ui-primary w-full"><Check size={17} />{saving ? "保存中" : attempted ? "同じ内容で保存結果を再確認" : "振り返りを保存して次の目標へ"}</button>
    {error ? <p role="alert" className="text-sm text-[var(--warning)]">{error}</p> : null}
  </form>;
}
