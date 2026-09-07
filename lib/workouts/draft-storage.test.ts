import { describe, expect, it } from "vitest";
import { readWorkoutDraft, workoutDraftKey, writeWorkoutDraft } from "./draft-storage";

describe("device draft storage", () => {
  const valid = (v: unknown): v is { note: string } => typeof v === "object" && v !== null && "note" in v && typeof v.note === "string";
  it("isolates users, dates, and edits", () => {
    expect(new Set([workoutDraftKey("a", "2026-09-07"), workoutDraftKey("b", "2026-09-07"), workoutDraftKey("a", "2026-09-08"), workoutDraftKey("a", "2026-09-07", "edit")]).size).toBe(4);
  });
  it("roundtrips multiline notes and the original edit baseline", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    writeWorkoutDraft(storage, "draft", { note: "ゆっくり\n補助あり" }, "original");
    expect(readWorkoutDraft(storage, "draft", valid)).toMatchObject({ value: { note: "ゆっくり\n補助あり" }, baseline: "original" });
    expect(readWorkoutDraft(storage, "missing", valid)).toBeNull();
  });
  it("rejects corrupted drafts and reports storage failures", () => {
    expect(() => readWorkoutDraft({ getItem: () => "{bad" }, "draft", valid)).toThrow();
    expect(() => readWorkoutDraft({ getItem: () => '{"version":2,"value":{}}' }, "draft", valid)).toThrow();
    expect(() => writeWorkoutDraft({ setItem: () => { throw new Error("quota"); } }, "draft", {})).toThrow("quota");
  });
});
