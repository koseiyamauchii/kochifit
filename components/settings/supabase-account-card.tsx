"use client";

import { AccountMenu } from "@/components/auth/account-menu";
import { useAuth } from "@/components/auth/auth-provider";

export function SupabaseAccountCard() {
  const { error } = useAuth();

  return (
    <section className="space-y-2">
      <AccountMenu />
      {error ? <p className="mt-3 text-sm text-[var(--warning)]">{error}</p> : null}
    </section>
  );
}
