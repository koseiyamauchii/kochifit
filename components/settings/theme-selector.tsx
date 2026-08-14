"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
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

  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      {!compact ? <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]"><Sun size={15} />外観</h3> : null}
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
