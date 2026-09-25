"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getBodyParts, getExercises, getWorkoutsInRange } from "@/lib/workouts/repository";
import { buildExportRows, createExportMarkdown, createExportWorkbook, exportFields, validExportRange, type ExportField } from "@/lib/workouts/export";
import { getRecordRange } from "@/lib/workouts/period";
import { toDateKey } from "@/lib/workouts/date";

export function ExportPanel() {
  const client = useMemo(() => createClient(), []);
  const [range, setRange] = useState(() => getRecordRange("month", new Date())!);
  const [allDates, setAllDates] = useState(false);
  const [fields, setFields] = useState<ExportField[]>(() => exportFields.map(([key]) => key));
  const [format, setFormat] = useState<"xlsx" | "md">("xlsx");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<{ url: string; filename: string; signature: string } | null>(null);
  const signature = JSON.stringify([allDates, range, fields, format]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const valid = (allDates || validExportRange(range)) && fields.length > 0;
  async function exportRecords() {
    if (!valid || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setMessage(""); setError(""); setFile(null);
    try {
      const [workouts, exercises, bodyParts] = await Promise.all([
        getWorkoutsInRange(client, allDates ? undefined : range),
        getExercises(client, { includeInactive: true }), getBodyParts(client),
      ]);
      const conditions = Object.fromEntries(workouts.map(workout => [workout.workoutDate, workout.dayCondition ?? ""]));
      const rows = buildExportRows(workouts, exercises, bodyParts, conditions);
      if (!rows.length) { setMessage("指定期間の記録はありません。期間を変更してください。"); return; }
      const blob = format === "xlsx"
        ? new Blob([await createExportWorkbook(rows, fields)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        : new Blob([createExportMarkdown(rows, fields)], { type: "text/markdown;charset=utf-8" });
      if (!mounted.current) return;
      setFile({ url: URL.createObjectURL(blob), filename: `KochiFit_${allDates ? "全期間" : `${range.start}_${range.end}`}.${format}`, signature });
      setMessage(`${rows.length}件の記録を含むファイルを作成しました。下のボタンから保存してください。`);
    } catch { setError("出力できませんでした。接続を確認し、期間を短くして再試行してください。"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-[var(--muted)]">Excelは1セット1行、Markdownは日付・種目の見出しと項目別の箇条書きで出力します。重量はkg、距離はkm、時間は秒です。</p>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <section className="ui-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">期間</h2>
        <div className="grid grid-cols-4 gap-1">
          {([['week', '1週間'], ['month', '1か月'], ['year', '1年'], ['all', '全期間']] as const).map(([period, label]) => <button key={period} type="button" className="ui-action min-h-11 text-sm" onClick={() => {
            setAllDates(period === "all");
            if (period !== "all") setRange(getRecordRange(period, new Date())!);
          }}>{label}</button>)}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={allDates} onChange={event => setAllDates(event.target.checked)} />全期間を出力</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-sm">開始日<input type="date" min="0001-01-01" max={range.end || toDateKey(new Date())} value={range.start} disabled={allDates} onChange={event => setRange({ ...range, start: event.target.value })} className="min-h-11 min-w-0 rounded-xl bg-[var(--surface-soft)] px-3 text-base" /></label>
          <label className="grid min-w-0 gap-1 text-sm">終了日<input type="date" min={range.start || "0001-01-01"} value={range.end} disabled={allDates} onChange={event => setRange({ ...range, end: event.target.value })} className="min-h-11 min-w-0 rounded-xl bg-[var(--surface-soft)] px-3 text-base" /></label>
        </div>
        {!allDates && !validExportRange(range) ? <p role="alert" className="text-sm text-[var(--warning)]">開始日・終了日を正しく指定してください。</p> : null}
      </section>
      <section className="ui-card space-y-3 p-4">
        <h2 className="text-sm font-semibold">出力項目（{fields.length}項目）</h2>
        <div className="flex gap-2"><button type="button" className="ui-action min-h-11" onClick={() => setFields(exportFields.map(([key]) => key))}>すべて選択</button><button type="button" className="ui-action min-h-11" onClick={() => setFields([])}>選択を解除</button></div>
        <div className="grid grid-cols-2 gap-x-2">{exportFields.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={fields.includes(key)} onChange={event => setFields(current => event.target.checked ? [...current, key] : current.filter(field => field !== key))} />{label}</label>)}</div>
        {!fields.length ? <p className="text-sm text-[var(--warning)]">1つ以上選択してください。</p> : null}
      </section>
      <label className="grid gap-2 text-sm font-semibold">ファイル形式<select value={format} onChange={event => setFormat(event.target.value as "xlsx" | "md")} className="min-h-12 rounded-xl bg-[var(--surface-soft)] px-3 text-base"><option value="xlsx">Excel（.xlsx）</option><option value="md">Markdown（.md）</option></select></label>
    </fieldset>
    <button type="button" disabled={!valid || busy} onClick={() => void exportRecords()} className="ui-primary w-full min-h-12 disabled:opacity-40">{busy ? "ファイルを作成中…" : "エクスポート"}</button>
    {message && (!file || file.signature === signature) ? <p role="status" className="text-sm">{message}</p> : null}
    {file?.signature === signature ? <a href={file.url} download={file.filename} className="ui-primary min-h-12 w-full">{format.toUpperCase()}ファイルを保存</a> : null}
    {error ? <p role="alert" className="text-sm text-[var(--warning)]">{error}</p> : null}
  </div>;
}
