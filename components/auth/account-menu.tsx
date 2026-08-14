"use client";

import {
  Calculator,
  ChevronRight,
  Dumbbell,
  Flag,
  LogOut,
  Mail,
  RefreshCw,
  Repeat2,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/auth/auth-provider";
import { ThemeSelector } from "@/components/settings/theme-selector";
import type { SettingsSection } from "@/components/settings/settings-sections";

const settingsGroups: Array<{
  label: string;
  items: Array<{ label: string; section: SettingsSection; icon: React.ReactNode }>;
}> = [
  {
    label: "プロフィール",
    items: [
      { label: "プロフィール設定", section: "profile", icon: <UserRound size={18} /> },
      { label: "目標", section: "goals", icon: <Flag size={18} /> },
    ],
  },
  {
    label: "マスタ",
    items: [
      { label: "部位マスタ", section: "bodyParts", icon: <Dumbbell size={18} /> },
      { label: "種目マスタ", section: "exercises", icon: <Dumbbell size={18} /> },
    ],
  },
  {
    label: "記録",
    items: [{ label: "計算式", section: "formula", icon: <Calculator size={18} /> }],
  },
];

const supportItems: Array<{ label: string; section: SettingsSection; icon: React.ReactNode }> = [
  { label: "問い合わせ", section: "support", icon: <Mail size={18} /> },
];

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

export function AccountMenu({
  onNavigateSettings,
}: {
  onNavigateSettings?: (section: SettingsSection) => void;
}) {
  const { profile, refreshProfile, logout, switchAccount, user } = useAuth();
  const displayName =
    profile?.display_name ??
    user?.user_metadata.full_name ??
    user?.user_metadata.name ??
    "Googleユーザー";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata.avatar_url;
  const mail = user?.email ?? "";

  return (
    <div className="space-y-5 pt-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[var(--shadow)]">
          {typeof avatarUrl === "string" && avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
          ) : (
            <UserRound size={34} />
          )}
        </div>
        <p className="mt-3 max-w-full truncate text-lg font-semibold">{displayName}</p>
        <p className="mt-1 max-w-full truncate text-sm text-[var(--muted)]">{mail}</p>
      </div>

      <div className="mx-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium"
        >
          <LogOut size={17} />
          ログアウト
        </button>
        <button
          type="button"
          onClick={() => void refreshProfile()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[var(--border)] px-3 py-2 text-sm font-medium"
        >
          <RefreshCw size={17} />
          プロフィール更新
        </button>
        <button
          type="button"
          onClick={() => void switchAccount()}
          className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
        >
          <Repeat2 size={17} />
          アカウント切り替え
        </button>
      </div>

      <div className="mx-2 space-y-4">
        {settingsGroups.map((group) => (
          <section key={group.label} className="space-y-1">
            <h2 className="px-1 text-xs font-semibold text-[var(--muted)]">{group.label}</h2>
            <div className="overflow-hidden rounded-[12px] bg-[var(--surface-soft)]">
              {group.items.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigateSettings?.(item.section)}
                  className={[
                    "flex min-h-12 w-full items-center justify-between gap-3 px-2.5 text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]",
                    index > 0 ? "border-t border-[var(--hairline)]" : "",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--muted)]">
                      {item.icon}
                    </span>
                    <span className="min-w-0 truncate">{item.label}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[var(--muted)]" />
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-1">
          <h2 className="px-1 text-xs font-semibold text-[var(--muted)]">テーマ</h2>
          <ThemeSelector compact />
        </section>

        <section className="space-y-1">
          <h2 className="px-1 text-xs font-semibold text-[var(--muted)]">サポート</h2>
          <div className="overflow-hidden rounded-[12px] bg-[var(--surface-soft)]">
            {supportItems.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigateSettings?.(item.section)}
                className={[
                  "flex min-h-12 w-full items-center justify-between gap-3 px-2.5 text-left text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]",
                  index > 0 ? "border-t border-[var(--hairline)]" : "",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--muted)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
