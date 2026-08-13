"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type AccentPreference =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

interface ThemeContextValue {
  theme: ThemePreference;
  accent: AccentPreference;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentPreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeStorageKey = "work_out_theme";
const accentStorageKey = "work_out_accent";
const themeResetEventName = "work_out_theme_reset";
const themeSyncEventName = "work_out_theme_sync";
const defaultTheme: ThemePreference = "system";
const defaultAccent: AccentPreference = "gray";
const accentValues: AccentPreference[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
];

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = prefersDark ? "dark" : "light";
    return;
  }
  root.dataset.theme = theme;
}

function applyAccent(accent: AccentPreference) {
  document.documentElement.dataset.accent = accent;
}

export function resetThemePreferenceToDefault() {
  window.localStorage.setItem(themeStorageKey, defaultTheme);
  window.localStorage.setItem(accentStorageKey, defaultAccent);
  applyTheme(defaultTheme);
  applyAccent(defaultAccent);
  window.dispatchEvent(new Event(themeResetEventName));
}

export function syncThemePreference(theme: ThemePreference, accent: AccentPreference) {
  window.localStorage.setItem(themeStorageKey, theme);
  window.localStorage.setItem(accentStorageKey, accent);
  applyTheme(theme);
  applyAccent(accent);
  window.dispatchEvent(
    new CustomEvent(themeSyncEventName, {
      detail: { theme, accent },
    }),
  );
}

function isAccentPreference(value: string | null): value is AccentPreference {
  return accentValues.includes(value as AccentPreference);
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isAccentValue(value: string | null): value is AccentPreference {
  return isAccentPreference(value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(defaultTheme);
  const [accent, setAccentState] = useState<AccentPreference>(defaultAccent);

  useEffect(() => {
    const saved = window.localStorage.getItem(themeStorageKey);
    if (saved === "system" || saved === "light" || saved === "dark") {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      applyTheme("system");
    }

    const savedAccent = window.localStorage.getItem(accentStorageKey);
    if (isAccentPreference(savedAccent)) {
      setAccentState(savedAccent);
      applyAccent(savedAccent);
    } else {
      applyAccent("gray");
    }
  }, []);

  useEffect(() => {
    const onReset = () => {
      setThemeState(defaultTheme);
      setAccentState(defaultAccent);
      applyTheme(defaultTheme);
      applyAccent(defaultAccent);
    };
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: string; accent?: string }>).detail;
      if (!detail) {
        return;
      }
      const themeDetail = detail.theme ?? null;
      const accentDetail = detail.accent ?? null;
      const nextTheme = isThemePreference(themeDetail) ? themeDetail : defaultTheme;
      const nextAccent = isAccentPreference(accentDetail) ? accentDetail : defaultAccent;
      setThemeState(nextTheme);
      setAccentState(nextAccent);
      applyTheme(nextTheme);
      applyAccent(nextAccent);
    };
    window.addEventListener(themeResetEventName, onReset);
    window.addEventListener(themeSyncEventName, onSync);
    return () => {
      window.removeEventListener(themeResetEventName, onReset);
      window.removeEventListener(themeSyncEventName, onSync);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  };

  const setAccent = (nextAccent: AccentPreference) => {
    setAccentState(nextAccent);
    window.localStorage.setItem(accentStorageKey, nextAccent);
    applyAccent(nextAccent);
  };

  const value = useMemo(
    () => ({ theme, accent, setTheme, setAccent }),
    [theme, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used inside ThemeProvider");
  }
  return context;
}
