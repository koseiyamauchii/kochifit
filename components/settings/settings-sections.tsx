"use client";

import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Mail,
  Sun,
  Target,
  User,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BodyPartMasterCard } from "@/components/settings/body-part-master-card";
import { ExerciseMasterCard } from "@/components/settings/exercise-master-card";
import { FormulaCard } from "@/components/settings/formula-card";
import { ProfileSettingsCard } from "@/components/settings/profile-settings-card";
import { SupabaseAccountCard } from "@/components/settings/supabase-account-card";
import { SupportCard } from "@/components/settings/support-card";
import { ThemeSelector } from "@/components/settings/theme-selector";

export type SettingsSection =
  | "profile"
  | "goals"
  | "accessibility"
  | "bodyParts"
  | "exercises"
  | "formula"
  | "support"
  | "account";

const sectionItems: Array<{
  id: SettingsSection;
  title: string;
  detailTitle: string;
  icon: React.ReactNode;
}> = [
  { id: "profile", title: "プロフィール", detailTitle: "プロフィール設定", icon: <User size={21} /> },
  { id: "goals", title: "目的・目標", detailTitle: "目的・目標", icon: <Target size={21} /> },
  { id: "bodyParts", title: "部位マスタ", detailTitle: "部位マスタ", icon: <Dumbbell size={21} /> },
  { id: "exercises", title: "種目マスタ", detailTitle: "種目マスタ", icon: <Dumbbell size={21} /> },
  { id: "formula", title: "計算式", detailTitle: "計算式", icon: <Calculator size={21} /> },
  { id: "accessibility", title: "テーマ", detailTitle: "テーマ", icon: <Sun size={21} /> },
  { id: "support", title: "問い合わせ", detailTitle: "問い合わせ", icon: <Mail size={21} /> },
  { id: "account", title: "アカウント", detailTitle: "アカウント設定", icon: <UserCircle size={21} /> },
];

function renderSection(section: SettingsSection, setActiveSection: (section: SettingsSection) => void) {
  switch (section) {
    case "profile":
      return <ProfileSettingsCard mode="profile" />;
    case "goals":
      return <ProfileSettingsCard mode="goals" />;
    case "accessibility":
      return <ThemeSelector />;
    case "bodyParts":
      return <BodyPartMasterCard />;
    case "exercises":
      return <ExerciseMasterCard />;
    case "formula":
      return <FormulaCard />;
    case "support":
      return <SupportCard />;
    case "account":
      return <SupabaseAccountCard onNavigateSettings={setActiveSection} />;
  }
}

export function SettingsSections({
  initialSection = null,
  showBackToList = true,
}: {
  initialSection?: SettingsSection | null;
  showBackToList?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const activeItem = sectionItems.find((item) => item.id === activeSection);
  const showDetailHeader = Boolean(activeItem && activeSection !== "account");
  const confirmNavigation = () => {
    const navigationEvent = new CustomEvent("kochifit:confirm-navigation", {
      cancelable: true,
      detail: { scope: "settings" },
    });
    return window.dispatchEvent(navigationEvent);
  };
  const handleBack = () => {
    if (confirmNavigation()) {
      setActiveSection(showBackToList ? null : "account");
    }
  };

  return (
    <div className={activeSection === "account" ? "space-y-4" : "mx-2 space-y-4"}>
      {!activeSection ? (
        <>
          <h1 className="text-base font-semibold">設定</h1>
          <section className="rounded-[12px] bg-[var(--surface-soft)] p-1">
            <div className="grid gap-1">
              {sectionItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className="flex min-h-14 items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[var(--muted)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-base font-semibold">{item.title}</span>
                  <ChevronRight size={19} className="shrink-0 text-[var(--muted)]" />
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className={activeSection === "account" ? "space-y-4" : "mx-2 space-y-4"}>
          {showDetailHeader && activeItem ? (
            <div className="flex items-center gap-3">
              {activeSection !== "account" ? (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="設定一覧に戻る"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
                >
                  <ChevronLeft size={22} />
                </button>
              ) : null}
              <h1 className="text-base font-semibold">{activeItem.detailTitle}</h1>
            </div>
          ) : null}
          {renderSection(activeSection, setActiveSection)}
        </div>
      )}
    </div>
  );
}
