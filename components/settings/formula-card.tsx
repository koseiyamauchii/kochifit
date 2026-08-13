"use client";

function Fraction({ numerator, denominator }: { numerator: React.ReactNode; denominator: React.ReactNode }) {
  return (
    <span className="inline-flex translate-y-[0.15em] flex-col items-center px-1 align-middle text-[0.9em] leading-none">
      <span className="border-b border-current px-1 pb-0.5">{numerator}</span>
      <span className="px-1 pt-0.5">{denominator}</span>
    </span>
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
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-[15px] font-semibold leading-8 text-[var(--text)]">
          <span>kcal = </span>
          <Fraction numerator="MET x 3.5 x W" denominator="200" />
          <span> x T x A</span>
        </div>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>W はプロフィールの体重kgです．</p>
          <p>T はセット数，ウォームアップ，重量と回数から推定した運動時間です．</p>
          <p>A は身長，体重，年齢，性別から求めた体格補正です．</p>
          <p>MET は部位ごとの基準値に，複合種目補正を加えた値です．</p>
        </div>
      </div>

      <div className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
        <h3 className="text-sm font-semibold">推定1RM</h3>
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 text-center text-[15px] font-semibold leading-8 text-[var(--text)]">
          <span>1RM = w x </span>
          <span className="inline-flex items-center gap-1">
            <span>(1 + </span>
            <Fraction numerator="r" denominator="30" />
            <span>)</span>
          </span>
        </div>
        <div className="space-y-1 text-sm leading-6 text-[var(--muted)]">
          <p>w はセット重量kgです．</p>
          <p>r は回数です．</p>
          <p>1回だけの場合は入力重量をそのまま1RMとして扱います．</p>
        </div>
      </div>
    </section>
  );
}
