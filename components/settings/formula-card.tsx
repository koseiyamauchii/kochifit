"use client";

import katex from "katex";
import { useMemo } from "react";

function MathBlock({ tex }: { tex: string }) {
  const html = useMemo(
    () =>
      katex.renderToString(tex, {
        displayMode: true,
        throwOnError: false,
        strict: "warn",
      }),
    [tex],
  );

  return (
    <div
      className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--text)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function FormulaCard() {
  return (
    <section className="space-y-4 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
      <div>
        <h2 className="text-base font-semibold">計算式</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          消費カロリーと推定1RMは，トレーニング中の目安として使う概算値です．
        </p>
      </div>

      <div className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定消費カロリー</h3>
        <MathBlock tex={String.raw`\mathrm{kcal} = \frac{\mathrm{MET} \times 3.5 \times W}{200} \times T \times A`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>W はプロフィールの体重kgです．</p>
          <p>T はセット数，ウォームアップ，重量と回数から推定した運動時間です．</p>
          <p>A は身長，体重，年齢，性別から求めた体格補正です．</p>
          <p>MET は部位ごとの基準値に，複合種目補正を加えた値です．</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定1RM</h3>
        <MathBlock tex={String.raw`\mathrm{1RM} = w \left(1 + \frac{r}{30}\right)`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>w はセット重量kgです．</p>
          <p>r は回数です．</p>
          <p>1回だけの場合は入力重量をそのまま1RMとして扱います．</p>
        </div>
      </div>
    </section>
  );
}
