import type { BodyPart, Exercise, Workout } from "./types";
import type { DateRange } from "./period";

export const exportFields = [
  ["date", "日付"], ["session", "セッション"], ["bodyPart", "部位"], ["exercise", "種目"],
  ["set", "セット番号"], ["weight", "重量 (kg)"], ["reps", "回数"], ["left", "左回数"], ["right", "右回数"],
  ["warmup", "ウォームアップ"], ["assisted", "補助"], ["rir", "RIR"],
  ["distance", "距離 (km)"], ["duration", "時間 (秒)"], ["speed", "速さ (km/h)"], ["calories", "カロリー (kcal)"],
  ["elapsed", "種目所要時間 (秒)"], ["condition", "その日のコンディション"],
  ["setNote", "セットメモ"], ["exerciseNote", "記録メモ"], ["workoutNote", "セッションメモ"],
] as const;
export type ExportField = typeof exportFields[number][0];
export type ExportCell = string | number | null;
export type ExportRow = Record<ExportField, ExportCell>;

export function validExportRange(range: DateRange): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  return valid(range.start) && valid(range.end) && range.start <= range.end;
}

export function buildExportRows(workouts: Workout[], exercises: Exercise[], bodyParts: BodyPart[], conditions: Record<string, string>): ExportRow[] {
  const masters = new Map(exercises.map(exercise => [exercise.id, exercise]));
  const parts = new Map(bodyParts.map(part => [part.id, part.displayName]));
  const sessions = new Map<string, number>();
  return [...workouts].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).flatMap(workout => {
    const session = (sessions.get(workout.workoutDate) ?? 0) + 1;
    sessions.set(workout.workoutDate, session);
    return workout.exercises.flatMap(exercise => {
      const master = masters.get(exercise.exerciseId);
      return (exercise.sets.length ? exercise.sets : [null]).map(set => ({
        date: workout.workoutDate, session, bodyPart: parts.get(master?.bodyPartId ?? "") ?? "未設定",
        exercise: exercise.exerciseName, set: set?.setNumber ?? null, weight: set?.weightKg ?? null,
        reps: set?.reps ?? null, left: set?.leftReps ?? null, right: set?.rightReps ?? null,
        warmup: set ? (set.isWarmup ? "あり" : "なし") : null,
        assisted: set ? (set.isAssisted ? "あり" : "なし") : null, rir: set?.rir ?? null,
        distance: set?.distanceKm ?? null, duration: set?.durationSec ?? null, speed: set?.speedKmh ?? null,
        calories: set?.caloriesKcal ?? null, elapsed: exercise.elapsedSec,
        condition: conditions[workout.workoutDate] ?? "", setNote: set?.note ?? null,
        exerciseNote: exercise.note, workoutNote: workout.note,
      }));
    });
  });
}

function selectedColumns(fields: ExportField[]) {
  const columns = exportFields.filter(([key]) => fields.includes(key));
  if (!columns.length) throw new Error("出力項目を1つ以上選択してください。");
  return columns;
}

export function createExportMarkdown(rows: ExportRow[], fields: ExportField[]): string {
  const columns = selectedColumns(fields);
  // Keep user text literal in Markdown viewers, including links, images and HTML.
  const escape = (value: ExportCell) => String(value ?? "—")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replace(/[\\`*_[\]{}()#!|~]/g, "\\$&");
  const heading = (value: ExportCell) => escape(value).replace(/\s+/g, " ");
  const lines = ["# トレーニング記録", ""];
  let previousDate: ExportCell | undefined;
  rows.forEach((row, index) => {
    if (fields.includes("date") && row.date !== previousDate) {
      lines.push(`## ${heading(row.date)}`, "");
      previousDate = row.date;
    }
    const title = fields.includes("exercise") ? heading(row.exercise) : `記録 ${index + 1}`;
    const setTitle = fields.includes("set") && row.set !== null ? ` / セット ${heading(row.set)}` : "";
    lines.push(`${fields.includes("date") ? "###" : "##"} ${title}${setTitle}`, "");
    columns.forEach(([key, label]) => {
      if (key === "date" || key === "exercise" || (key === "set" && row.set !== null)) return;
      const value = escape(row[key]).replace(/\r\n?|\n/g, "  \n  ").replaceAll("\t", "    ");
      lines.push(`- ${label}: ${value}`);
    });
    lines.push("");
  });
  return lines.join("\n");
}

export async function createExportWorkbook(rows: ExportRow[], fields: ExportField[]): Promise<Uint8Array<ArrayBuffer>> {
  const columns = selectedColumns(fields);
  if (rows.length > 1048575) throw new Error("Excelの行数上限を超えています。期間を短くしてください。");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KochiFit";
  const sheet = workbook.addWorksheet("トレーニング記録", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(([key, label]) => ({ key, header: label, width: key.toLowerCase().includes("note") || key === "condition" ? 36 : key === "exercise" ? 28 : 18 }));
  rows.forEach(row => sheet.addRow(Object.fromEntries(columns.map(([key]) => [key, row[key]]))));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF49368C" } };
  sheet.getRow(1).height = 28;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
