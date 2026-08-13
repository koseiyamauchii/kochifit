"use client";

import { LogOut, RefreshCw, Repeat2, UserRound } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/auth/auth-provider";

export function AccountAvatarButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  const { profile, user } = useAuth();
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata.avatar_url;
  const displayName =
    profile?.display_name ??
    user?.user_metadata.full_name ??
    user?.user_metadata.name ??
    "Googleユーザー";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Googleアカウント"
      title={displayName}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-soft)] text-[var(--accent-strong)] shadow-[var(--shadow)]"
    >
      {typeof avatarUrl === "string" && avatarUrl ? (
        <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
      ) : (
        <UserRound size={19} />
      )}
    </button>
  );
}

export function AccountMenu() {
  const { profile, refreshProfile, logout, switchAccount, user } = useAuth();
  const displayName =
    profile?.display_name ??
    user?.user_metadata.full_name ??
    user?.user_metadata.name ??
    "Googleユーザー";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata.avatar_url;
  const mail = user?.email ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          {typeof avatarUrl === "string" && avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <UserRound size={22} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{displayName}</p>
          <p className="truncate text-sm text-[var(--muted)]">{mail}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void refreshProfile()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[var(--border)] px-3 py-2 text-sm font-medium"
        >
          <RefreshCw size={17} />
          プロフィール更新
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium"
        >
          <LogOut size={17} />
          ログアウト
        </button>
        <button
          type="button"
          onClick={() => void switchAccount()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white sm:col-span-2"
        >
          <Repeat2 size={17} />
          アカウント切り替え
        </button>
      </div>
    </div>
  );
}
