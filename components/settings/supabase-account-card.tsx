"use client";

import { AccountMenu } from "@/components/auth/account-menu";
import { useAuth } from "@/components/auth/auth-provider";
import type { SettingsSection } from "@/components/settings/settings-sections";

export function SupabaseAccountCard({
  onNavigateSettings,
}: {
  onNavigateSettings?: (section: SettingsSection) => void;
}) {
  const { error } = useAuth();

  return (
    <section className="space-y-2">
      <AccountMenu onNavigateSettings={onNavigateSettings} />
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
