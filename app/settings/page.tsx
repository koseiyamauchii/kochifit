import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { SettingsSections, type SettingsSection } from "@/components/settings/settings-sections";

const settingsSections = new Set<SettingsSection>([
  "profile", "goals", "accessibility", "bodyParts", "exercises", "formula", "support", "account",
]);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  const section = params?.section;
  const initialSection = section && settingsSections.has(section as SettingsSection)
    ? section as SettingsSection
    : null;
  return (
    <AppShell active="settings">
      <AuthGate>
        <main className="space-y-4">
          <h1 className="text-base font-semibold">設定</h1>
          <SettingsSections initialSection={initialSection} />
        </main>
      </AuthGate>
    </AppShell>
  );
}
