export const bodyPartColorOptions = [
  { key: "coral", label: "コーラル", color: "#f9735b" },
  { key: "salmon", label: "サーモン", color: "#fb7185" },
  { key: "apricot", label: "アプリコット", color: "#fb923c" },
  { key: "amber", label: "アンバー", color: "#f59e0b" },
  { key: "gold", label: "ゴールド", color: "#eab308" },
  { key: "chartreuse", label: "シャルトリューズ", color: "#a3e635" },
  { key: "lime", label: "ライム", color: "#84cc16" },
  { key: "mint", label: "ミント", color: "#34d399" },
  { key: "teal", label: "ティール", color: "#14b8a6" },
  { key: "cyan", label: "シアン", color: "#06b6d4" },
  { key: "sky", label: "スカイ", color: "#38bdf8" },
  { key: "azure", label: "アズール", color: "#60a5fa" },
  { key: "indigo", label: "インディゴ", color: "#818cf8" },
  { key: "violet", label: "バイオレット", color: "#a78bfa" },
  { key: "lavender", label: "ラベンダー", color: "#c084fc" },
  { key: "magenta", label: "マゼンタ", color: "#e879f9" },
  { key: "rose", label: "ローズ", color: "#f472b6" },
  { key: "stone", label: "ストーン", color: "#78716c" },
  { key: "slate", label: "スレート", color: "#64748b" },
  { key: "graphite", label: "グラファイト", color: "#52525b" },
] as const;

export type BodyPartColorKey = (typeof bodyPartColorOptions)[number]["key"];

const fallbackColorKey: BodyPartColorKey = "graphite";

const defaultColorByBodyPartKey: Record<string, BodyPartColorKey> = {
  chest: "coral",
  back: "lime",
  legs: "cyan",
  shoulders: "gold",
  arms: "lavender",
  abs: "amber",
  cardio: "teal",
};

export function getDefaultBodyPartColorKey(bodyPartKey: string | null | undefined) {
  return bodyPartKey ? defaultColorByBodyPartKey[bodyPartKey] ?? fallbackColorKey : fallbackColorKey;
}

export function getBodyPartColorByColorKey(colorKey: string | null | undefined) {
  return bodyPartColorOptions.find((option) => option.key === colorKey)?.color ?? "#71717a";
}

export function getBodyPartColor(
  bodyPartKey: string | null | undefined,
  colorKey?: string | null,
) {
  return getBodyPartColorByColorKey(colorKey ?? getDefaultBodyPartColorKey(bodyPartKey));
}
