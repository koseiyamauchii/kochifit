import * as React from "react";

export function WorkoutMemoSummary({ note, masterMemo, sets }: {
  note: string | null;
  masterMemo?: string | null;
  sets: Array<{ id: string; note: string | null }>;
}) {
  const notes = sets.flatMap((set, index) => set.note?.trim() ? [{ ...set, number: index + 1 }] : []);
  if (!note?.trim() && !masterMemo?.trim() && !notes.length) return null;
  return <div className="space-y-1.5 border-b border-[var(--hairline)] px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
    {note?.trim() ? <p className="whitespace-pre-wrap break-words">{note}</p> : null}
    {masterMemo?.trim() ? <p className="whitespace-pre-wrap break-words"><span className="font-medium">共通メモ（種目マスタ） </span>{masterMemo}</p> : null}
    {notes.map(set => <div key={set.id} className="flex items-start gap-2"><span className="shrink-0 font-medium">{set.number}セット目</span><p className="min-w-0 whitespace-pre-wrap break-words">{set.note}</p></div>)}
  </div>;
}

export function WorkoutCardHeader({
  title,
  sessionNumber,
  children,
  onClose,
}: {
  title: string;
  sessionNumber?: number;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const heading = (
    <h3 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold leading-5">
      {sessionNumber !== undefined ? (
        <span className="workout-header-badge flex h-6 min-w-6 shrink-0 items-center justify-center rounded-[8px] px-2 text-[11px] leading-4">
          {sessionNumber}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{title}</span>
    </h3>
  );

  return (
    <div className="workout-card-header flex h-11 items-center justify-between gap-3 border-b border-[var(--hairline)] px-3">
      {onClose ? (
        <button type="button" onClick={onClose} aria-label={title + "を閉じる"}
          aria-expanded="true" className="flex h-full min-w-0 flex-1 items-center text-left">
          {heading}
        </button>
      ) : heading}
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold leading-4 text-[var(--muted)]">
        {children}
      </div>
    </div>
  );
}

export function SetAnnotations({ note, isAssisted, isCardio, showAssistance = true }: {
  note: string | null;
  isAssisted: boolean;
  isCardio: boolean;
  showAssistance?: boolean;
}) {
  if (!note?.trim() && (!showAssistance || isCardio)) return null;
  return (
    <div className="mt-1.5 flex items-start gap-3 text-xs leading-relaxed text-[var(--muted)]">
      {!isCardio && showAssistance ? (
        <p className="shrink-0 font-medium">{isAssisted ? "補助あり" : "補助なし"}</p>
      ) : null}
      {note?.trim() ? <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note}</p> : null}
    </div>
  );
}
