"use client";

import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

const heightOptions = Array.from({ length: 91 }, (_, index) => String(130 + index));
const weightOptions = Array.from({ length: 131 }, (_, index) => String(35 + index));
const ageOptions = Array.from({ length: 83 }, (_, index) => String(12 + index));
const setCountOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));

function toNumberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProfileSettingsCard() {
  const { profile, refreshProfile, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [heightCm, setHeightCm] = useState("");
  const [bodyWeightKg, setBodyWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("unspecified");
  const [trainingSplit, setTrainingSplit] = useState("");
  const [defaultSetCount, setDefaultSetCount] = useState("5");
  const [trainingPurpose, setTrainingPurpose] = useState("");
  const [finalGoal, setFinalGoal] = useState("");
  const [oneMonthGoalDate, setOneMonthGoalDate] = useState("");
  const [oneMonthGoalText, setOneMonthGoalText] = useState("");
  const [threeMonthGoalDate, setThreeMonthGoalDate] = useState("");
  const [threeMonthGoalText, setThreeMonthGoalText] = useState("");
  const [oneYearGoalDate, setOneYearGoalDate] = useState("");
  const [oneYearGoalText, setOneYearGoalText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setHeightCm(profile.height_cm !== null ? String(Math.round(profile.height_cm)) : "");
    setBodyWeightKg(
      profile.body_weight_kg !== null ? String(Math.round(profile.body_weight_kg)) : "",
    );
    setAge(profile.age !== null ? String(profile.age) : "");
    setSex(profile.sex ?? "unspecified");
    setTrainingSplit(profile.training_split ?? "");
    setDefaultSetCount(String(profile.default_set_count ?? 5));
    setTrainingPurpose(profile.training_purpose ?? "");
    setFinalGoal(profile.final_goal ?? "");
    setOneMonthGoalDate(profile.one_month_goal_date ?? "");
    setOneMonthGoalText(profile.one_month_goal_text ?? "");
    setThreeMonthGoalDate(profile.three_month_goal_date ?? "");
    setThreeMonthGoalText(profile.three_month_goal_text ?? "");
    setOneYearGoalDate(profile.one_year_goal_date ?? "");
    setOneYearGoalText(profile.one_year_goal_text ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) {
      return;
    }
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      const parsedSetCount = Math.min(10, Math.max(1, Math.trunc(Number(defaultSetCount) || 5)));
      const { error: updateError } = await client
        .from("profiles")
        .update({
          height_cm: toNumberOrNull(heightCm),
          body_weight_kg: toNumberOrNull(bodyWeightKg),
          age: toNumberOrNull(age),
          sex,
          training_split: trainingSplit.trim() || null,
          default_set_count: parsedSetCount,
          training_purpose: trainingPurpose.trim() || null,
          final_goal: finalGoal.trim() || null,
          one_month_goal_date: oneMonthGoalDate || null,
          one_month_goal_text: oneMonthGoalText.trim() || null,
          three_month_goal_date: threeMonthGoalDate || null,
          three_month_goal_text: threeMonthGoalText.trim() || null,
          one_year_goal_date: oneYearGoalDate || null,
          one_year_goal_text: oneYearGoalText.trim() || null,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setDefaultSetCount(String(parsedSetCount));
      await refreshProfile();
      setMessage("保存しました．");
    } catch (saveError) {
      console.error("Profile settings save error", saveError);
      setError("プロフィール設定の保存に失敗しました．");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <h2 className="text-base font-semibold">プロフィール設定</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">身長 cm</span>
          <select
            value={heightCm}
            onChange={(event) => setHeightCm(event.target.value)}
            className="min-h-12 w-full min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          >
            <option value="">未設定</option>
            {heightOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">体重 kg</span>
          <select
            value={bodyWeightKg}
            onChange={(event) => setBodyWeightKg(event.target.value)}
            className="min-h-12 w-full min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          >
            <option value="">未設定</option>
            {weightOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">年齢</span>
          <select
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className="min-h-12 w-full min-w-0 max-w-full appearance-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          >
            <option value="">未設定</option>
            {ageOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">性別</span>
          <select
            value={sex}
            onChange={(event) => setSex(event.target.value)}
            className="min-h-12 w-full min-w-0 max-w-full appearance-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          >
            <option value="unspecified">未設定</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block space-y-1">
        <span className="text-sm font-medium text-[var(--muted)]">分割法</span>
        <select
          value={trainingSplit}
          onChange={(event) => setTrainingSplit(event.target.value)}
          className="min-h-12 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3"
        >
          <option value="">未設定</option>
          <option value="full_body">全身</option>
          <option value="upper_lower">上半身・下半身</option>
          <option value="push_pull_legs">Push・Pull・Legs</option>
          <option value="body_part_split">部位別</option>
        </select>
      </label>
      <label className="mt-3 block space-y-1">
        <span className="text-sm font-medium text-[var(--muted)]">デフォルトセット数</span>
        <select
          value={defaultSetCount}
          onChange={(event) => setDefaultSetCount(event.target.value)}
          className="min-h-12 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3"
        >
          {setCountOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-5 space-y-3">
        <h3 className="text-base font-semibold">目標</h3>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">目的</span>
          <textarea
            value={trainingPurpose}
            onChange={(event) => setTrainingPurpose(event.target.value)}
            maxLength={200}
            rows={2}
            className="min-h-20 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
            placeholder="例：健康維持，増量，減量"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">最終目標</span>
          <textarea
            value={finalGoal}
            onChange={(event) => setFinalGoal(event.target.value)}
            maxLength={200}
            rows={2}
            className="min-h-20 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
            placeholder="例：ベンチプレス100kg，体脂肪率を下げる"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">1か月目標の期限</span>
          <input
            type="date"
            value={oneMonthGoalDate}
            onChange={(event) => setOneMonthGoalDate(event.target.value)}
            className="min-h-12 w-full min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">1か月目標の内容</span>
          <textarea
            value={oneMonthGoalText}
            onChange={(event) => setOneMonthGoalText(event.target.value)}
            maxLength={200}
            rows={2}
            className="min-h-20 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
            placeholder="例：週3回のペースを作る"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">3か月目標の期限</span>
          <input
            type="date"
            value={threeMonthGoalDate}
            onChange={(event) => setThreeMonthGoalDate(event.target.value)}
            className="min-h-12 w-full min-w-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">3か月目標の内容</span>
          <textarea
            value={threeMonthGoalText}
            onChange={(event) => setThreeMonthGoalText(event.target.value)}
            maxLength={200}
            rows={2}
            className="min-h-20 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
            placeholder="例：フォームを安定させて扱う重量を伸ばす"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">1年目標の期限</span>
          <input
            type="date"
            value={oneYearGoalDate}
            onChange={(event) => setOneYearGoalDate(event.target.value)}
            className="min-h-12 w-full min-w-0 max-w-full appearance-none rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[var(--muted)]">1年目標の内容</span>
          <textarea
            value={oneYearGoalText}
            onChange={(event) => setOneYearGoalText(event.target.value)}
            maxLength={200}
            rows={2}
            className="min-h-20 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
            placeholder="例：継続して体型と筋力を変える"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        <Save size={18} />
        {isSaving ? "保存中" : "保存"}
      </button>
      {message ? <p className="mt-3 text-sm text-emerald-500">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
