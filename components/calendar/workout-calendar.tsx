"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getBodyPartColor } from "@/lib/workouts/body-part-colors";
import { addMonths, getCalendarCells, getCalendarRange, startOfMonth, toDateKey } from "@/lib/workouts/date";
import {
  readWorkoutDraft,
  shouldConfirmWorkoutClose,
  workoutDraftKey,
  writeWorkoutDraft,
} from "@/lib/workouts/draft-storage";
import {
  appendHistoryRecords,
  createWorkout,
  deleteWorkout,
  EXERCISE_HISTORY_PAGE_SIZE,
  getBodyParts,
  getExerciseRecords,
  getExercises,
  getExerciseWeightRecords,
  getLatestWorkoutForExerciseBeforeDate,
  getWorkoutsByDate,
  getWorkoutsForExercise,
  getWorkoutSummaries,
  updateWorkout,
  updateWorkoutExerciseConditions,
} from "@/lib/workouts/repository";
import type {
  BodyPart,
  Exercise,
  ExerciseRecord,
  Workout,
  WorkoutExercise,
  WorkoutSummary,
} from "@/lib/workouts/types";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clampDefaultSetCount,
  createDraftFromWorkout,
  createSetDrafts,
  EntryDraft,
  estimateDraftCalories,
  findExercise,
  getDraftElapsedSec,
  hasAnySetInput,
  isBlankSetDraft,
  isEntryDraft,
  parseDateKey,
  toSetInputs,
} from "@/lib/workouts/entry-draft";
import { WorkoutEntryForm, WorkoutReadOnlyCard } from "./workout-entry-form";
import { ScreenshotButton } from "@/components/screenshot-button";
const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
interface WorkoutCalendarProps {
  backHref?: string;
  detailsHeading?: string;
  showCalendar?: boolean;
  showWorkoutDetails?: boolean;
  selectedDateOverride?: string;
  showAddForm?: boolean;
  exerciseFilterId?: string;
  exerciseHistoryId?: string;
}

export function WorkoutCalendar({
  backHref,
  detailsHeading,
  exerciseFilterId,
  exerciseHistoryId,
  showCalendar = true,
  showWorkoutDetails = true,
  selectedDateOverride,
  showAddForm: initialShowAddForm = false,
}: WorkoutCalendarProps) {
  const captureRef = useRef<HTMLElement>(null);
  const [showAddForm, setShowAddForm] = useState(initialShowAddForm);
  const addFormRef = useRef<HTMLDivElement>(null);
  const { user, authStatus, profile, profileStatus } = useAuth();
  const todayKey = toDateKey(new Date());
  const defaultSetCount = clampDefaultSetCount(profile?.default_set_count);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => selectedDateOverride ?? todayKey);
  const effectiveSelectedDate = selectedDateOverride ?? selectedDate;
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [summaries, setSummaries] = useState<WorkoutSummary[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [previousWorkout, setPreviousWorkout] = useState<WorkoutExercise | null>(null);
  const [editPreviousWorkouts, setEditPreviousWorkouts] = useState<Record<string, WorkoutExercise | null>>({});
  const [selectedBodyPartId, setSelectedBodyPartId] = useState<string>("all");
  const [addDraft, setAddDraft] = useState<EntryDraft>(() => ({
    exerciseId: "",
    note: "",
    condition: "",
    elapsedSec: null,
    startedAt: null,
    lastSetInputAt: null,
    sets: createSetDrafts(5),
  }));
  const [editDrafts, setEditDrafts] = useState<Record<string, EntryDraft>>({});
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingBaseline, setEditingBaseline] = useState<string | null>(null);
  const [dayConditionDraft, setDayConditionDraft] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [draftReadyKey, setDraftReadyKey] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const leavingPage = useRef(false);
  const previousRequest = useRef(0);
  const [draftStorageError, setDraftStorageError] = useState<string | null>(null);
  const saveInFlight = useRef(false);
  const confirmUnsavedNavigationRef = useRef<(() => boolean) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthRequest = useRef(0);
  const detailRequest = useRef(0);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const historyPage = useRef(0);
  const historyMoreInFlight = useRef(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState<"refresh" | "more" | null>(null);

  const router = useRouter();
  const client = useMemo(() => createClient(), []);
  const addStorageKey = user ? workoutDraftKey(user.id, effectiveSelectedDate) : null;
  const activeStorageKey = showAddForm ? addStorageKey : user && editingWorkoutId
    ? workoutDraftKey(user.id, effectiveSelectedDate, editingWorkoutId) : null;
  const activeLocalDraft = showAddForm ? addDraft : editingWorkoutId ? editDrafts[editingWorkoutId] : null;
  const activeDraftSnapshot = activeStorageKey && activeLocalDraft ? activeStorageKey + JSON.stringify(activeLocalDraft) : "";

  useEffect(() => {
    if (!showAddForm || !addStorageKey) return;
    setDraftStorageError(null);
    try {
      const saved = readWorkoutDraft(window.localStorage, addStorageKey, isEntryDraft);
      const value = saved?.value ?? { exerciseId: "", note: "", condition: "", elapsedSec: null, startedAt: null, lastSetInputAt: null, sets: createSetDrafts(defaultSetCount) };
      setAddDraft(value);
      setDraftReadyKey(addStorageKey);
    } catch {
      setDraftReadyKey(null);
      setDraftStorageError("下書きを読み込めません。元の下書きは残しています。確定前に内容を確認してください。");
    }
    // Profile refresh must not reset a restored draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addStorageKey, showAddForm]);

  useEffect(() => {
    if (leavingPage.current || !activeStorageKey || !activeLocalDraft || savingKey || draftStorageError ||
      (showAddForm && draftReadyKey !== activeStorageKey)) return;
    try {
      if (activeLocalDraft.exerciseId) {
        writeWorkoutDraft(window.localStorage, activeStorageKey, activeLocalDraft, showAddForm ? null : editingBaseline);
      }
    } catch {
      setDraftStorageError("端末への下書き保存に失敗しました。閉じる前にチェックで記録を確定してください。");
    }
  }, [activeDraftSnapshot, activeLocalDraft, activeStorageKey, draftReadyKey, draftStorageError, editingBaseline, savingKey, showAddForm]);

  const clearLocalDraft = useCallback((key: string | null) => {
    if (!key) return;
    try { window.localStorage.removeItem(key); } catch { /* Cleanup failure must not resubmit a confirmed record. */ }
  }, []);

  const calendarPages = useMemo(
    () =>
      [-1, 0, 1].map((offset) => {
        const pageMonth = addMonths(month, offset);
        return {
          key: `${pageMonth.getFullYear()}-${pageMonth.getMonth()}`,
          month: pageMonth,
          cells: getCalendarCells(pageMonth),
        };
      }),
    [month],
  );
  const summariesByDate = useMemo(
    () => new Map(summaries.map((summary) => [summary.workoutDate, summary])),
    [summaries],
  );
  const isAddFormActive = showAddForm;
  const totalCalories = useMemo(() => {
    const addCalories = isAddFormActive ? estimateDraftCalories(addDraft, exercises, profile) : 0;
    const savedCalories = Object.values(editDrafts).reduce(
      (total, draft) => total + estimateDraftCalories(draft, exercises, profile),
      0,
    );
    return addCalories + savedCalories;
  }, [addDraft, editDrafts, exercises, isAddFormActive, profile]);
  const isAddDraftDirty = showAddForm && (shouldConfirmWorkoutClose(addDraft.exerciseId, addDraft.sets) || Boolean(addDraft.note.trim()));
  const editingExerciseId = editingWorkoutId ? (editDrafts[editingWorkoutId]?.exerciseId ?? "") : "";
  const isEditDraftDirty = Boolean(
    editingWorkoutId &&
    editingBaseline &&
    JSON.stringify(editDrafts[editingWorkoutId]) !== editingBaseline,
  );
  const hasUnprotectedDraft = isAddDraftDirty || isEditDraftDirty;
  const resolvedDetailsHeading = exerciseHistoryId
    ? `${findExercise(exercises, exerciseHistoryId)?.name ?? "種目"}の記録履歴`
    : detailsHeading;
  const displayWorkouts = useMemo(() => {
    if (exerciseHistoryId) return workouts;
    const ascending = [...workouts].sort((a, b) =>
      exerciseHistoryId
        ? a.workoutDate.localeCompare(b.workoutDate) || a.createdAt.localeCompare(b.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );
    const filtered = exerciseFilterId
      ? ascending.flatMap((workout) => {
          const matchingExercises = workout.exercises.filter(
            (exercise) => exercise.exerciseId === exerciseFilterId,
          );
          return matchingExercises.length > 0
            ? [{ ...workout, exercises: matchingExercises }]
            : [];
        })
      : ascending;
    return profile?.session_sort_order === "asc" ? filtered : filtered.reverse();
  }, [exerciseFilterId, exerciseHistoryId, profile?.session_sort_order, workouts]);
  const savedDayCondition = useMemo(() => {
    return workouts[0]?.dayCondition ?? "";
  }, [workouts]);
  const isDayConditionDirty = dayConditionDraft.trim() !== savedDayCondition;
  const sessionNumberByWorkoutId = useMemo(
    () => new Map(
      [...workouts]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((workout, index) => [workout.id, index + 1]),
    ),
    [workouts],
  );

  useEffect(() => {
    setDayConditionDraft(savedDayCondition);
  }, [effectiveSelectedDate, savedDayCondition]);

  const loadMonth = useCallback(async () => {
    if (!user || !showCalendar) {
      return;
    }
    const request = ++monthRequest.current;
    const range = getCalendarRange(month);
    setSummaries([]);
    const nextSummaries = await getWorkoutSummaries(
      client, range.start, range.end, false,
    );
    if (monthRequest.current === request) {
      setSummaries(nextSummaries);
    }
  }, [client, month, showCalendar, user]);

  const loadSelectedDate = useCallback(async () => {
    if (!user || !showWorkoutDetails) {
      return;
    }
    setDetailsLoading(true);
    setHistoryLoadError(null);
    const request = ++detailRequest.current;
    try {
      if (exerciseHistoryId) {
        const pages = await Promise.all(Array.from({ length: historyPage.current + 1 }, (_, page) =>
          getWorkoutsForExercise(client, exerciseHistoryId, page)));
        if (detailRequest.current !== request) return;
        const records = pages.flatMap(page => page.workouts);
        setWorkouts(records);
        historyPage.current = Math.max(0, Math.ceil(records.length / EXERCISE_HISTORY_PAGE_SIZE) - 1);
        setHistoryHasMore(pages[pages.length - 1].hasMore);
        setError(null);
      } else {
        const nextWorkouts = await getWorkoutsByDate(client, effectiveSelectedDate);
        if (detailRequest.current === request) setWorkouts(nextWorkouts);
      }
    } catch (error) {
      if (detailRequest.current === request) setHistoryLoadError("refresh");
      throw error;
    } finally {
      if (detailRequest.current === request) setDetailsLoading(false);
    }
  }, [client, effectiveSelectedDate, exerciseHistoryId, showWorkoutDetails, user]);

  const loadMoreHistory = async () => {
    if (!exerciseHistoryId || detailsLoading || savingKey || historyMoreInFlight.current) return;
    historyMoreInFlight.current = true;
    setDetailsLoading(true);
    setHistoryLoadError(null);
    const request = ++detailRequest.current;
    try {
      const next = historyPage.current + 1;
      const page = await getWorkoutsForExercise(client, exerciseHistoryId, next);
      if (detailRequest.current !== request) return;
      setWorkouts(current => appendHistoryRecords(current, page.workouts));
      historyPage.current = next;
      setHistoryHasMore(page.hasMore);
      setError(null);
    } catch {
      if (detailRequest.current === request) setHistoryLoadError("more");
    } finally {
      historyMoreInFlight.current = false;
      if (detailRequest.current === request) setDetailsLoading(false);
    }
  };

  useEffect(() => {
    setEditDrafts((current) => {
      const next: Record<string, EntryDraft> = {};
      for (const workout of workouts) {
        const exercise = workout.exercises[0];
        if (exercise) {
          next[workout.id] = workout.id === editingWorkoutId && current[workout.id]
            ? current[workout.id]
            : createDraftFromWorkout(exercise, findExercise(exercises, exercise.exerciseId)?.cardioUnits);
        }
      }
      return next;
    });
  }, [editingWorkoutId, exercises, workouts]);

  const loadPreviousWorkout = useCallback(async () => {
    const request = ++previousRequest.current;
    setPreviousWorkout(null);
    if (!user || !addDraft.exerciseId) {
      setPreviousWorkout(null);
      return;
    }
    const previous = await getLatestWorkoutForExerciseBeforeDate(client, addDraft.exerciseId, effectiveSelectedDate);
    if (request === previousRequest.current) setPreviousWorkout(previous);
  }, [addDraft.exerciseId, client, effectiveSelectedDate, user]);

  const loadEditPreviousWorkout = useCallback(
    async (workoutId: string, exerciseId: string) => {
      if (!user || !exerciseId) {
        setEditPreviousWorkouts((current) => ({ ...current, [workoutId]: null }));
        return;
      }
      const reference = workouts.find(workout => workout.id === workoutId);
      if (!reference) return;
      const latest = await getLatestWorkoutForExerciseBeforeDate(client, exerciseId, reference.workoutDate, reference);
      setEditPreviousWorkouts((current) => ({ ...current, [workoutId]: latest }));
    },
    [client, user, workouts],
  );
  const loadBaseData = useCallback(async () => {
    if (!user || !showWorkoutDetails) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [nextBodyParts, nextExercises] = await Promise.all([
        getBodyParts(client),
        getExercises(client),
      ]);
      setBodyParts(nextBodyParts);
      setExercises(nextExercises);
    } catch (loadError) {
      console.error("Workout data load error", loadError);
      setError("トレーニングデータの読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [client, showWorkoutDetails, user]);

  useEffect(() => {
    if (!user || !showWorkoutDetails || profileStatus !== "ready") {
      return;
    }
    let active = true;
    const ids = new Set([
      ...(showAddForm ? [addDraft.exerciseId] : []),
      ...workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.exerciseId)),
    ]);
    const selected = exercises.filter((exercise) => ids.has(exercise.id));
    setExerciseRecords([]);
    if (selected.length > 0) {
      void (exerciseHistoryId ? getExerciseWeightRecords(client, selected) : getExerciseRecords(client, selected)).then((records) => {
        if (active) setExerciseRecords(records);
      }).catch((recordError) => {
        if (active) {
          console.error("Exercise record load error", recordError);
          setError("最高記録の読み込みに失敗しました。");
        }
      });
    }
    return () => { active = false; };
  }, [addDraft.exerciseId, client, exercises, exerciseHistoryId, profileStatus, showAddForm, showWorkoutDetails, user, workouts]);

  useEffect(() => {
    if (selectedDateOverride) {
      setSelectedDate(selectedDateOverride);
    }
  }, [selectedDateOverride]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadBaseData();
    }
  }, [authStatus, loadBaseData, profileStatus]);

  useEffect(() => {
    const handleMasterDataChange = () => {
      if (authStatus === "authenticated" && profileStatus === "ready") {
        void loadBaseData();
      }
    };
    window.addEventListener("kochifit:master-data-changed", handleMasterDataChange);
    return () => window.removeEventListener("kochifit:master-data-changed", handleMasterDataChange);
  }, [authStatus, loadBaseData, profileStatus]);
  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadMonth().catch((loadError) => {
        console.error("Workout summary load error", loadError);
        setError("カレンダーの読み込みに失敗しました。");
      });
    }
  }, [authStatus, loadMonth, profileStatus]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadSelectedDate().catch((loadError) => {
        console.error("Workout detail load error", loadError);
        setError("選択日の記録読み込みに失敗しました。");
      });
    }
  }, [authStatus, loadSelectedDate, profileStatus]);

  useEffect(() => {
    if (!savedFeedback) return;
    const timer = window.setTimeout(() => setSavedFeedback(false), 2000);
    return () => window.clearTimeout(timer);
  }, [savedFeedback]);

  useEffect(() => {
    if (authStatus === "authenticated" && profileStatus === "ready") {
      void loadPreviousWorkout().catch((loadError) => {
        console.error("Previous workout load error", loadError);
        setPreviousWorkout(null);
      });
    }
  }, [authStatus, loadPreviousWorkout, profileStatus]);

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      profileStatus !== "ready" ||
      !editingWorkoutId ||
      !editingExerciseId
    ) {
      return;
    }
    void loadEditPreviousWorkout(editingWorkoutId, editingExerciseId).catch((loadError) => {
      console.error("Previous edit workout load error", loadError);
      setEditPreviousWorkouts((current) => ({ ...current, [editingWorkoutId]: null }));
    });
  }, [authStatus, editingExerciseId, editingWorkoutId, loadEditPreviousWorkout, profileStatus]);
  useEffect(() => {
    setAddDraft((current) => {
      if (current.sets.every(isBlankSetDraft)) {
        return { ...current, sets: createSetDrafts(defaultSetCount) };
      }
      return current;
    });
  }, [defaultSetCount]);

  useEffect(() => {
    if (isLoading || exercises.length === 0 || selectedBodyPartId === "all") return;
    const filteredExercises =
      selectedBodyPartId === "all"
        ? exercises
        : exercises.filter((exercise) => exercise.bodyPartId === selectedBodyPartId);
    if (addDraft.exerciseId && !filteredExercises.some((exercise) => exercise.id === addDraft.exerciseId)) {
      setAddDraft((current) => ({
        ...current,
        exerciseId: "",
      }));
    }
  }, [addDraft.exerciseId, exercises, isLoading, selectedBodyPartId]);

  const moveMonth = (delta: number) => setMonth((current) => addMonths(current, delta));
  const monthPickerDateKey = toDateKey(month);
  const jumpCalendarToDate = (dateKey: string) => {
    const nextDate = parseDateKey(dateKey);
    if (!nextDate) {
      return;
    }
    setMonth(startOfMonth(nextDate));
    setSelectedDate(dateKey);
  };
  const jumpToToday = () => jumpCalendarToDate(todayKey);
  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    if (!showWorkoutDetails) {
      router.push(`/today?date=${dateKey}`);
    }
  };

  const handleAddSave = useCallback(async () => {
    if (!user || !addDraft.exerciseId || savingKey || saveInFlight.current) {
      return;
    }
    if (!hasAnySetInput(addDraft, profile)) {
      return;
    }

    saveInFlight.current = true;
    setSavingKey("add");
    setError(null);
    try {
      await createWorkout(client, {
        userId: user.id,
        workoutDate: effectiveSelectedDate,
        exerciseId: addDraft.exerciseId,
        note: addDraft.note.trim() || null,
        condition: dayConditionDraft.trim() || null,
        elapsedSec: getDraftElapsedSec(addDraft),
        sets: toSetInputs(
          addDraft.sets,
          profile,
          findExercise(exercises, addDraft.exerciseId)?.cardioUnits,
          findExercise(exercises, addDraft.exerciseId)?.bilateralRepsEnabled,
        ),
      });
      clearLocalDraft(addStorageKey);
      setAddDraft({
        exerciseId: "",
        note: "",
        condition: "",
        elapsedSec: null,
        startedAt: null,
        lastSetInputAt: null,
        sets: createSetDrafts(defaultSetCount),
      });
      setPreviousWorkout(null);
      setShowAddForm(false);
      setSavedFeedback(true);
      await Promise.all([loadMonth(), loadSelectedDate()]).catch(() => {
        setError("保存は完了しましたが、一覧を更新できませんでした。再読み込みしてください。");
      });
    } catch (saveError) {
      console.error("Workout save error", saveError);
      setError("トレーニングの保存に失敗しました。入力値を確認してください。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  }, [
    addDraft,
    dayConditionDraft,
    addStorageKey,
    clearLocalDraft,
    client,
    defaultSetCount,
    effectiveSelectedDate,
    exercises,
    loadMonth,
    loadSelectedDate,
    profile,
    savingKey,
    user,
  ]);

  const confirmUnsavedNavigation = useCallback(() => {
    if (savingKey) return false;
    if (!hasUnprotectedDraft && !isDayConditionDirty) {
      return true;
    }
    return window.confirm("保存していない内容があります。保存せず戻りますか？");
  }, [hasUnprotectedDraft, isDayConditionDirty, savingKey]);

  useEffect(() => {
    confirmUnsavedNavigationRef.current = confirmUnsavedNavigation;
  }, [confirmUnsavedNavigation]);

  const handleBackNavigation = useCallback(() => {
    if (!backHref) {
      return;
    }
    if ((confirmUnsavedNavigationRef.current ?? confirmUnsavedNavigation)()) {
      leavingPage.current = true;
      clearLocalDraft(activeStorageKey);
      router.push(backHref);
    }
  }, [activeStorageKey, backHref, clearLocalDraft, confirmUnsavedNavigation, router]);

  useEffect(() => {
    if (!hasUnprotectedDraft && !isDayConditionDirty) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnprotectedDraft, isDayConditionDirty]);

  useEffect(() => {
    if (!hasUnprotectedDraft && !isDayConditionDirty) {
      return;
    }
    const handleNavigationConfirm = (event: Event) => {
      const scope = event instanceof CustomEvent ? event.detail?.scope : undefined;
      if (scope && scope !== "page") {
        return;
      }
      if (!confirmUnsavedNavigation()) {
        event.preventDefault();
      }
    };
    window.addEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
    return () => window.removeEventListener("kochifit:confirm-navigation", handleNavigationConfirm);
  }, [confirmUnsavedNavigation, hasUnprotectedDraft, isDayConditionDirty]);

  useEffect(() => {
    if ((!hasUnprotectedDraft && !isDayConditionDirty) || !backHref) {
      return;
    }
    window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    const handlePopState = () => {
      if ((confirmUnsavedNavigationRef.current ?? confirmUnsavedNavigation)()) {
        leavingPage.current = true;
        clearLocalDraft(activeStorageKey);
        router.push(backHref);
        return;
      }
      window.history.pushState({ kochifitUnsavedGuard: true }, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeStorageKey, backHref, clearLocalDraft, confirmUnsavedNavigation, hasUnprotectedDraft, isDayConditionDirty, router]);

  const handleDayConditionSave = async () => {
    if (!user || savingKey || saveInFlight.current || workouts.length === 0) {
      return;
    }
    const workoutExerciseIds = workouts.flatMap((workout) =>
      workout.exercises.map((exercise) => exercise.id),
    );
    const activeEditDraft = editingWorkoutId ? editDrafts[editingWorkoutId] : null;
    const activeEditWasClean = Boolean(
      activeEditDraft && editingBaseline && JSON.stringify(activeEditDraft) === editingBaseline,
    );
    saveInFlight.current = true;
    setSavingKey("day-condition");
    setError(null);
    try {
      const nextCondition = dayConditionDraft.trim() || null;
      await updateWorkoutExerciseConditions(client, user.id, workoutExerciseIds, nextCondition);
      setWorkouts((current) => current.map((workout) => ({
        ...workout,
        dayCondition: nextCondition ?? "",
        exercises: workout.exercises.map((exercise) => ({
          ...exercise,
          condition: nextCondition,
        })),
      })));
      setEditDrafts((current) => Object.fromEntries(
        Object.entries(current).map(([workoutId, draft]) => [
          workoutId,
          { ...draft, condition: nextCondition ?? "" },
        ]),
      ));
      if (activeEditDraft && activeEditWasClean) {
        setEditingBaseline(JSON.stringify({
          ...activeEditDraft,
          condition: nextCondition ?? "",
        }));
      }
    } catch (conditionError) {
      console.error("Workout condition update error", conditionError);
      setError("体調・コンディションの保存に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };

  const handleEditSave = async (workout: Workout) => {
    if (!user || savingKey || saveInFlight.current) {
      return;
    }
    const workoutExercise = workout.exercises[0];
    const draft = editDrafts[workout.id];
    if (!workoutExercise || !draft) {
      return;
    }
    if (!hasAnySetInput(draft, profile)) {
      setError("重量または回数を入力してください。");
      return;
    }

    saveInFlight.current = true;
    setSavingKey(workout.id);
    setError(null);
    try {
      await updateWorkout(client, {
        userId: user.id,
        workoutId: workout.id,
        workoutExerciseId: workoutExercise.id,
        workoutDate: workout.workoutDate,
        exerciseId: draft.exerciseId,
        note: draft.note.trim() || null,
        condition: draft.condition.trim() || null,
        elapsedSec: draft.elapsedSec,
        sets: toSetInputs(
          draft.sets,
          profile,
          findExercise(exercises, draft.exerciseId)?.cardioUnits,
          findExercise(exercises, draft.exerciseId)?.bilateralRepsEnabled,
        ),
      });
      clearLocalDraft(activeStorageKey);
      setEditingWorkoutId(null);
      setEditingBaseline(null);
      setSavedFeedback(true);
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]).catch(() => {
        setError("保存は完了しましたが、一覧を更新できませんでした。再読み込みしてください。");
      });
    } catch (saveError) {
      console.error("Workout update error", saveError);
      setError("トレーニングの更新に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };

  const handleDelete = async (workoutId: string) => {
    if (!window.confirm("この記録を削除しますか？")) {
      return;
    }
    setSavingKey(workoutId);
    setError(null);
    try {
      await deleteWorkout(client, workoutId);
      if (user) clearLocalDraft(workoutDraftKey(user.id, effectiveSelectedDate, workoutId));
      await Promise.all([loadMonth(), loadSelectedDate(), loadPreviousWorkout()]);
      setEditingWorkoutId(null);
      setEditingBaseline(null);
    } catch (deleteError) {
      console.error("Workout delete error", deleteError);
      setError("トレーニングの削除に失敗しました。");
    } finally {
      saveInFlight.current = false;
      setSavingKey(null);
    }
  };
  const isSwipeNavigationEnabled = showCalendar;
  const dragOffset = touchStartX === null || !isSwipeNavigationEnabled ? 0 : Math.max(-280, Math.min(280, touchDeltaX));

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (!isSwipeNavigationEnabled) {
      return;
    }
    setTouchStartX(event.touches[0]?.clientX ?? null);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || !isSwipeNavigationEnabled) {
      return;
    }
    const currentX = event.touches[0]?.clientX ?? touchStartX;
    setTouchDeltaX(currentX - touchStartX);
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || !isSwipeNavigationEnabled) {
      return;
    }
    const delta = touchDeltaX || (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(delta) > 50) {
      moveMonth(delta > 0 ? -1 : 1);
    }
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  const handleTouchCancel = () => {
    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  const swipeHandlers = isSwipeNavigationEnabled
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
      }
    : {};

  const draftNotice = draftStorageError ? <p role="alert" className="px-3 py-2 text-xs text-[var(--warning)]">{draftStorageError}</p> : null;
  const canAdd = !showCalendar && !exerciseHistoryId;
  const addAtBottom = profile?.session_sort_order === "asc";
  const openAddForm = () => {
    if (savingKey || detailsLoading || isLoading) return;
    if (isEditDraftDirty && !window.confirm("編集中の変更を破棄して、新しい記録を追加しますか？")) return;
    if (editingWorkoutId) clearLocalDraft(activeStorageKey);
    setEditingWorkoutId(null);
    setEditingBaseline(null);
    setShowAddForm(true);
    window.setTimeout(() => addFormRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 0);
  };
  const addSlot = canAdd ? <div ref={addFormRef} role="region" aria-label="記録の追加" data-screenshot-exclude className="scroll-mt-4 space-y-3">
    {showAddForm ? <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">新しい記録</h2>
        <div className="flex gap-2">
          <button type="button" aria-label="記録入力を閉じる" disabled={Boolean(savingKey)} className="ui-icon-button" onClick={() => {
            if (isAddDraftDirty && !window.confirm("入力中の記録を破棄して閉じますか？")) return;
            clearLocalDraft(addStorageKey);
            setShowAddForm(false);
          }}><X size={20} /></button>
          <button type="button" aria-label="記録を保存" disabled={!addDraft.exerciseId || !hasAnySetInput(addDraft, profile) || Boolean(savingKey) || detailsLoading} className="ui-icon-button text-white disabled:opacity-40" style={{ background: "var(--accent)" }} onClick={() => void handleAddSave()}><Check size={20} /></button>
        </div>
      </div>
      <WorkoutEntryForm bodyParts={bodyParts} defaultSetCount={defaultSetCount} draft={addDraft} draftNotice={draftNotice}
        exerciseRecords={exerciseRecords} exercises={exercises} historyReturnHref={`/today?date=${effectiveSelectedDate}&add=1`}
        isSaving={Boolean(savingKey) || detailsLoading || isLoading} masterReturnHref={`/today?date=${effectiveSelectedDate}&add=1`} mode="add"
        onDraftChange={setAddDraft} onSave={() => void handleAddSave()} previousWorkout={previousWorkout} profile={profile}
        selectedBodyPartId={selectedBodyPartId} setSelectedBodyPartId={setSelectedBodyPartId} />
    </> : <button type="button" disabled={detailsLoading || isLoading || Boolean(savingKey)} onClick={openAddForm}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--surface-soft)] text-sm font-medium disabled:opacity-40"><Plus size={18} />記録を追加</button>}
  </div> : null;

  return (
    <div {...swipeHandlers}>
      {showCalendar ? (
        <>
          <div className="mb-4 flex min-h-10 items-center justify-between gap-2">
            <label className="relative flex min-h-10 min-w-0 cursor-pointer items-center rounded-[12px] text-base font-semibold tracking-tight sm:text-lg">
              <span className="whitespace-nowrap">
                {month.getFullYear()}年{month.getMonth() + 1}月
              </span>
              <input
                type="date"
                value={monthPickerDateKey}
                onChange={(event) => jumpCalendarToDate(event.target.value)}
                aria-label="表示する日付を選択"
                className="absolute inset-0 w-full min-w-0 cursor-pointer opacity-0"
              />
            </label>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={jumpToToday}
              aria-label="今日へ戻る"
              className="ui-today-button text-sm font-semibold"
            >
              今日
            </button>
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="前月"
              className="ui-icon-button text-[var(--muted)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="翌月"
              className="ui-icon-button text-[var(--muted)]"
            >
              <ChevronRight size={19} />
            </button>
            </div>
          </div>

          <div className="overflow-hidden">
            <div
              className={[
                "flex will-change-transform",
                touchStartX === null ? "transition-transform duration-200 ease-out" : "transition-none",
              ].join(" ")}
              style={{ transform: `translateX(calc(-100% + ${dragOffset}px))` }}
            >
              {calendarPages.map((page) => (
                <div
                  key={page.key}
                  className="grid w-full shrink-0 grid-cols-7 justify-items-center gap-y-1.5 text-center"
                >
                  {weekdays.map((weekday) => (
                    <div key={weekday} className="pb-2 text-[11px] font-medium text-[var(--muted)]">
                      {weekday}
                    </div>
                  ))}
                  {page.cells.map((cell) => {
                    const summary = summariesByDate.get(cell.dateKey);
                    const isToday = cell.dateKey === todayKey;
                    const isSelected = cell.dateKey === effectiveSelectedDate;
                    const summaryBodyParts = summary?.bodyParts.slice(0, 7) ?? [];
                    return (
                      <div key={`${page.key}-${cell.dateKey}`} className="relative flex h-11 w-full items-start justify-center pt-0.5">
                        <button type="button" onClick={() => handleDateClick(cell.dateKey)} aria-label={cell.dateKey}
                          aria-current={isToday ? "date" : undefined}
                          className={[
                            "calendar-day flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                            !cell.isCurrentMonth ? "opacity-40" : "",
                            isToday ? "accent-orb text-white" : isSelected ? "bg-[var(--surface-soft)]" : "",
                          ].join(" ")}>{cell.day}</button>
                        {summaryBodyParts.length > 0 ? (
                          <span
                            className={[
                              "pointer-events-none absolute bottom-0 flex max-w-8 flex-wrap justify-center gap-0.5",
                              cell.isCurrentMonth ? "" : "opacity-60",
                            ].join(" ")}
                          >
                            {summaryBodyParts.map((bodyPart) => {
                              const color = getBodyPartColor(bodyPart.key, bodyPart.colorKey);
                              return (
                                <span
                                  key={bodyPart.key}
                                  aria-hidden="true"
                                  className="color-orb h-1.5 w-1.5 rounded-full"
                                  style={{ "--color-orb": color } as CSSProperties}
                                />
                              );
                            })}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <Link
            href={`/today?date=${todayKey}&add=1`}
            aria-label="今日のトレーニングを追加"
            className="ui-fab"
          >
            <Plus size={22} />
          </Link>
        </>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[12px] border border-[var(--warning)] px-3 py-2 text-sm text-[var(--warning)]">
          {error}
        </div>
      ) : null}

      {showWorkoutDetails ? (
      <section ref={captureRef} className={[!showCalendar && detailsHeading ? "mt-0" : "mt-5", "space-y-3"].join(" ")}>

        {!showCalendar && detailsHeading ? <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {backHref ? <button type="button" data-screenshot-exclude onClick={handleBackNavigation} aria-label="戻る" className="ui-icon-button shrink-0"><ChevronLeft size={22} /></button> : null}
            <h1 className="min-w-0 text-base font-semibold">{resolvedDetailsHeading}</h1>
          </div>
          {!exerciseHistoryId ? <span className="shrink-0 rounded-xl bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--muted)]">合計 約{totalCalories}kcal</span> : null}
        </div> : null}

        {savedFeedback ? <p role="status" data-screenshot-exclude className="text-sm text-emerald-500">保存しました。</p> : null}

        {!showCalendar && !exerciseHistoryId && !detailsLoading ? <ScreenshotButton targetRef={captureRef} filename={`KochiFit_${effectiveSelectedDate}.png`} disabled={isLoading || Boolean(error) || workouts.length === 0 || Boolean(editingWorkoutId) || showAddForm || isDayConditionDirty} /> : null}
        {!showCalendar && !exerciseHistoryId && !detailsLoading ? (
          <section className="rounded-[12px] bg-[var(--surface-soft)] px-3 py-2.5 shadow-[var(--shadow)]">
            <h2 className="text-xs font-semibold text-[var(--muted)]">体調・コンディション</h2>
            <div className="mt-1 flex items-center gap-2">
              <input
                aria-label="その日のコンディション"
                onFocus={event => event.currentTarget.select()}
                disabled={Boolean(savingKey)}
                value={dayConditionDraft}
                onChange={(event) => setDayConditionDraft(event.target.value)}
                placeholder="その日の体調など"
                className="h-11 min-w-0 flex-1 rounded-[12px] bg-[var(--surface)] px-3 text-base"
              />
              <button
                data-screenshot-exclude
                type="button"
                onClick={() => void handleDayConditionSave()}
                disabled={!isDayConditionDirty || Boolean(savingKey) || workouts.length === 0}
                aria-label="体調・コンディションを保存"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white disabled:opacity-40"
              >
                <Check size={20} />
              </button>
            </div>
          </section>
        ) : null}

        {canAdd && !addAtBottom ? addSlot : null}

        {displayWorkouts.map((workout, index) => {
          if (!showCalendar && editingWorkoutId !== workout.id) {
            return (
            <WorkoutReadOnlyCard
              key={workout.id}
              exerciseRecords={exerciseRecords}
              exercises={exercises}
              onEdit={() => {
                if (savingKey) return;
                if ((isAddDraftDirty || isEditDraftDirty) && !window.confirm("入力中の変更を破棄して、この記録を編集しますか？")) return;
                clearLocalDraft(activeStorageKey);
                setShowAddForm(false);
                let value = editDrafts[workout.id];
                if (!value || !user) return;
                const baseline = JSON.stringify(value);
                try {
                  const saved = readWorkoutDraft(window.localStorage, workoutDraftKey(user.id, effectiveSelectedDate, workout.id), isEntryDraft);
                  if (saved) {
                    if (saved.baseline !== baseline && !window.confirm("記録が更新されています。以前の下書きを復元しますか？キャンセルすると下書きを破棄して最新の記録から編集します。")) {
                      clearLocalDraft(workoutDraftKey(user.id, effectiveSelectedDate, workout.id));
                    } else value = saved.value;
                  }
                  setDraftStorageError(null);
                } catch { setDraftStorageError("下書きを読み込めません。自動保存を停止しています。"); }
                setEditDrafts(current => ({ ...current, [workout.id]: value }));
                setEditingWorkoutId(workout.id);
                setEditingBaseline(baseline);
              }}
              sessionNumber={exerciseHistoryId ? undefined : sessionNumberByWorkoutId.get(workout.id) ?? index + 1}
              showDate={Boolean(exerciseHistoryId)}
              workout={workout}
            />
            );
          }
            const draft = editDrafts[workout.id];
            if (!draft || workout.exercises.length === 0) {
              return null;
            }
            return (
              <WorkoutEntryForm
                key={workout.id}
                bodyParts={bodyParts}
                defaultSetCount={defaultSetCount}
                draft={draft}
                draftNotice={draftNotice}
                exerciseRecords={exerciseRecords}
                exercises={exercises}
                historyReturnHref={exerciseHistoryId
                  ? backHref ?? "/history"
                  : `/today?date=${effectiveSelectedDate}${exerciseFilterId ? `&exercise=${encodeURIComponent(exerciseFilterId)}` : ""}`}
                isSaving={savingKey === workout.id}
                mode="edit"
                recordDate={exerciseHistoryId ? workout.workoutDate : undefined}
                recordCondition={workout.dayCondition}
                onDelete={() => void handleDelete(workout.id)}
                onDraftChange={(nextDraft) =>
                  setEditDrafts((current) => ({ ...current, [workout.id]: nextDraft }))
                }
                onHeaderClick={() => {
                  if (confirmUnsavedNavigation()) {
                    clearLocalDraft(activeStorageKey);
                    const workoutExercise = workout.exercises[0];
                    if (workoutExercise) {
                      setEditDrafts((current) => ({
                        ...current,
                        [workout.id]: createDraftFromWorkout(
                          workoutExercise,
                          findExercise(exercises, workoutExercise.exerciseId)?.cardioUnits,
                        ),
                      }));
                    }
                    setEditingWorkoutId(null);
                    setEditingBaseline(null);
                  }
                }}
                onSave={() => void handleEditSave(workout)}
                previousWorkout={editPreviousWorkouts[workout.id] ?? null}
                profile={profile}
                sessionNumber={exerciseHistoryId ? undefined : sessionNumberByWorkoutId.get(workout.id) ?? index + 1}
              />
            );
        })}
        {canAdd && addAtBottom ? addSlot : null}

        {exerciseHistoryId ? <nav aria-label="記録履歴の追加読み込み" className="space-y-2 pb-4">
          {workouts.length ? <p className="text-center text-xs text-[var(--muted)]">{workouts.length}件表示中</p> : null}
          {detailsLoading ? <p role="status" className="text-center text-sm text-[var(--muted)]">記録を読み込み中</p> : null}
          {historyLoadError ? <div role="alert" className="space-y-2 text-center text-sm text-[var(--warning)]"><p>記録を読み込めませんでした。</p><button type="button" className="ui-action w-full justify-center" onClick={() => historyLoadError === "more" ? void loadMoreHistory() : void loadSelectedDate().catch(() => undefined)}>再読み込み</button></div> : historyHasMore ? <button type="button" disabled={detailsLoading || Boolean(savingKey)} className="ui-action w-full justify-center disabled:opacity-40" onClick={() => void loadMoreHistory()}>もっと見る</button> : null}
        </nav> : null}

      </section>
      ) : null}
    </div>
  );
}
