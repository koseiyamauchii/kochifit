"use client";

import { X } from "lucide-react";
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
  active,
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

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <div className={["mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3 pb-6 sm:px-6", active === "home" ? "pt-[7px] sm:pt-[19px]" : "pt-3 sm:pt-6"].join(" ")}>
      {user ? (
        <header className="mb-3 grid grid-cols-[36px_1fr_36px] items-center gap-2">
          <div />
          <Link href="/" className="truncate text-center text-lg font-semibold">
            KochiFit
          </Link>
          <AccountAvatarButton onClick={() => openSettings("account", false)} />
        </header>
      ) : null}

      <div className="flex-1">{children}</div>

      {isSettingsOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/45 pt-8"
          onClick={closeSettings}
        >
          <section
            className="safe-bottom relative h-full w-full overflow-y-auto rounded-t-[16px] bg-[var(--surface)] shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSettings}
              aria-label="設定を閉じる"
              className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--muted)] hover:bg-[var(--border)]"
            >
              <X size={24} />
            </button>
            <div className="px-1 pb-4 pt-4">
              <SettingsSections
                initialSection={initialSettingsSection}
                showBackToList={settingsListBackEnabled}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
