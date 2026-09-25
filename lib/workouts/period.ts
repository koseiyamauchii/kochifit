import { toDateKey } from "./date";

export type RecordPeriod = "week" | "month" | "year" | "all";
export interface DateRange { start: string; end: string }
export const recordPeriods: { value: RecordPeriod; label: string }[] = [
  { value: "week", label: "1週間" }, { value: "month", label: "1か月" },
  { value: "year", label: "1年" }, { value: "all", label: "全期間" },
];
export function parseRecordPeriod(value?: string): RecordPeriod {
  return recordPeriods.some(p => p.value === value) ? value as RecordPeriod : "month";
}
// Inclusive rolling interval: Sep 25's month is Aug 26 through Sep 25.
// Clamp month/year subtraction at the end of short months, then exclude that day.
export function getRecordRange(period: RecordPeriod, today = new Date()): DateRange | undefined {
  if (period === "all") return undefined;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  if (period === "week") start.setDate(start.getDate() - 6);
  else {
    const months = period === "year" ? 12 : 1;
    start.setDate(1);
    start.setMonth(start.getMonth() - months);
    start.setDate(Math.min(end.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    start.setDate(start.getDate() + 1);
  }
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function inclusiveDays(start: string, end: string) {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1);
}
