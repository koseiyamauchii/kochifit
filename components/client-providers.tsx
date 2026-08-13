"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/settings/theme-provider";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
