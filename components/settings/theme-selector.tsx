"use client";

import { Check, ChevronDown, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useThemePreference, type AccentPreference, type ThemePreference } from "./theme-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";

const choices = [
  { value: "system", label: "システム", icon: Monitor },
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
] as const;
const accentChoices: { value: AccentPreference; label: string }[] = [
  { value: "gray", label: "グレー" }, { value: "red", label: "レッド" },
  { value: "orange", label: "オレンジ" }, { value: "yellow", label: "イエロー" },
  { value: "green", label: "グリーン" }, { value: "blue", label: "ブルー" },
  { value: "purple", label: "パープル" }, { value: "pink", label: "ピンク" },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { theme, accent, setTheme, setAccent } = useThemePreference();
  const { refreshProfile, user } = useAuth();
  const client = useMemo(() => createClient(), []);
  const [expanded, setExpanded] = useState<"theme" | "accent" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const save = async (nextTheme: ThemePreference, nextAccent: AccentPreference) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setTheme(nextTheme);
    setAccent(nextAccent);
    try {
      if (user) {
        const { error } = await client.from("profiles").update({ theme_preference: nextTheme, accent_preference: nextAccent }).eq("id", user.id);
        if (error) throw error;
        await refreshProfile();
      }
    } catch {
      setError("この端末に反映しましたが、アカウントへの保存に失敗しました。");
    } finally { savingRef.current = false; setSaving(false); }
  };
  const CurrentIcon = choices.find(c => c.value === theme)!.icon;
  return (
    <section className={compact ? "overflow-hidden rounded-2xl bg-[var(--surface-soft)]" : "space-y-5"}>
      <div className={compact ? "border-b border-[var(--hairline)]" : ""}>
        {compact ? <button type="button" aria-expanded={expanded === "theme"} onClick={() => setExpanded(expanded === "theme" ? null : "theme")} className="flex min-h-14 w-full items-center gap-3 px-4 text-sm font-medium">
          <CurrentIcon size={18} className="text-[var(--muted)]" /><span className="flex-1 text-left">外観</span>
          <span className="text-[var(--muted)]">{choices.find(c => c.value === theme)?.label}</span><ChevronDown size={16} />
        </button> : <h3 className="ui-section-title mb-3">外観</h3>}
        {!compact || expanded === "theme" ? <div role="group" aria-label="外観" className={compact ? "grid grid-cols-3 gap-2 px-3 pb-4" : "grid grid-cols-3 gap-2"}>
          {choices.map(({ value, label, icon: Icon }) => <button key={value} type="button" disabled={saving} aria-pressed={theme === value} onClick={() => void save(value, accent)} className={["theme-choice min-w-0 rounded-2xl border p-2.5", theme === value ? "border-[var(--accent)]" : "border-[var(--border)]"].join(" ")}>
            <span aria-hidden="true" className={"theme-preview theme-preview-" + value}><span /><span /><span /></span>
            <span className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold"><Icon size={14} />{label}</span>
            <span className="mt-1 flex h-4 justify-center">{theme === value ? <Check size={14} className="text-[var(--accent-strong)]" /> : null}</span>
          </button>)}
        </div> : null}
      </div>
      <div>
        {compact ? <button type="button" aria-expanded={expanded === "accent"} onClick={() => setExpanded(expanded === "accent" ? null : "accent")} className="flex min-h-14 w-full items-center gap-3 px-4 text-sm font-medium">
          <Palette size={18} className="text-[var(--muted)]" /><span className="flex-1 text-left">アクセントカラー</span>
          <span className="accent-preview h-4 w-4 shrink-0 rounded-full" data-accent={accent} />
          <span className="text-[var(--muted)]">{accentChoices.find(c => c.value === accent)?.label}</span><ChevronDown size={16} />
        </button> : <h3 className="ui-section-title mb-3">アクセントカラー</h3>}
        {!compact || expanded === "accent" ? <div role="group" aria-label="アクセントカラー" className={compact ? "grid grid-cols-2 gap-2 px-3 pb-4 sm:grid-cols-4" : "grid grid-cols-2 gap-2 sm:grid-cols-4"}>
          {accentChoices.map(choice => <button key={choice.value} type="button" disabled={saving} onClick={() => void save(theme, choice.value)} aria-pressed={accent === choice.value} className={["flex min-h-12 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 text-sm font-medium", accent === choice.value ? "border-[var(--accent)]" : "border-[var(--border)]"].join(" ")}>
            <span aria-hidden="true" className="accent-preview h-6 w-6 shrink-0 rounded-full" data-accent={choice.value} /><span className="flex-1 text-left">{choice.label}</span>
            {accent === choice.value ? <Check size={15} className="shrink-0" /> : null}
          </button>)}
        </div> : null}
      </div>
      {error ? <p role="alert" className="px-3 pb-3 text-xs text-[var(--warning)]">{error}<button type="button" disabled={saving} className="ml-2 underline" onClick={() => void save(theme, accent)}>再試行</button></p> : null}
    </section>
  );
}
