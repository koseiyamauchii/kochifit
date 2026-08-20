"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

const heightOptions = Array.from({ length: 91 }, (_, index) => String(130 + index));
const weightOptions = Array.from({ length: 131 }, (_, index) => String(35 + index));
const ageOptions = Array.from({ length: 83 }, (_, index) => String(12 + index));
const setCountOptions = Array.from({ length: 10 }, (_, index) => String(index + 1));
const autosaveDelayMs = 700;
const baseSelectClass = "h-10 w-full min-w-0 rounded-[12px] border border-[var(--border)] form-field-muted bg-[var(--surface-soft)] px-3 text-sm";
const profileSelectClass = "h-11 w-full min-w-0 rounded-[12px] border border-[var(--border)] form-field-muted bg-[var(--surface-soft)] px-3 text-sm";
const blockSelectClass = "h-12 w-full min-w-0 rounded-[12px] border border-[var(--border)] form-field-muted bg-[var(--surface-soft)] px-3 text-sm";
const dateInputClass = "h-11 w-full min-w-0 max-w-full appearance-none rounded-[12px] border border-[var(--border)] form-field-muted bg-[var(--surface-soft)] px-2 text-sm";
const textareaClass = "min-h-20 w-full rounded-[12px] border border-[var(--border)] form-field-muted bg-[var(--surface-soft)] px-3 py-2";

interface ProfileSettingsSnapshot {
  heightCm: string;
  bodyWeightKg: string;
  age: string;
  sex: string;
  trainingSplit: string;
  defaultSetCount: string;
  sessionSortOrder: string;
  trainingPurpose: string;
  finalGoal: string;
  oneMonthGoalDate: string;
  oneMonthGoalText: string;
  threeMonthGoalDate: string;
  threeMonthGoalText: string;
  oneYearGoalDate: string;
  oneYearGoalText: string;
}

function toNumberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSetCount(value: string) {
  return String(Math.min(10, Math.max(1, Math.trunc(Number(value) || 5))));
}

function serializeSnapshot(snapshot: ProfileSettingsSnapshot) {
  return JSON.stringify(snapshot);
}

export function ProfileSettingsCard({ mode = "profile" }: { mode?: "profile" | "goals" }) {
  const { profile, refreshProfile, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [heightCm, setHeightCm] = useState("");
  const [bodyWeightKg, setBodyWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("unspecified");
  const [trainingSplit, setTrainingSplit] = useState("");
  const [defaultSetCount, setDefaultSetCount] = useState("5");
  const [sessionSortOrder, setSessionSortOrder] = useState("asc");
  const [trainingPurpose, setTrainingPurpose] = useState("");
  const [finalGoal, setFinalGoal] = useState("");
  const [oneMonthGoalDate, setOneMonthGoalDate] = useState("");
  const [oneMonthGoalText, setOneMonthGoalText] = useState("");
  const [threeMonthGoalDate, setThreeMonthGoalDate] = useState("");
  const [threeMonthGoalText, setThreeMonthGoalText] = useState("");
  const [oneYearGoalDate, setOneYearGoalDate] = useState("");
  const [oneYearGoalText, setOneYearGoalText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const lastSavedSnapshotRef = useRef("");
  const currentSnapshotKeyRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const hasPendingSaveRef = useRef(false);
  const hasLoadedProfileRef = useRef(false);
  const pendingProfileSnapshotRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  const allowBrowserBackRef = useRef(false);

  const currentSnapshot = useMemo<ProfileSettingsSnapshot>(
    () => ({
      heightCm,
      bodyWeightKg,
      age,
      sex,
      trainingSplit,
      defaultSetCount,
      sessionSortOrder,
      trainingPurpose,
      finalGoal,
      oneMonthGoalDate,
      oneMonthGoalText,
      threeMonthGoalDate,
      threeMonthGoalText,
      oneYearGoalDate,
      oneYearGoalText,
    }),
    [
      age,
      bodyWeightKg,
      defaultSetCount,
      sessionSortOrder,
      finalGoal,
      heightCm,
      oneMonthGoalDate,
      oneMonthGoalText,
      oneYearGoalDate,
      oneYearGoalText,
      sex,
      threeMonthGoalDate,
      threeMonthGoalText,
      trainingPurpose,
      trainingSplit,
    ],
  );
  const currentSnapshotKey = useMemo(() => serializeSnapshot(currentSnapshot), [currentSnapshot]);

  useEffect(() => {
    currentSnapshotKeyRef.current = currentSnapshotKey;
  }, [currentSnapshotKey]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    const nextSnapshot: ProfileSettingsSnapshot = {
      heightCm: profile.height_cm !== null ? String(Math.round(profile.height_cm)) : "",
      bodyWeightKg: profile.body_weight_kg !== null ? String(Math.round(profile.body_weight_kg)) : "",
      age: profile.age !== null ? String(profile.age) : "",
      sex: profile.sex ?? "unspecified",
      trainingSplit: profile.training_split ?? "",
      defaultSetCount: String(profile.default_set_count ?? 5),
      sessionSortOrder: profile.session_sort_order ?? "asc",
      trainingPurpose: profile.training_purpose ?? "",
      finalGoal: profile.final_goal ?? "",
      oneMonthGoalDate: profile.one_month_goal_date ?? "",
      oneMonthGoalText: profile.one_month_goal_text ?? "",
      threeMonthGoalDate: profile.three_month_goal_date ?? "",
      threeMonthGoalText: profile.three_month_goal_text ?? "",
      oneYearGoalDate: profile.one_year_goal_date ?? "",
      oneYearGoalText: profile.one_year_goal_text ?? "",
    };
    setHeightCm(nextSnapshot.heightCm);
    setBodyWeightKg(nextSnapshot.bodyWeightKg);
    setAge(nextSnapshot.age);
    setSex(nextSnapshot.sex);
    setTrainingSplit(nextSnapshot.trainingSplit);
    setDefaultSetCount(nextSnapshot.defaultSetCount);
    setSessionSortOrder(nextSnapshot.sessionSortOrder);
    setTrainingPurpose(nextSnapshot.trainingPurpose);
    setFinalGoal(nextSnapshot.finalGoal);
    setOneMonthGoalDate(nextSnapshot.oneMonthGoalDate);
    setOneMonthGoalText(nextSnapshot.oneMonthGoalText);
    setThreeMonthGoalDate(nextSnapshot.threeMonthGoalDate);
    setThreeMonthGoalText(nextSnapshot.threeMonthGoalText);
    setOneYearGoalDate(nextSnapshot.oneYearGoalDate);
    setOneYearGoalText(nextSnapshot.oneYearGoalText);
    const nextSnapshotKey = serializeSnapshot(nextSnapshot);
    lastSavedSnapshotRef.current = nextSnapshotKey;
    pendingProfileSnapshotRef.current = nextSnapshotKey;
    hasPendingSaveRef.current = false;
    hasLoadedProfileRef.current = true;
    setError(null);
    setSaveMessage(null);
  }, [profile]);

  const save = useCallback(
    async (snapshot: ProfileSettingsSnapshot = currentSnapshot) => {
      if (!user) {
        return;
      }
      const parsedSetCount = normalizeSetCount(snapshot.defaultSetCount);
      const savedSnapshot = { ...snapshot, defaultSetCount: parsedSetCount };
      isSavingRef.current = true;
      setError(null);
      setSaveMessage(null);
      try {
        const { error: updateError } = await client
          .from("profiles")
          .update({
            height_cm: toNumberOrNull(snapshot.heightCm),
            body_weight_kg: toNumberOrNull(snapshot.bodyWeightKg),
            age: toNumberOrNull(snapshot.age),
            sex: snapshot.sex,
            training_split: snapshot.trainingSplit.trim() || null,
            default_set_count: Number(parsedSetCount),
            session_sort_order: snapshot.sessionSortOrder === "desc" ? "desc" : "asc",
            training_purpose: snapshot.trainingPurpose.trim() || null,
            final_goal: snapshot.finalGoal.trim() || null,
            one_month_goal_date: snapshot.oneMonthGoalDate || null,
            one_month_goal_text: snapshot.oneMonthGoalText.trim() || null,
            three_month_goal_date: snapshot.threeMonthGoalDate || null,
            three_month_goal_text: snapshot.threeMonthGoalText.trim() || null,
            one_year_goal_date: snapshot.oneYearGoalDate || null,
            one_year_goal_text: snapshot.oneYearGoalText.trim() || null,
          })
          .eq("id", user.id);

        if (updateError) {
          throw updateError;
        }

        const savedSnapshotKey = serializeSnapshot(savedSnapshot);
        lastSavedSnapshotRef.current = savedSnapshotKey;
        hasPendingSaveRef.current = false;
        if (currentSnapshotKeyRef.current === serializeSnapshot(snapshot) || currentSnapshotKeyRef.current === savedSnapshotKey) {
          if (snapshot.defaultSetCount !== parsedSetCount) {
            setDefaultSetCount(parsedSetCount);
          }
          await refreshProfile();
        }
        setSaveMessage("保存しました。");
      } catch (saveError) {
        console.error("Profile settings save error", saveError);
        setSaveMessage(null);
        setError("プロフィール設定の保存に失敗しました。");
      } finally {
        isSavingRef.current = false;
      }
    },
    [client, currentSnapshot, refreshProfile, user],
  );

  const hasUnsavedChanges = useCallback(() => {
    if (!hasLoadedProfileRef.current) {
      return false;
    }
    if (pendingProfileSnapshotRef.current) {
      return false;
    }
    return currentSnapshotKey !== lastSavedSnapshotRef.current || hasPendingSaveRef.current || isSavingRef.current;
  }, [currentSnapshotKey]);

  const confirmUnsavedNavigation = useCallback(() => {
    if (!hasUnsavedChanges()) {
      return true;
    }
    return window.confirm("保存していない内容があります。保存せず戻りますか？");
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!user || !hasLoadedProfileRef.current) {
      return;
    }
    if (pendingProfileSnapshotRef.current) {
      if (currentSnapshotKey === pendingProfileSnapshotRef.current) {
        pendingProfileSnapshotRef.current = null;
        hasPendingSaveRef.current = false;
      }
      return;
    }
    if (currentSnapshotKey === lastSavedSnapshotRef.current) {
      hasPendingSaveRef.current = false;
      return;
    }
    hasPendingSaveRef.current = true;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      hasPendingSaveRef.current = false;
      void save(currentSnapshot);
    }, autosaveDelayMs);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [currentSnapshot, currentSnapshotKey, save, user]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }
    const timer = window.setTimeout(() => setSaveMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  useEffect(() => {
    const handleNavigationConfirm = (event: Event) => {
      const scope = event instanceof CustomEvent ? event.detail?.scope : undefined;
      if (scope && scope !== "settings" && scope !== "page") {
        return;
      }
      if (!confirmUnsavedNavigation()) {
        event.preventDefault();
      }
    };
    window.addEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
    return () => window.removeEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
  }, [confirmUnsavedNavigation]);

  useEffect(() => {
    if (!hasUnsavedChanges()) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentSnapshotKey, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges()) {
      return;
    }
    window.history.pushState({ kochifitSettingsUnsavedGuard: true }, "", window.location.href);
    const handlePopState = () => {
      if (allowBrowserBackRef.current) {
        return;
      }
      if (confirmUnsavedNavigation()) {
        allowBrowserBackRef.current = true;
        window.history.back();
        return;
      }
      window.history.pushState({ kochifitSettingsUnsavedGuard: true }, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [confirmUnsavedNavigation, currentSnapshotKey, hasUnsavedChanges]);

  return (
    <section className="space-y-4">
      {mode === "profile" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">身長 cm</span>
              <select
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                className={baseSelectClass}
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
                className={baseSelectClass}
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
                className={profileSelectClass}
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
                className={profileSelectClass}
              >
                <option value="unspecified">未設定</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">分割法</span>
            <select
              value={trainingSplit}
              onChange={(event) => setTrainingSplit(event.target.value)}
              className={blockSelectClass}
            >
              <option value="">未設定</option>
              <option value="full_body">全身</option>
              <option value="upper_lower">上半身・下半身</option>
              <option value="push_pull_legs">Push・Pull・Legs</option>
              <option value="body_part_split">部位別</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">デフォルトセット数</span>
            <select
              value={defaultSetCount}
              onChange={(event) => setDefaultSetCount(event.target.value)}
              className={blockSelectClass}
            >
              {setCountOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">同日のセッション表示順</span>
            <select
              value={sessionSortOrder}
              onChange={(event) => setSessionSortOrder(event.target.value)}
              className={blockSelectClass}
            >
              <option value="asc">古い順</option>
              <option value="desc">新しい順</option>
            </select>
          </label>
        </>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">目的</span>
            <textarea
              value={trainingPurpose}
              onChange={(event) => setTrainingPurpose(event.target.value)}
              maxLength={200}
              rows={2}
              className={textareaClass}
              placeholder="例：健康維持、増量、減量"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--muted)]">最終目標</span>
            <textarea
              value={finalGoal}
              onChange={(event) => setFinalGoal(event.target.value)}
              maxLength={200}
              rows={2}
              className={textareaClass}
              placeholder="例：ベンチプレス100kg、体脂肪率を下げる"
            />
          </label>
          <div className="space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-2">
              <h3 className="text-sm font-semibold">1か月目標</h3>
              <span className="text-xs font-medium text-[var(--muted)]">期限つき</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">内容</span>
              <textarea
                value={oneMonthGoalText}
                onChange={(event) => setOneMonthGoalText(event.target.value)}
                maxLength={200}
                rows={2}
                className={textareaClass}
                placeholder="例：週3回のペースを作る"
              />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">期限</span>
              <input
                type="date"
                value={oneMonthGoalDate}
                onChange={(event) => setOneMonthGoalDate(event.target.value)}
                className={dateInputClass}
              />
            </label>
          </div>
          <div className="space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-2">
              <h3 className="text-sm font-semibold">3か月目標</h3>
              <span className="text-xs font-medium text-[var(--muted)]">期限つき</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">内容</span>
              <textarea
                value={threeMonthGoalText}
                onChange={(event) => setThreeMonthGoalText(event.target.value)}
                maxLength={200}
                rows={2}
                className={textareaClass}
                placeholder="例：フォームを安定させて扱う重量を伸ばす"
              />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">期限</span>
              <input
                type="date"
                value={threeMonthGoalDate}
                onChange={(event) => setThreeMonthGoalDate(event.target.value)}
                className={dateInputClass}
              />
            </label>
          </div>
          <div className="space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-2">
              <h3 className="text-sm font-semibold">1年目標</h3>
              <span className="text-xs font-medium text-[var(--muted)]">期限つき</span>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">内容</span>
              <textarea
                value={oneYearGoalText}
                onChange={(event) => setOneYearGoalText(event.target.value)}
                maxLength={200}
                rows={2}
                className={textareaClass}
                placeholder="例：継続して体型と筋力を変える"
              />
            </label>
            <label className="block min-w-0 space-y-1">
              <span className="text-sm font-medium text-[var(--muted)]">期限</span>
              <input
                type="date"
                value={oneYearGoalDate}
                onChange={(event) => setOneYearGoalDate(event.target.value)}
                className={dateInputClass}
              />
            </label>
          </div>
        </div>
      )}
      {saveMessage ? <p className="mt-3 text-sm font-medium text-teal-500">{saveMessage}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
