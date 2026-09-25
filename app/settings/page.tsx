import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { SettingsSections, type SettingsSection } from "@/components/settings/settings-sections";

const settingsSections = new Set<SettingsSection>([
  "profile", "goals", "accessibility", "bodyParts", "exercises", "formula", "support", "account", "export",
]);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; returnTo?: string }>;
}) {
  const params = await searchParams;
  const section = params?.section;
  const initialSection = section && settingsSections.has(section as SettingsSection)
    ? section as SettingsSection
    : null;
  const returnHref = params?.returnTo && (params.returnTo === "/" || /^\/today(?:\/add)?(?:\?|$)/.test(params.returnTo))
    ? params.returnTo
    : undefined;
  return (
    <AppShell active="settings">
      <AuthGate>
        <main className="space-y-4">
          <SettingsSections key={initialSection} initialSection={initialSection} returnHref={returnHref} />
        </main>
      </AuthGate>
    </AppShell>
  );
}
