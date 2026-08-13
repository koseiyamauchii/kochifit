"use client";

import { Mail } from "lucide-react";

const contactEmail = "koseiyamauchi2003@gmail.com";

export function SupportCard() {
  return (
    <section className="space-y-3">
      <p className="text-sm leading-6 text-[var(--muted)]">
        意見、フィードバック、バグ報告はこちらへ送ってください。
      </p>
      <a
        href={`mailto:${contactEmail}`}
        className="flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--surface-soft)] px-3 text-sm font-semibold text-[var(--text)]"
      >
        <Mail size={17} />
        {contactEmail}
      </a>
    </section>
  );
}
