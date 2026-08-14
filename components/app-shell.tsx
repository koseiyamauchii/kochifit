"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
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
  const settingsPanelRef = useRef<HTMLElement | null>(null);
  const settingsSwipeStartYRef = useRef<number | null>(null);
  const [settingsSwipeOffset, setSettingsSwipeOffset] = useState(0);

  const openSettings = (section: SettingsSection | null = null, showBackToList = true) => {
    setInitialSettingsSection(section);
    setSettingsListBackEnabled(showBackToList);
    setSettingsSwipeOffset(0);
    setIsSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsSwipeOffset(0);
    setIsSettingsOpen(false);
  };

  const handleSettingsTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (settingsPanelRef.current && settingsPanelRef.current.scrollTop > 0) {
      settingsSwipeStartYRef.current = null;
      return;
    }
    settingsSwipeStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleSettingsTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const startY = settingsSwipeStartYRef.current;
    if (startY === null) {
      return;
    }
    const nextOffset = Math.max(0, (event.touches[0]?.clientY ?? startY) - startY);
    setSettingsSwipeOffset(nextOffset);
  };

  const handleSettingsTouchEnd = () => {
    if (settingsSwipeOffset > 90) {
      closeSettings();
    } else {
      setSettingsSwipeOffset(0);
    }
    settingsSwipeStartYRef.current = null;
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
            ref={settingsPanelRef}
            className="safe-bottom relative h-full w-full overflow-y-auto rounded-t-[16px] bg-[var(--surface)] shadow-[var(--shadow)]"
            style={{
              transform: settingsSwipeOffset ? `translateY(${settingsSwipeOffset}px)` : undefined,
              transition: settingsSwipeOffset ? undefined : "transform 160ms ease",
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleSettingsTouchStart}
            onTouchMove={handleSettingsTouchMove}
            onTouchEnd={handleSettingsTouchEnd}
            onTouchCancel={handleSettingsTouchEnd}
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
