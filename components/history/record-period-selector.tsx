"use client";
import { getRecordRange, recordPeriods, type RecordPeriod } from "@/lib/workouts/period";

export function RecordPeriodSelector({ value, onChange, today, disabled = false }: {
  value: RecordPeriod; onChange: (value: RecordPeriod) => void; today?: Date; disabled?: boolean;
}) {
  const range = getRecordRange(value, today);
  return <div className="space-y-2">
    <div role="group" aria-label="記録の表示期間" className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--surface-soft)] p-1">
      {recordPeriods.map(period => <button key={period.value} type="button" disabled={disabled}
        aria-pressed={value === period.value} onClick={() => onChange(period.value)}
        className={`min-h-11 rounded-lg text-sm font-medium disabled:opacity-40 ${value === period.value ? "bg-[var(--accent)] text-white" : "text-[var(--muted)]"}`}>{period.label}</button>)}
    </div>
    <p className="text-xs text-[var(--muted)]">{range ? `${range.start} ～ ${range.end}` : "すべての記録"}</p>
  </div>;
}
