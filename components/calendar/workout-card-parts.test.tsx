import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetAnnotations, WorkoutCardHeader, WorkoutMemoSummary } from "./workout-card-parts";

describe("memo summary above sets", () => {
  it("groups exercise, master and set notes without losing their set numbers", () => {
    const html = renderToStaticMarkup(<WorkoutMemoSummary note="当日のメモ" masterMemo="器具のメモ" sets={[{ id: "one", note: "" }, { id: "two", note: "フォーム\n確認" }]} />);
    expect(html).toContain("当日のメモ");
    expect(html).toContain("器具のメモ");
    expect(html).toContain("2セット目");
    expect(html).not.toContain("1セット目");
    expect(html).toContain("フォーム\n確認");
    expect(html).not.toContain("メモ：");
  });
  it("does not create an empty panel", () => {
    expect(renderToStaticMarkup(<WorkoutMemoSummary note={null} masterMemo=" " sets={[{ id: "one", note: " " }]} />)).toBe("");
  });
});

describe("workout card annotations", () => {
  it("keeps only the memo when assistance is already in the RM row", () => {
    const html = renderToStaticMarkup(<SetAnnotations note="フォーム確認" isAssisted isCardio={false} showAssistance={false} />);
    expect(html).toContain("フォーム確認");
    expect(html).not.toContain("補助");
    expect(renderToStaticMarkup(<SetAnnotations note={null} isAssisted isCardio={false} showAssistance={false} />)).toBe("");
  });
  it("shows a set memo and assistance", () => {
    const html = renderToStaticMarkup(<SetAnnotations note={"最後だけ補助\nフォームを確認"} isAssisted isCardio={false} />);
    expect(html).toContain("補助あり");
    expect(html).toContain("最後だけ補助\nフォームを確認");
    expect(html).not.toContain("メモ：");
    expect(html).toContain("whitespace-pre-wrap");
  });

  it("shows assistance without an empty memo label", () => {
    const html = renderToStaticMarkup(<SetAnnotations note={null} isAssisted={false} isCardio={false} />);
    expect(html).toContain("補助なし");
    expect(html).not.toContain("メモ：");
  });

  it("keeps cardio notes without a strength-only assistance label", () => {
    const html = renderToStaticMarkup(<SetAnnotations note="傾斜あり" isAssisted={false} isCardio />);
    expect(html).toContain("傾斜あり");
    expect(html).not.toContain("補助");
  });
});

describe("workout card header", () => {
  it("omits session badges for exercise history", () => {
    const html = renderToStaticMarkup(<WorkoutCardHeader title="履歴" />);
    expect(html).not.toContain("workout-header-badge");
  });
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
