import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { HomeDashboard } from "@/components/home/home-dashboard";

export default function Home() {
  return (
    <AppShell active="home">
      <AuthGate>
        <HomeDashboard />
      </AuthGate>
    </AppShell>
  );
}
