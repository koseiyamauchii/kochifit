import * as React from "react";

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

export function SetAnnotations({ note, isAssisted, isCardio }: {
  note: string | null;
  isAssisted: boolean;
  isCardio: boolean;
}) {
  return (
    <div className="mt-1.5 flex items-start gap-3 text-xs leading-relaxed text-[var(--muted)]">
      {!isCardio ? (
        <p className="shrink-0 font-medium">{isAssisted ? "補助あり" : "補助なし"}</p>
      ) : null}
      {note?.trim() ? <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{note}</p> : null}
    </div>
  );
}
