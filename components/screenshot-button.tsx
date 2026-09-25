"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Camera, Download, Share2, X } from "lucide-react";
import { downloadBlob } from "@/lib/download";

export function ScreenshotButton({ targetRef, filename, disabled = false }: {
  targetRef: RefObject<HTMLElement | null>; filename: string; disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; blob: Blob; filename: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (preview) dialog.current?.showModal();
    return () => { if (preview) URL.revokeObjectURL(preview.url); };
  }, [preview]);
  async function capture() {
    const node = targetRef.current;
    if (!node || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const wasInert = node.inert;
    node.inert = true;
    try {
      await document.fonts.ready;
      const { toBlob } = await import("html-to-image");
      const width = Math.ceil(node.getBoundingClientRect().width);
      const height = node.scrollHeight;
      // Keep within mobile canvas memory limits; never silently truncate a long record.
      const pixelRatio = Math.min(2, Math.sqrt(4000000 / (width * height)), 8192 / Math.max(width, height));
      if (pixelRatio < 0.5) throw new Error("Image too large");
      const blob = await toBlob(node, {
        width, height, pixelRatio, backgroundColor: getComputedStyle(document.body).backgroundColor,
        filter: element => !(element instanceof Element && element.hasAttribute("data-screenshot-exclude")),
        style: { margin: "0" },
      });
      if (!blob) throw new Error("Empty image");
      if (!mounted.current) return;
      setPreview({ url: URL.createObjectURL(blob), blob, filename });
    } catch { setError("画像を作成できませんでした。記録が多い場合は表示を絞り、再試行してください。"); }
    finally { node.inert = wasInert; inFlight.current = false; setBusy(false); }
  }
  async function share() {
    if (!preview) return;
    const file = new File([preview.blob], preview.filename, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else downloadBlob(preview.blob, preview.filename);
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setError("共有できませんでした。「PNGを保存」をお試しください。");
    }
  }
  return <div data-screenshot-exclude className="space-y-2">
    <button type="button" disabled={disabled || busy} onClick={() => void capture()} className="ui-action inline-flex min-h-11 items-center gap-2 disabled:opacity-40"><Camera size={17} />{busy ? "画像を作成中…" : "画像として保存"}</button>
    {error ? <p role="alert" className="text-sm text-[var(--warning)]">{error}</p> : null}
    {preview ? <dialog ref={dialog} onClose={() => setPreview(null)} className="m-auto max-h-[90svh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl bg-[var(--surface)] p-4 text-[var(--text)] backdrop:bg-black/60">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-3 flex items-center justify-between gap-2 bg-[var(--surface)] px-4 py-3">
        <h2 className="text-sm font-semibold">画像プレビュー</h2>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="ui-icon-button" aria-label="PNGを保存" title="PNGを保存" onClick={() => downloadBlob(preview.blob, preview.filename)}><Download size={19} /></button>
          <button type="button" className="ui-icon-button" aria-label="共有・写真に保存" title="共有・写真に保存" onClick={() => void share()}><Share2 size={19} /></button>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="画像プレビューを閉じる" className="ui-icon-button"><X size={20} /></button>
        </div>
      </div>
      {/* Blob URLs are local previews, not remote images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview.url} alt="保存する記録の画像" className="w-full rounded-xl" />
      <p className="my-3 text-xs text-[var(--muted)]">iPhoneでは共有メニューから「画像を保存」を選べます。</p>
      {error ? <p role="alert" className="mt-2 text-sm text-[var(--warning)]">{error}</p> : null}
    </dialog> : null}
  </div>;
}
