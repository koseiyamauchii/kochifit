import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { RecordsOverview } from "@/components/history/records-overview";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  return (
    <AppShell active="history">
      <AuthGate>
        <main className="space-y-5">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold"
          >
            <ArrowLeft size={17} />
            戻る
          </Link>
          <RecordsOverview />
        </main>
      </AuthGate>
    </AppShell>
  );
}
