"use client";

import { ChevronDown, Monitor, Moon, Palette, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import {
  useThemePreference,
  type AccentPreference,
  type ThemePreference,
} from "@/components/settings/theme-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { useMemo } from "react";

const choices: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
  { value: "system", label: "システム", icon: <Monitor size={16} /> },
  { value: "light", label: "ライト", icon: <Sun size={16} /> },
  { value: "dark", label: "ダーク", icon: <Moon size={16} /> },
];

const accentChoices: Array<{ value: AccentPreference; label: string; color: string }> = [
  { value: "gray", label: "デフォルト", color: "#52525b" },
  { value: "red", label: "レッド", color: "#dc2626" },
  { value: "orange", label: "オレンジ", color: "#ea580c" },
  { value: "yellow", label: "イエロー", color: "#d6a000" },
  { value: "green", label: "グリーン", color: "#16a34a" },
  { value: "blue", label: "ブルー", color: "#2563eb" },
  { value: "purple", label: "パープル", color: "#9333ea" },
  { value: "pink", label: "ピンク", color: "#db2777" },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, accent, setTheme, setAccent } = useThemePreference();
  const { refreshProfile, user } = useAuth();
  const client = useMemo(() => createClient(), []);

  const savePreference = async (nextTheme: ThemePreference, nextAccent: AccentPreference) => {
    if (!user) {
      return;
    }
    const { error } = await client
      .from("profiles")
      .update({
        theme_preference: nextTheme,
        accent_preference: nextAccent,
      })
      .eq("id", user.id);
    if (error) {
      console.error("Theme preference save error", error);
      return;
    }
    await refreshProfile();
  };

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    void savePreference(nextTheme, accent);
  };

  const handleAccentChange = (nextAccent: AccentPreference) => {
    setAccent(nextAccent);
    void savePreference(theme, nextAccent);
  };

  const currentThemeLabel = choices.find((choice) => choice.value === theme)?.label ?? "システム";
  const currentAccentLabel = accentChoices.find((choice) => choice.value === accent)?.label ?? "デフォルト";

  if (compact) {
    return (
      <div className="overflow-hidden rounded-[12px] bg-[var(--surface-soft)]">
        <label className="relative flex min-h-12 w-full items-center justify-between gap-3 border-b border-[var(--hairline)] px-2.5 text-sm font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--muted)]">
              <Sun size={18} />
            </span>
            <span className="min-w-0 truncate">外観</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--muted)]">
            {currentThemeLabel}
            <ChevronDown size={16} />
          </span>
          <select
            aria-label="外観"
            value={theme}
            onChange={(event) => handleThemeChange(event.target.value as ThemePreference)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label className="relative flex min-h-12 w-full items-center justify-between gap-3 px-2.5 text-sm font-medium">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--muted)]">
              <Palette size={18} />
            </span>
            <span className="min-w-0 truncate">アクセントカラー</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm text-[var(--muted)]">
            {currentAccentLabel}
            <ChevronDown size={16} />
          </span>
          <select
            aria-label="アクセントカラー"
            value={accent}
            onChange={(event) => handleAccentChange(event.target.value as AccentPreference)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {accentChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"><Sun size={15} />外観</h3>
      <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-[var(--surface)] p-1">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => handleThemeChange(choice.value)}
            aria-pressed={theme === choice.value}
            className={[
              "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-[12px] px-1 text-[13px] font-medium sm:text-sm",
              theme === choice.value
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--muted)]",
            ].join(" ")}
          >
            {choice.icon}
            <span className="whitespace-nowrap">{choice.label}</span>
          </button>
        ))}
      </div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"><Palette size={15} />アクセントカラー</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {accentChoices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => handleAccentChange(choice.value)}
            aria-pressed={accent === choice.value}
            className={[
              "flex min-h-11 items-center gap-2 rounded-[12px] border px-3 text-sm font-medium",
              accent === choice.value
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className="color-orb h-4 w-4 rounded-full"
              style={{ "--color-orb": choice.color } as CSSProperties}
            />
            <span>{choice.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
