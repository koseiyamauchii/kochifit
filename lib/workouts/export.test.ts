import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildExportRows, createExportMarkdown, createExportWorkbook, validExportRange } from "./export";
import type { BodyPart, Exercise, Workout, WorkoutSet } from "./types";

const set: WorkoutSet = { id: "s", setNumber: 1, weightKg: 12.5, reps: null, leftReps: 10, rightReps: 8, rir: 2,
  isWarmup: false, isAssisted: true, note: "改行\nタブ\tと\"引用\"", distanceKm: 0, durationSec: 60, speedKmh: null, caloriesKcal: null };
const workout: Workout = { id: "w", workoutDate: "2026-09-25", createdAt: "2026-09-25T00:00:00Z", note: null,
  exercises: [{ id: "e", exerciseId: "master", exerciseName: "=1+1", workoutDate: "2026-09-25", displayOrder: 1, note: null, condition: "old", elapsedSec: 120, sets: [set] }] };
function rows() { return buildExportRows([workout], [{ id: "master", bodyPartId: "arms" } as Exercise], [{ id: "arms", displayName: "腕" } as BodyPart], { "2026-09-25": "良好" }); }

describe("record export", () => {
  it("validates calendar dates, inclusive same-day range, and reversed bounds", () => {
    expect(validExportRange({ start: "2024-02-29", end: "2024-02-29" })).toBe(true);
    for (const range of [{ start: "2026-02-29", end: "2026-03-01" }, { start: "2026-10-01", end: "2026-09-25" }, { start: "", end: "2026-09-25" }]) expect(validExportRange(range)).toBe(false);
  });
  it("preserves nulls, zeros, left/right reps and resolves daily condition", () => {
    expect(rows()[0]).toMatchObject({ condition: "良好", bodyPart: "腕", reps: null, left: 10, right: 8, distance: 0, assisted: "あり" });
  });
  it("round trips numeric cells and formula-like text without creating formulas or leaking unchecked fields", async () => {
    const bytes = await createExportWorkbook(rows(), ["exercise", "weight", "left", "right", "setNote"]);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0];
    expect(sheet.columnCount).toBe(5);
    expect(sheet.getCell("A2").value).toBe("=1+1");
    expect(sheet.getCell("B2").value).toBe(12.5);
    expect(sheet.getCell("C2").value).toBe(10);
    expect(sheet.getCell("D2").value).toBe(8);
    expect(sheet.getCell("E2").value).toBe(set.note);
    expect(sheet.getRow(1).values).not.toContain("その日のコンディション");
  });
  it("exports readable Markdown with only selected fields and preserves note line breaks", () => {
    const markdown = createExportMarkdown(rows(), ["exercise", "weight", "setNote"]);
    expect(markdown).toBe('# トレーニング記録\n\n## =1+1\n\n- 重量 (kg): 12.5\n- セットメモ: 改行  \n  タブ    と"引用"\n');
    expect(markdown).not.toContain("2026-09-25");
    expect(markdown).not.toContain("良好");
    expect(() => createExportMarkdown(rows(), [])).toThrow();
  });
  it("groups selected dates and includes zero values and setless records", () => {
    const row = rows()[0];
    const markdown = createExportMarkdown([row, { ...row, set: 2 }, { ...row, date: "2026-09-26", set: null }], ["date", "exercise", "set", "distance"]);
    expect(markdown.match(/^## 2026-09-25$/gm)).toHaveLength(1);
    expect(markdown).toContain("### =1+1 / セット 2");
    expect(markdown).toContain("## 2026-09-26");
    expect(markdown).toContain("- セット番号: —");
    expect(markdown.match(/距離 \(km\): 0/g)).toHaveLength(3);
  });
  it("escapes embedded HTML and Markdown links without exposing unchecked fields", () => {
    const markdown = createExportMarkdown([{ ...rows()[0], exercise: "private", setNote: "<img src=x> & [link](https://example.com)\n# heading" }], ["setNote"]);
    expect(markdown).toContain("&lt;img src=x&gt; &amp;");
    expect(markdown).toContain(String.raw`\[link\]\(https://example.com\)`);
    expect(markdown).toContain(String.raw`\# heading`);
    expect(markdown).not.toContain("private");
    expect(markdown).not.toContain("2026-09-25");
  });
  it("keeps sessions and setless records in chronological order", () => {
    const other = { ...workout, id: "later", createdAt: "2026-09-25T01:00:00Z", exercises: [{ ...workout.exercises[0], sets: [] }] };
    const records = buildExportRows([other, workout], [], [], {});
    expect(records.map(row => [row.session, row.set])).toEqual([[1, 1], [2, null]]);
  });
});
