import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { StatsDashboard } from "@/components/home/stats-dashboard";

export default function StatsPage() {
  return (
    <AppShell active="home">
      <AuthGate>
        <main className="space-y-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="ホームへ戻る"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]">
              <ChevronLeft size={22} />
            </Link>
            <h1 className="text-base font-semibold">トレーニング集計</h1>
          </div>
          <StatsDashboard />
        </main>
      </AuthGate>
    </AppShell>
  );
}
