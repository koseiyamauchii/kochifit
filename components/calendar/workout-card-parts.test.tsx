import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetAnnotations, WorkoutCardHeader } from "./workout-card-parts";

describe("workout card annotations", () => {
  it("shows a set memo and assistance", () => {
    const html = renderToStaticMarkup(<SetAnnotations note={"最後だけ補助\nフォームを確認"} isAssisted isCardio={false} />);
    expect(html).toContain("補助あり");
    expect(html).toContain("メモ：最後だけ補助\nフォームを確認");
    expect(html).toContain("whitespace-pre-wrap");
  });

  it("makes empty notes and unassisted sets explicit", () => {
    const html = renderToStaticMarkup(<SetAnnotations note={null} isAssisted={false} isCardio={false} />);
    expect(html).toContain("補助なし");
    expect(html).toContain("メモ：—");
  });

  it("keeps cardio notes without a strength-only assistance label", () => {
    const html = renderToStaticMarkup(<SetAnnotations note="傾斜あり" isAssisted={false} isCardio />);
    expect(html).toContain("メモ：傾斜あり");
    expect(html).not.toContain("補助");
  });
});

describe("workout card header", () => {
  it("uses identical heading markup and a fixed height when opened or closed", () => {
    const props = { title: "ケーブルサイドレイズ", sessionNumber: 3, children: "3セット" };
    const closed = renderToStaticMarkup(<WorkoutCardHeader {...props} />);
    const opened = renderToStaticMarkup(<WorkoutCardHeader {...props} onClose={() => {}} />);
    expect(opened.match(/<h3.*?<\/h3>/)?.[0]).toBe(closed.match(/<h3.*?<\/h3>/)?.[0]);
    for (const html of [closed, opened]) {
      expect(html).toContain("h-11");
      expect(html).toContain("3セット");
    }
    expect(opened).toContain('aria-expanded="true"');
  });
});
