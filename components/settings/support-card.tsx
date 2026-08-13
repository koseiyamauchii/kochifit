"use client";

import { Mail } from "lucide-react";

const contactEmail = "koseiyamauchi2003@gmail.com";

export function SupportCard() {
  return (
    <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <h2 className="text-base font-semibold">問い合わせ</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        意見，フィードバック，バグ報告はこちらへ送ってください．
      </p>
      <a
        href={`mailto:${contactEmail}`}
        className="mt-3 flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--text)]"
      >
        <Mail size={17} />
        {contactEmail}
      </a>
    </section>
  );
}
