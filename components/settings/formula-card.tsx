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
      className="overflow-x-auto rounded-[12px] bg-[var(--surface-soft)] p-3 text-[var(--text)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function FormulaCard() {
  return (
    <section className="space-y-4">
      <p className="text-sm leading-6 text-[var(--muted)]">
        消費カロリーと推定1RMは、トレーニング中の目安として使う概算値です。
      </p>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定消費カロリー</h3>
        <MathBlock tex={String.raw`\mathrm{kcal} = \frac{\mathrm{MET} \times 3.5 \times W}{200} \times T \times A`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>W はプロフィールの体重kgです。</p>
          <p>T はセット数、ウォームアップ、重量と回数から推定した運動時間です。</p>
          <p>A は身長、体重、年齢、性別から求めた体格補正です。</p>
          <p>MET は部位ごとの基準値に、複合種目補正を加えた値です。</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">運動時間 T</h3>
        <MathBlock tex={String.raw`T = \sum_i \tau_i + \min\left(8, \frac{\sum_i w_i r_i}{1200}\right)`} />
        <MathBlock tex={String.raw`\tau_i = \begin{cases}1.5 & \text{ウォームアップ}\\2.5 & \text{通常セット}\end{cases}`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>w_i は i セット目の重量kg、r_i は i セット目の回数です。</p>
          <p>重量または回数が未入力のセットは、T の計算対象外です。</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">体格補正 A</h3>
        <MathBlock tex={String.raw`A = \mathrm{clip}\left(\frac{10W + 6.25H - 5Y + S}{1580}, 0.8, 1.25\right)`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>H は身長cm、Y は年齢です。</p>
          <p>S は男性で 5、女性で -161、未設定またはその他で -78 とします。</p>
          <p>プロフィール未入力時は、体重70kg、身長170cm、年齢30歳として計算します。</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">MET</h3>
        <MathBlock tex={String.raw`\mathrm{MET} = \mathrm{MET}_{\mathrm{part}} + B_{\mathrm{compound}}`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>MET_part は部位ごとの基準値です。</p>
          <p>B_compound はスクワット、デッドリフト、ベンチプレス、プレス、懸垂などの複合種目で 0.6 を加える補正です。</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定1RM</h3>
        <MathBlock tex={String.raw`\mathrm{1RM} = w \left(1 + \frac{r}{30}\right)`} />
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>w はセット重量kgです。</p>
          <p>r は回数です。</p>
          <p>1回だけのセットは、入力重量をそのまま1RMとして扱います。</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[12px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">参考文献</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--muted)]">
          <li>Ainsworth BE et al. 2011 Compendium of Physical Activities: a second update of codes and MET values. Medicine &amp; Science in Sports &amp; Exercise, 2011.</li>
          <li>Mifflin MD et al. A new predictive equation for resting energy expenditure in healthy individuals. The American Journal of Clinical Nutrition, 1990.</li>
          <li>Epley B. Poundage chart. Boyd Epley Workout, 1985.</li>
        </ul>
      </div>
    </section>
  );
}
