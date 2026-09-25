// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Exercise, Workout } from "@/lib/workouts/types";
import { defaultCardioUnits } from "@/lib/workouts/cardio-units";
import { WorkoutCalendar } from "./workout-calendar";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "user" }, authStatus: "authenticated", profileStatus: "ready", profile: { default_set_count: 1, session_sort_order: "desc", body_weight_kg: 60 } },
  client: {}, router: { push: vi.fn() }, getRecords: vi.fn(), save: vi.fn(), condition: vi.fn(),
}));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/screenshot-button", () => ({ ScreenshotButton: () => null }));
const exercise: Exercise = { id: "bench", name: "ベンチプレス", bodyPartId: "chest", bodyPartKey: "chest", active: true,
  displayOrder: 0, rackPosition: null, memo: null, defaultSetCount: 1, bodyWeightEnabled: false, bilateralRepsEnabled: false, cardioMetrics: [], cardioUnits: defaultCardioUnits };
const record: Workout = { id: "saved", workoutDate: "2026-09-17", createdAt: "2026-09-17T01:00:00Z", note: null, dayCondition: "良好",
  exercises: [{ id: "entry", exerciseId: "bench", exerciseName: "ベンチプレス", workoutDate: "2026-09-17", displayOrder: 0, note: null, condition: "良好", elapsedSec: null, sets: [] }] };
vi.mock("@/lib/workouts/repository", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/workouts/repository")>(),
  getBodyParts: async () => [], getExercises: async () => [exercise], getExerciseRecords: async () => [],
  getWorkoutsByDate: (...args: unknown[]) => mocks.getRecords(...args), getLatestWorkoutForExerciseBeforeDate: async () => null,
  createWorkout: (...args: unknown[]) => mocks.save(...args), updateWorkoutExerciseConditions: (...args: unknown[]) => mocks.condition(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.auth.profile.session_sort_order = "desc";
  mocks.getRecords.mockResolvedValue([record]);
  mocks.save.mockResolvedValue("new-record");
  mocks.condition.mockResolvedValue(undefined);
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open() {
  render(<WorkoutCalendar showCalendar={false} selectedDateOverride="2026-09-17" detailsHeading="9月17日" />);
  await screen.findByRole("heading", { name: /1\s*ベンチプレス/ });
  await waitFor(() => expect((screen.getByRole("button", { name: "記録を追加" }) as HTMLButtonElement).disabled).toBe(false));
}

describe("inline workout creation", () => {
  it.each(["asc", "desc"])("places the add control correctly for %s while keeping saved records visible", async order => {
    mocks.auth.profile.session_sort_order = order;
    await open();
    const region = screen.getByRole("region", { name: "記録の追加" });
    const heading = screen.getByRole("heading", { name: /1\s*ベンチプレス/ });
    expect(Boolean(region.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(order === "desc");
    fireEvent.click(screen.getByRole("button", { name: "記録を追加" }));
    const select = within(region).getByRole("combobox");
    fireEvent.change(select, { target: { value: "bench" } });
    expect(screen.getByRole("heading", { name: /1\s*ベンチプレス/ })).toBeTruthy();
    expect(within(region).queryByRole("heading", { name: "ベンチプレス" })).toBeNull();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });
  it("saves the inline draft with the day's condition, refreshes the list and shows green feedback", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "その日のコンディション" }), { target: { value: "疲労あり" } });
    fireEvent.click(screen.getByRole("button", { name: "記録を追加" }));
    const region = screen.getByRole("region", { name: "記録の追加" });
    fireEvent.change(within(region).getByRole("combobox"), { target: { value: "bench" } });
    const inputs = region.querySelectorAll('input[inputmode="decimal"], input[inputmode="numeric"]');
    fireEvent.change(inputs[0], { target: { value: "20" } });
    fireEvent.change(inputs[1], { target: { value: "10" } });
    mocks.getRecords.mockResolvedValue([{ ...record, id: "new-record", createdAt: "2026-09-17T02:00:00Z", dayCondition: "疲労あり" }, record]);
    fireEvent.click(within(region).getByRole("button", { name: "記録を保存" }));
    const feedback = await screen.findByText("保存しました。");
    expect(feedback.className).toContain("text-emerald-500");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ workoutDate: "2026-09-17", condition: "疲労あり", sets: [{ weightKg: 20, reps: 10 }] });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    expect(await screen.findByRole("heading", { name: /2\s*ベンチプレス/ })).toBeTruthy();
  });
  it("selects memo text and protects a memo-only draft from accidental close", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "記録を追加" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bench" } });
    const note = screen.getByRole("textbox", { name: "メモ" }) as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "フォームに注意" } });
    fireEvent.focus(note);
    expect([note.selectionStart, note.selectionEnd]).toEqual([0, note.value.length]);
    fireEvent.click(screen.getByRole("button", { name: "記録入力を閉じる" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "メモ" })).toBeTruthy();
  });
  it("keeps an entered draft when saving fails", async () => {
    await open();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.save.mockRejectedValue(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "記録を追加" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bench" } });
    fireEvent.change(screen.getByRole("textbox", { name: "セット1の重量" }), { target: { value: "20" } });
    fireEvent.change(screen.getByRole("textbox", { name: "セット1の回数" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "記録を保存" }));
    await screen.findByText("トレーニングの保存に失敗しました。入力値を確認してください。");
    expect((screen.getByRole("textbox", { name: "セット1の重量" }) as HTMLInputElement).value).toBe("20");
    expect(localStorage.length).toBe(1);
    expect(screen.queryByText("保存しました。")).toBeNull();
  });
  it("does not present a successful save as failed when only refreshing the list fails", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "記録を追加" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bench" } });
    fireEvent.change(screen.getByRole("textbox", { name: "セット1の重量" }), { target: { value: "20" } });
    fireEvent.change(screen.getByRole("textbox", { name: "セット1の回数" }), { target: { value: "10" } });
    mocks.getRecords.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "記録を保存" }));
    await screen.findByText("保存は完了しましたが、一覧を更新できませんでした。再読み込みしてください。");
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
