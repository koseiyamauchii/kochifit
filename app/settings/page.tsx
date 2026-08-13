import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { SettingsSections } from "@/components/settings/settings-sections";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <AuthGate>
        <main className="space-y-4">
          <h1 className="text-base font-semibold">設定</h1>
          <SettingsSections />
        </main>
      </AuthGate>
    </AppShell>
  );
}
