export default function LoadingWorkoutPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-3 py-3" aria-busy="true">
      <p role="status" className="text-sm text-[var(--muted)]">記録画面を開いています</p>
      <div className="h-10 animate-pulse rounded-[12px] bg-[var(--surface-soft)]" />
      <div className="h-40 animate-pulse rounded-[12px] bg-[var(--surface-soft)]" />
    </main>
  );
}
