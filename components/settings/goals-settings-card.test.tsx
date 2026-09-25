// @vitest-environment jsdom
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoalsSettingsCard } from "./goals-settings-card";

const mocks = vi.hoisted(() => ({
  update: vi.fn(), save: vi.fn(), refreshProfile: vi.fn(),
  auth: { user: { id: "user" }, profile: { one_month_goal_text: "毎週続ける", one_month_goal_date: "2099-10-25", three_month_goal_text: "フォーム改善", one_year_goal_text: "習慣化" } },
}));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ ...mocks.auth, refreshProfile: mocks.refreshProfile }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: (table: string) => table === "profiles"
  ? { update: mocks.update }
  : { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReturnValue({ eq: mocks.save });
  mocks.save.mockResolvedValue({ error: null });
  mocks.refreshProfile.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open() {
  render(<GoalsSettingsCard />);
  await screen.findByText("保存した振り返りがここに残ります。");
  return within(screen.getByRole("form", { name: "1か月目標の設定" }));
}
const navigate = () => window.dispatchEvent(new CustomEvent("kochifit:confirm-navigation", { cancelable: true }));

describe("direct goal editing", () => {
  it("shows all goal fields immediately and protects edits made after a successful save", async () => {
    const form = await open();
    expect(screen.queryByRole("button", { name: "目標を編集" })).toBeNull();
    expect(screen.getAllByRole("form", { name: /目標の設定/ })).toHaveLength(3);
    fireEvent.change(form.getByRole("textbox"), { target: { value: "  週3回続ける  " } });
    fireEvent.change(form.getByLabelText("期限"), { target: { value: "2099-11-01" } });
    fireEvent.click(form.getByRole("button", { name: "変更を保存" }));
    await waitFor(() => expect(form.getByRole("button", { name: "保存済み" })).toBeTruthy());
    expect(mocks.update).toHaveBeenCalledWith({ one_month_goal_text: "週3回続ける", one_month_goal_date: "2099-11-01" });
    expect(mocks.save).toHaveBeenCalledWith("id", "user");
    expect(navigate()).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
    fireEvent.change(form.getByRole("textbox"), { target: { value: "週4回続ける" } });
    expect(navigate()).toBe(false);
    expect(window.confirm).toHaveBeenCalledOnce();
  });
  it("keeps edits on a save error and permits retry", async () => {
    const form = await open();
    mocks.save.mockResolvedValueOnce({ error: { message: "offline" } });
    fireEvent.change(form.getByRole("textbox"), { target: { value: "新しい目標" } });
    fireEvent.click(form.getByRole("button", { name: "変更を保存" }));
    expect(await form.findByRole("alert")).toBeTruthy();
    expect((form.getByRole("textbox") as HTMLTextAreaElement).value).toBe("新しい目標");
    expect(navigate()).toBe(false);
    fireEvent.click(form.getByRole("button", { name: "変更を保存" }));
    await waitFor(() => expect(form.getByRole("button", { name: "保存済み" })).toBeTruthy());
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });
  it("asks once when several goals have unsaved changes", async () => {
    const form = await open();
    fireEvent.change(form.getByRole("textbox"), { target: { value: "変更1" } });
    fireEvent.change(within(screen.getByRole("form", { name: "3か月目標の設定" })).getByRole("textbox"), { target: { value: "変更2" } });
    vi.mocked(window.confirm).mockReturnValue(true);
    expect(navigate()).toBe(true);
    expect(window.confirm).toHaveBeenCalledOnce();
  });
});
