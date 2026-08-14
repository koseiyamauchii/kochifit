"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isAccentValue,
  isThemePreference,
  resetThemePreferenceToDefault,
  syncThemePreference,
} from "@/components/settings/theme-provider";
import type { Database, Profile } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";
type ProfileStatus = "idle" | "checking" | "ready" | "error";
type InitialExercisesStatus = "idle" | "checking" | "ready" | "error";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  authStatus: AuthStatus;
  profileStatus: ProfileStatus;
  initialExercisesStatus: InitialExercisesStatus;
  initialExercisesCount: number | null;
  error: string | null;
  isConfigured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, height_cm, body_weight_kg, age, sex, training_split, default_set_count, training_purpose, final_goal, one_month_goal_date, one_month_goal_text, three_month_goal_date, three_month_goal_text, one_year_goal_date, one_year_goal_text, theme_preference, accent_preference, created_at, updated_at",
    )
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function countInitialExercises(supabase: SupabaseClient<Database>, userId: string) {
  const { count, error } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("seed_key", "is", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function isJwtIssuedAtFutureError(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    String(error.code) === "PGRST303" &&
    "message" in error &&
    String(error.message).includes("JWT issued at future")
  );
}

async function runWithJwtClockSkewRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isJwtIssuedAtFutureError(error)) {
      throw error;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 3000));
    return operation();
  }
}

function reportAuthError(error: unknown, fallbackMessage: string) {
  if (process.env.NODE_ENV === "development") {
    const detail: Record<string, string> = {};
    if (error && typeof error === "object") {
      const errorRecord = error as Record<string, unknown>;
      for (const key of ["code", "message", "name", "status"] as const) {
        if (errorRecord[key] !== undefined && errorRecord[key] !== null) {
          detail[key] = String(errorRecord[key]);
        }
      }
    } else {
      detail.message = String(error);
    }
    console.error("Supabase auth error", detail);
  }

  return fallbackMessage;
}

function getOAuthRedirectTo() {
  const callbackUrl = new URL("/auth/callback", window.location.href);
  if (callbackUrl.hostname === "0.0.0.0") {
    callbackUrl.hostname = "localhost";
  }
  return callbackUrl.toString();
}

async function getSessionWithTimeout(client: SupabaseClient<Database>) {
  return Promise.race([
    client.auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Supabase getSession timed out")), 6000);
    }),
  ]);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    operation,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("unauthenticated");
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [initialExercisesStatus, setInitialExercisesStatus] =
    useState<InitialExercisesStatus>("idle");
  const [initialExercisesCount, setInitialExercisesCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bootstrapProfile = useCallback(
    async (client: SupabaseClient<Database>, currentSession: Session) => {
      setProfileStatus("checking");
      setInitialExercisesStatus("checking");
      setInitialExercisesCount(null);
      try {
        await withTimeout(
          runWithJwtClockSkewRetry(async () => {
            const { error: initError } = await client.rpc("initialize_current_user");
            if (initError) {
              throw initError;
            }
          }),
          8000,
          "Supabase profile initialization timed out",
        );

        const nextProfile = await withTimeout(
          loadProfile(client, currentSession.user.id),
          8000,
          "Supabase profile load timed out",
        );
        const nextTheme = isThemePreference(nextProfile.theme_preference)
          ? nextProfile.theme_preference
          : "system";
        const nextAccent = isAccentValue(nextProfile.accent_preference)
          ? nextProfile.accent_preference
          : "gray";
        syncThemePreference(nextTheme, nextAccent);
        const nextInitialExercisesCount = await withTimeout(
          countInitialExercises(client, currentSession.user.id),
          8000,
          "Supabase initial exercise count timed out",
        );
        setProfile(nextProfile);
        setProfileStatus("ready");
        setInitialExercisesCount(nextInitialExercisesCount);
        setInitialExercisesStatus(nextInitialExercisesCount > 0 ? "ready" : "error");
      } catch (err) {
        setError(reportAuthError(err, "プロフィールの初期化に失敗しました。"));
        setProfileStatus("error");
        setInitialExercisesStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    if (!isConfigured) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Supabase environment variables are not configured");
      }
      setAuthStatus("unauthenticated");
      return;
    }

    const client = createClient();
    setSupabase(client);
    setAuthStatus("loading");

    getSessionWithTimeout(client)
      .then(({ data, error: sessionError }) => {
        if (sessionError) {
          setError(reportAuthError(sessionError, "ログイン状態の確認に失敗しました。"));
          setAuthStatus("error");
          return;
        }

        setSession(data.session);
        setAuthStatus(data.session ? "authenticated" : "unauthenticated");
        if (data.session) {
          void bootstrapProfile(client, data.session);
        }
      })
      .catch((sessionError: unknown) => {
        reportAuthError(sessionError, "ログイン状態の確認に失敗しました。");
        setSession(null);
        setAuthStatus("unauthenticated");
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setError(null);
      setSession(nextSession);
      setProfile(null);
      setInitialExercisesCount(null);
      setAuthStatus(nextSession ? "authenticated" : "unauthenticated");
      if (nextSession) {
        void bootstrapProfile(client, nextSession);
      } else {
        setProfileStatus("idle");
        setInitialExercisesStatus("idle");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [bootstrapProfile, isConfigured]);

  const login = useCallback(async (forceAccountSelection = false) => {
    if (!supabase) {
      return;
    }

    resetThemePreferenceToDefault();
    const redirectTo = getOAuthRedirectTo();
    const { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: forceAccountSelection ? { prompt: "select_account" } : undefined,
      },
    });

    if (loginError) {
      setError(reportAuthError(loginError, "Googleログインを開始できませんでした。"));
      setAuthStatus("error");
    }
  }, [supabase]);

  const switchAccount = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setInitialExercisesCount(null);
    setAuthStatus("unauthenticated");
    setProfileStatus("idle");
    setInitialExercisesStatus("idle");
    await login(true);
  }, [login, supabase]);

  const logout = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(reportAuthError(logoutError, "ログアウトに失敗しました。"));
      return;
    }

    setSession(null);
    setProfile(null);
    setInitialExercisesCount(null);
    setAuthStatus("unauthenticated");
    setProfileStatus("idle");
    setInitialExercisesStatus("idle");
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !session) {
      return;
    }
    await bootstrapProfile(supabase, session);
  }, [bootstrapProfile, session, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      authStatus,
      profileStatus,
      initialExercisesStatus,
      initialExercisesCount,
      error,
      isConfigured,
      login,
      logout,
      switchAccount,
      refreshProfile,
    }),
    [
      authStatus,
      error,
      initialExercisesCount,
      initialExercisesStatus,
      isConfigured,
      login,
      logout,
      switchAccount,
      profile,
      profileStatus,
      refreshProfile,
      session,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
