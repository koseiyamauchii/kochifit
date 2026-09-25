"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Non-modal, top-layer popup anchored to its own trigger, without a backdrop. */
export function PreferencePopover({ title, trigger, children }: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => {
    panel.current?.hidePopover();
    button.current?.focus({ preventScroll: true });
  };
  const position = () => {
    const anchor = button.current;
    const popup = panel.current;
    if (!anchor || !popup) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const rect = anchor.getBoundingClientRect();
    popup.style.width = `${Math.min(352, width - 24)}px`;
    popup.style.maxHeight = `${height - 24}px`;
    const popupHeight = popup.offsetHeight;
    const below = rect.bottom + 6;
    const above = rect.top - popupHeight - 6;
    popup.style.left = `${Math.max(left + 12, Math.min(rect.right - popup.offsetWidth, left + width - popup.offsetWidth - 12))}px`;
    popup.style.top = `${Math.max(top + 12, Math.min(below + popupHeight <= top + height - 12 ? below : above, top + height - popupHeight - 12))}px`;
  };
  useEffect(() => {
    if (!open) return;
    const update = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      position();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open]);
  return <>
    <button ref={button} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      className="flex min-h-14 w-full items-center gap-3 px-4 text-sm font-medium"
      onClick={() => {
        if (!panel.current) return;
        if (panel.current.matches(":popover-open")) { panel.current.hidePopover(); return; }
        panel.current.showPopover();
        position();
        panel.current.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
      }}>{trigger}</button>
    <div id={id} ref={panel} popover="auto" role="dialog" aria-label={title}
      onToggle={event => setOpen(event.newState === "open")}
      onClick={event => {
        event.stopPropagation();
        if (event.target instanceof Element && event.target.closest("button[data-close-preference]")) close();
      }}
      className="preference-popover fixed m-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text)] shadow-[var(--shadow)]">
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="ui-section-title">{title}</h3>
        <button type="button" aria-label={`${title}を閉じる`} onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)]"><X size={18} /></button>
      </div>
      {children}
    </div>
  </>;
}
