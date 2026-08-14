import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { RecordsOverview } from "@/components/history/records-overview";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  return (
    <AppShell active="history">
      <AuthGate>
        <main className="space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="戻る"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--border)]"
            >
              <ChevronLeft size={22} />
            </Link>
            <h1 className="text-base font-semibold">履歴</h1>
          </div>
          <RecordsOverview />
        </main>
      </AuthGate>
    </AppShell>
  );
}
