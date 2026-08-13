"use client";

import {
  Calculator,
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
  { id: "profile", title: "プロフィール", icon: <User size={20} /> },
  { id: "bodyParts", title: "部位", icon: <Dumbbell size={20} /> },
  { id: "exercises", title: "種目", icon: <Dumbbell size={20} /> },
  { id: "formula", title: "計算式", icon: <Calculator size={20} /> },
  { id: "accessibility", title: "表示", icon: <Palette size={20} /> },
  { id: "support", title: "問い合わせ", icon: <Mail size={20} /> },
  { id: "account", title: "アカウント", icon: <UserCircle size={20} /> },
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
}: {
  initialSection?: SettingsSection | null;
  showBackToList?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection ?? "profile");

  useEffect(() => {
    setActiveSection(initialSection ?? "profile");
  }, [initialSection]);

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-2">
        <h1 className="px-1 text-base font-semibold">設定</h1>
        <nav className="grid gap-1 rounded-[8px] bg-[var(--surface-soft)] p-1" aria-label="設定セクション">
          {sectionItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                aria-pressed={isActive}
                className={[
                  "flex min-h-11 min-w-0 items-center gap-2 rounded-[8px] px-2 text-left text-sm",
                  isActive ? "bg-[var(--surface)] font-semibold text-[var(--text)]" : "text-[var(--muted)]",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center text-current">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {isActive ? <ChevronRight size={16} className="shrink-0" /> : null}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{renderSection(activeSection)}</div>
    </div>
  );
}
