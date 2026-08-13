"use client";

import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Mail,
  Palette,
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
  | "accessibility"
  | "bodyParts"
  | "exercises"
  | "formula"
  | "support"
  | "account";

const sectionItems: Array<{
  id: SettingsSection;
  title: string;
  icon: React.ReactNode;
}> = [
  { id: "profile", title: "プロフィール", icon: <User size={21} /> },
  { id: "bodyParts", title: "部位マスタ", icon: <Dumbbell size={21} /> },
  { id: "exercises", title: "種目マスタ", icon: <Dumbbell size={21} /> },
  { id: "formula", title: "計算式", icon: <Calculator size={21} /> },
  { id: "accessibility", title: "アクセシビリティ", icon: <Palette size={21} /> },
  { id: "support", title: "問い合わせ", icon: <Mail size={21} /> },
  { id: "account", title: "アカウント", icon: <UserCircle size={21} /> },
];

function renderSection(section: SettingsSection) {
  switch (section) {
    case "profile":
      return <ProfileSettingsCard />;
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
      return <SupabaseAccountCard />;
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

  return (
    <div className="space-y-4">
      {activeSection && showBackToList ? (
        <button
          type="button"
          onClick={() => setActiveSection(null)}
          className="flex min-h-11 items-center gap-2 rounded-[8px] border border-[var(--border)] px-3 text-base font-semibold"
        >
          <ChevronLeft size={19} />
          設定一覧
        </button>
      ) : null}

      {!activeSection ? (
        <section className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow)]">
          <div className="grid gap-1">
            {sectionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className="flex min-h-14 items-center gap-3 rounded-[8px] px-3 py-2 text-left text-[var(--text)] hover:bg-[var(--surface-soft)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface-soft)]">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 text-base font-semibold">{item.title}</span>
                <ChevronRight size={19} className="shrink-0 text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div>
          {activeItem && showBackToList && activeSection !== "account" ? (
            <h2 className="mb-3 text-base font-semibold">{activeItem.title}</h2>
          ) : null}
          {renderSection(activeSection)}
        </div>
      )}
    </div>
  );
}
