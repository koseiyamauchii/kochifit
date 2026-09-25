import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { ExportPanel } from "@/components/history/export-panel";

export default function ExportPage() {
  return <AppShell active="home"><AuthGate><main className="space-y-4 pb-12">
    <div className="flex items-center gap-3"><Link href="/" aria-label="ホームに戻る" className="ui-icon-button"><ChevronLeft size={22} /></Link><h1 className="text-base font-semibold">記録をエクスポート</h1></div>
    <ExportPanel />
  </main></AuthGate></AppShell>;
}
