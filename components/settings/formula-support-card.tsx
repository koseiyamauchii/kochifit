"use client";

import { Mail } from "lucide-react";

const contactEmail = "koseiyamauchi2003@gmail.com";

export function FormulaSupportCard() {
  return (
    <section className="space-y-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div>
        <h2 className="text-base font-semibold">計算式</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          表示している消費カロリーと推定1RMは，入力された重量，回数，種目の部位，プロフィール情報から概算しています．
        </p>
      </div>

      <div className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定消費カロリー</h3>
        <pre className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 text-[var(--text)]">
          <code>{String.raw`\mathrm{kcal}
= \frac{\mathrm{MET} \times 3.5 \times W}{200}
\times T \times A`}</code>
        </pre>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>W はプロフィールの体重kgです．</p>
          <p>T はセット数，ウォームアップ，重量と回数から推定した運動時間です．</p>
          <p>A は身長，体重，年齢，性別から求めた体格補正です．</p>
          <p>MET は部位ごとの基準値に，スクワット，デッドリフト，ベンチプレスなどの複合種目補正を加えます．</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定1RM</h3>
        <pre className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] leading-5 text-[var(--text)]">
          <code>{String.raw`\mathrm{1RM}
= w \left(1 + \frac{r}{30}\right)`}</code>
        </pre>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>w はセット重量kgです．</p>
          <p>r は回数です．</p>
          <p>1回だけの場合は入力重量をそのまま1RMとして扱います．</p>
        </div>
      </div>

      <div className="rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">意見，フィードバック，バグ報告</h3>
        <a
          href={`mailto:${contactEmail}`}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-[8px] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text)]"
        >
          <Mail size={17} />
          {contactEmail}
        </a>
      </div>
    </section>
  );
}
