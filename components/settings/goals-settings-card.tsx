"use client";

import { Check, ChevronDown, Flag, History, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { formatGoalDate, getGoals, goalKinds, isGoalDue, type GoalKind } from "@/lib/goals/goals";
import type { Database, GoalReviewRow, Profile } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import { toDateKey } from "@/lib/workouts/date";
import { GoalReviewForm } from "./goal-review-form";

const confirmedGoalNavigation = new WeakSet<Event>();

function useUnsavedGoal(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const nav = (event: Event) => {
      if (event.defaultPrevented || confirmedGoalNavigation.has(event)) return;
      confirmedGoalNavigation.add(event);
      if (!window.confirm("目標の変更はまだ保存されていません。閉じますか？")) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("kochifit:confirm-navigation", nav);
    window.addEventListener("beforeunload", unload);
    return () => { window.removeEventListener("kochifit:confirm-navigation", nav); window.removeEventListener("beforeunload", unload); };
  }, [dirty]);
}

function GoalEditor({ goal, done }: { goal: { key: GoalKind; label: string; text: string; deadline: string }; done: () => Promise<void> }) {
  const { user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [text, setText] = useState(goal.text);
  const [date, setDate] = useState(goal.deadline);
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState({ text: goal.text, date: goal.deadline });
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = text !== baseline.text || date !== baseline.date;
  useUnsavedGoal(dirty);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || inFlight.current || !dirty) return;
    inFlight.current = true;
    setSaving(true); setError(null);
    try {
      const update: Database["public"]["Tables"]["profiles"]["Update"] = { [`${goal.key}_goal_text`]: text.trim() || null, [`${goal.key}_goal_date`]: date || null };
      const { error } = await client.from("profiles").update(update).eq("id", user.id);
      if (error) throw error;
      const savedText = text.trim();
      setText(savedText);
      setBaseline({ text: savedText, date });
      try { await done(); } catch { setError("目標は保存しましたが、最新情報を取得できませんでした。画面を再読み込みしてください。"); }
    } catch { setError("目標を保存できませんでした。"); } finally { inFlight.current = false; setSaving(false); }
  };
  return <form aria-label={`${goal.label}の設定`} onSubmit={e => void save(e)} className="mt-3 space-y-3">
    <fieldset disabled={saving} className="space-y-3">
    <label className="block space-y-1 text-sm">目標の内容<textarea rows={2} maxLength={200} value={text} onChange={e => setText(e.target.value)} className="ui-field" /></label>
    <label className="block space-y-1 text-sm">期限<input type="date" value={date} onChange={e => setDate(e.target.value)} className="ui-field" /></label>
    <button type="submit" disabled={saving || !dirty} className="ui-primary w-full"><Check size={16} />{saving ? "保存中" : dirty ? "変更を保存" : "保存済み"}</button>
    </fieldset>
    {error ? <p role="alert" className="text-sm text-[var(--warning)]">{error}</p> : null}
  </form>;
}

function PurposeEditor({ profile }: { profile: Profile }) {
  const { user, refreshProfile } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [purpose, setPurpose] = useState(profile.training_purpose ?? "");
  const [final, setFinal] = useState(profile.final_goal ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = purpose !== (profile.training_purpose ?? "") || final !== (profile.final_goal ?? "");
  useUnsavedGoal(dirty);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || saving) return;
    setSaving(true); setError(null);
    try {
      const { error } = await client.from("profiles").update({ training_purpose: purpose.trim() || null, final_goal: final.trim() || null }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
    } catch { setError("目的・最終目標を保存できませんでした。"); } finally { setSaving(false); }
  };
  return <form onSubmit={e => void save(e)} className="ui-card space-y-4 p-4">
    {[{ label: "目的", icon: Target, value: purpose, change: setPurpose }, { label: "最終目標", icon: Flag, value: final, change: setFinal }].map(({ label, icon: Icon, value, change }) => <label key={label} className="block space-y-2"><span className="ui-section-title flex items-center gap-2"><Icon size={16} className="text-[var(--muted)]" />{label}</span><textarea rows={2} maxLength={200} value={value} onChange={e => change(e.target.value)} className="ui-field" /></label>)}
    <button type="submit" disabled={saving || !dirty} className="ui-primary w-full"><Check size={16} />{saving ? "保存中" : dirty ? "変更を保存" : "保存済み"}</button>
    {error ? <p role="alert" className="text-sm text-[var(--warning)]">{error}</p> : null}
  </form>;
}

export function GoalsSettingsCard() {
  const { profile, user, refreshProfile } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<GoalReviewRow[]>([]);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [historyError, setHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [active, setActive] = useState<GoalKind | null>(null);
  const request = useRef(0);
  const today = toDateKey(new Date());
  const load = useCallback(async () => {
    if (!user) return;
    const sequence = ++request.current;
    setHistoryLoading(true); setHistoryError(false);
    const { data, error } = await client.from("goal_reviews").select("*").eq("user_id", user.id).order("reviewed_at", { ascending: false }).limit(historyLimit);
    if (sequence !== request.current) return;
    if (error) setHistoryError(true); else setReviews(data ?? []);
    setHistoryLoading(false);
  }, [client, historyLimit, user]);
  useEffect(() => { void load(); }, [load]);
  const navigate = (next: typeof active) => {
    if (!window.dispatchEvent(new CustomEvent("kochifit:confirm-navigation", { cancelable: true, detail: { scope: "settings" } }))) return;
    setActive(next);
  };
  if (!profile) return <p role="status" className="text-sm text-[var(--muted)]">目標を読み込み中</p>;
  return <div className="space-y-5 pb-6">
    <p className="text-sm leading-relaxed text-[var(--muted)]">目標を立てる、実績を振り返る、次につなげる。</p>
    <PurposeEditor key={`${profile.training_purpose}:${profile.final_goal}`} profile={profile} />
    <div className="space-y-3"><h2 className="ui-section-title">いま取り組む目標</h2>
      {getGoals(profile).map(goal => {
        const due = isGoalDue(goal.text, goal.deadline, today);
        const previous = reviews.find(review => review.goal_kind === goal.key && review.next_goal_deadline === goal.deadline && review.next_goal_text === goal.text);
        return <section id={`goal-${goal.key}`} key={goal.key} className="ui-card scroll-mt-4 space-y-3 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="ui-section-title">{goal.label}</h3><span className="text-xs text-[var(--muted)]">{formatGoalDate(goal.deadline) || "期限未設定"}</span></div>
          <div className="flex items-center justify-between gap-3">
            {due ? <button type="button" className="ui-primary" onClick={() => navigate(active === goal.key ? null : goal.key)}>{active === goal.key ? "振り返りを閉じる" : "振り返る"}</button> : <span className="text-xs text-[var(--muted)]">{goal.text ? "取り組み中" : "未設定"}</span>}
          </div>
          {active === goal.key ? <GoalReviewForm key={`${goal.text}:${goal.deadline}`} goal={goal} periodStart={previous ? toDateKey(new Date(previous.reviewed_at)) : undefined} onComplete={async () => { await refreshProfile(); await load(); setActive(null); }} /> : <GoalEditor key={`${goal.text}:${goal.deadline}`} goal={goal} done={refreshProfile} />}
        </section>;
      })}
    </div>
    <section className="space-y-3"><h2 className="ui-section-title flex items-center gap-2"><History size={17} />これまでの振り返り</h2>
      {historyLoading ? <p role="status" className="text-sm text-[var(--muted)]">履歴を読み込み中</p> : historyError ? <div role="alert" className="rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--warning)]">履歴を読み込めません。DBの目標履歴機能が未設定、または通信に問題があります。<button type="button" className="ml-2 underline" onClick={() => void load()}>再試行</button></div> : reviews.length === 0 ? <p className="text-sm text-[var(--muted)]">保存した振り返りがここに残ります。</p> : null}
      {goalKinds.map(kind => <details key={kind.key} className="ui-card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">{kind.label}<ChevronDown size={16} /></summary>
        <div className="mt-3 space-y-3">
        {!historyLoading && !historyError && !reviews.some(review => review.goal_kind === kind.key) ? <p className="text-sm text-[var(--muted)]">この期間の振り返りはまだありません。</p> : null}
        {reviews.filter(review => review.goal_kind === kind.key).map(review => <details key={review.id} className="rounded-xl border border-[var(--border)] p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold"><span>{formatGoalDate(review.period_start)}–{formatGoalDate(review.goal_deadline)}</span><ChevronDown size={16} className="shrink-0" /></summary>
        <div className="mt-4 space-y-3 border-t border-[var(--hairline)] pt-3 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap break-words">{review.goal_text}</p>
          <p className="text-xs text-[var(--muted)]">{review.achieved ? "達成" : "途中"} · 達成度 {review.achievement_percent}％</p>
          {review.progress && typeof review.progress === "object" && !Array.isArray(review.progress) ? <p className="text-xs text-[var(--muted)]">実績：{String(review.progress.workoutDays ?? "—")}日 / {String(review.progress.setCount ?? "—")}セット</p> : null}
          <div><h4 className="ui-section-title">振り返り</h4><p className="mt-1 whitespace-pre-wrap break-words">{review.reflection}</p></div>
          <div><h4 className="ui-section-title">次に取り組むこと</h4><p className="mt-1 whitespace-pre-wrap break-words">{review.next_action}</p></div>
          <div><h4 className="ui-section-title">次の目標</h4><p className="mt-1 whitespace-pre-wrap break-words">{review.next_goal_text}</p><p className="text-xs text-[var(--muted)]">期限：{formatGoalDate(review.next_goal_deadline)}</p></div>
        </div>
      </details>)}
        </div>
      </details>)}
      {reviews.length >= historyLimit ? <button type="button" onClick={() => setHistoryLimit(n => n + 30)} className="ui-action w-full justify-center">以前の振り返りを表示</button> : null}
    </section>
  </div>;
}
