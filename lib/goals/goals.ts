import type { Profile } from "@/lib/supabase/database.types";
import { toDateKey } from "@/lib/workouts/date";

export const goalKinds = [
  { key: "one_month", label: "1か月目標", months: 1 },
  { key: "three_month", label: "3か月目標", months: 3 },
  { key: "one_year", label: "1年目標", months: 12 },
] as const;
export type GoalKind = typeof goalKinds[number]["key"];
export function formatGoalDate(date: string) {
  return date.replaceAll("-", "/");
}
export function getGoals(profile: Profile | null) {
  return goalKinds.map(kind => ({ ...kind, text: profile?.[`${kind.key}_goal_text`] ?? "", deadline: profile?.[`${kind.key}_goal_date`] ?? "" }));
}
export function isGoalDue(text: string, deadline: string, today: string) {
  return Boolean(text.trim() && deadline && deadline <= today);
}
export function shiftGoalMonth(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1 + months, 1);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return toDateKey(date);
}
export function goalPeriodStart(deadline: string, months: number) {
  const start = shiftGoalMonth(deadline, -months);
  const [y, m, d] = start.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + 1));
}
