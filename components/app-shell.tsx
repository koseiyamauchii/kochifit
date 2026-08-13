"use client";

import { Settings, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AccountAvatarButton } from "@/components/auth/account-menu";
import { useAuth } from "@/components/auth/auth-provider";
import {
  SettingsSections,
  type SettingsSection,
} from "@/components/settings/settings-sections";

type ActiveRoute = "home" | "today" | "history" | "settings";

export function AppShell({
  children,
}: {
  active: ActiveRoute;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [initialSettingsSection, setInitialSettingsSection] = useState<SettingsSection | null>(null);
  const [settingsListBackEnabled, setSettingsListBackEnabled] = useState(true);

  const openSettings = (section: SettingsSection | null = null, showBackToList = true) => {
    setInitialSettingsSection(section);
    setSettingsListBackEnabled(showBackToList);
    setIsSettingsOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3 pb-6 pt-3 sm:px-6 sm:pt-6">
      {user ? (
        <header className="mb-3 grid grid-cols-[40px_1fr_36px] items-center gap-2">
          <button
            type="button"
            onClick={() => openSettings(null, true)}
            aria-label="設定"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text)]"
          >
            <Settings size={22} />
          </button>
          <Link href="/" className="truncate text-center text-lg font-semibold">
            KochiFit
          </Link>
          <AccountAvatarButton onClick={() => openSettings("account", false)} />
        </header>
      ) : null}

      <div className="flex-1">{children}</div>

      {isSettingsOpen ? (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/45 px-3 pb-3 sm:items-center sm:justify-center sm:p-6"
          onClick={() => setIsSettingsOpen(false)}
        >
          <section
            className="safe-bottom relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              aria-label="設定を閉じる"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--muted)] hover:bg-[var(--border)]"
            >
              <X size={18} />
            </button>
            <SettingsSections
              initialSection={initialSettingsSection}
              showBackToList={settingsListBackEnabled}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
