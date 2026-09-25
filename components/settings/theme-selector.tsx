"use client";

import { Check, ChevronDown, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useThemePreference, type AccentPreference, type ThemePreference } from "./theme-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { PreferencePopover } from "./preference-popover";

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
  const saveError = error ? <p role="alert" className="mt-3 text-xs text-[var(--warning)]">{error}<button type="button" disabled={saving} className="ml-2 underline" onClick={() => void save(theme, accent)}>再試行</button></p> : null;
  return (
    <section className={compact ? "rounded-2xl bg-[var(--surface-soft)]" : "space-y-3"}>
      <div className={compact ? "border-b border-[var(--hairline)]" : ""}>
        <PreferencePopover title="外観" trigger={<>
          <CurrentIcon size={18} className="text-[var(--muted)]" /><span className="flex-1 text-left">外観</span>
          <span className="text-[var(--muted)]">{choices.find(c => c.value === theme)?.label}</span><ChevronDown size={16} />
        </>}>
          <div role="group" aria-label="外観" className="grid grid-cols-3 gap-2">
            {choices.map(({ value, label, icon: Icon }) => <button key={value} type="button" disabled={saving} aria-pressed={theme === value} onClick={() => void save(value, accent)} className={["theme-choice min-w-0 rounded-2xl border p-2", theme === value ? "border-[var(--accent)]" : "border-[var(--border)]"].join(" ")}>
              <span aria-hidden="true" className={"theme-preview theme-preview-" + value}><span /><span /><span /></span>
              <span className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold"><Icon size={14} />{label}</span>
              <span className="mt-1 flex h-4 justify-center">{theme === value ? <Check size={14} className="text-[var(--accent-strong)]" /> : null}</span>
            </button>)}
          </div>
          {saveError}
        </PreferencePopover>
      </div>
      <PreferencePopover title="アクセントカラー" trigger={<>
        <Palette size={18} className="text-[var(--muted)]" /><span className="flex-1 text-left">アクセントカラー</span>
        <span className="accent-preview h-4 w-4 shrink-0 rounded-full" data-accent={accent} />
        <span className="text-[var(--muted)]">{accentChoices.find(c => c.value === accent)?.label}</span><ChevronDown size={16} />
      </>}>
        <div role="group" aria-label="アクセントカラー" className="grid grid-cols-2 gap-2">
          {accentChoices.map(choice => <button key={choice.value} type="button" disabled={saving} onClick={() => void save(theme, choice.value)} aria-pressed={accent === choice.value} className={["flex min-h-12 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 text-sm font-medium", accent === choice.value ? "border-[var(--accent)]" : "border-[var(--border)]"].join(" ")}>
            <span aria-hidden="true" className="accent-preview h-6 w-6 shrink-0 rounded-full" data-accent={choice.value} /><span className="flex-1 text-left">{choice.label}</span>
            {accent === choice.value ? <Check size={15} className="shrink-0" /> : null}
          </button>)}
        </div>
        {saveError}
      </PreferencePopover>
    </section>
  );
}
