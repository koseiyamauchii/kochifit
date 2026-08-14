"use client";

import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authStatus, error, isConfigured, login, user } = useAuth();
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    if (authStatus !== "loading") {
      setIsSlowLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setIsSlowLoading(true), 6000);
    return () => window.clearTimeout(timer);
  }, [authStatus]);

  if (authStatus === "loading") {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-[var(--shadow)]">
          <p className="text-sm text-[var(--muted)]">起動中</p>
          {isSlowLoading ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              起動に時間がかかっています。スマホ確認では `pnpm run dev:lan` で起動し、
              `http://PCのLAN内IP:3000` のようにポート番号付きで開いてください。
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (!isConfigured) {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <p className="text-sm font-medium text-[var(--muted)]">トレーニング記録</p>
          <h1 className="mt-1 text-3xl font-semibold">KochiFit</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            アプリの認証設定が完了していません。
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow)]">
          <p className="text-sm font-medium text-[var(--muted)]">トレーニング記録</p>
          <h1 className="mt-1 text-3xl font-semibold">KochiFit</h1>
          <button
            type="button"
            onClick={() => void login()}
            className="mt-6 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-4 py-3 font-semibold text-white"
          >
            <LogIn size={20} />
            Googleでログイン
          </button>
          {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
        </div>
      </main>
    );
  }

  return children;
}
