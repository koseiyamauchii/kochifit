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

  const showModalTitle = !(initialSettingsSection === "account" && !settingsListBackEnabled);

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
            筋トレ記録アプリ
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
            className="safe-bottom max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={[
                "flex items-center justify-between gap-3",
                showModalTitle ? "mb-4" : "mb-2",
              ].join(" ")}
            >
              {showModalTitle ? <h1 className="text-base font-semibold">設定</h1> : <div />}
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="設定を閉じる"
                className="mt-2 flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--border)]"
              >
                <X size={19} />
              </button>
            </div>
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
