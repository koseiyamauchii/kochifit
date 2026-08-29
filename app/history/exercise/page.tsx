import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { WorkoutCalendar } from "@/components/calendar/workout-calendar";

export default async function ExerciseHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ exercise?: string }>;
}) {
  const params = await searchParams;

  return (
    <AppShell active="history">
      <AuthGate>
        <main>
          <WorkoutCalendar
            backHref="/history"
            detailsHeading="種目別の記録履歴"
            exerciseHistoryId={params?.exercise}
            exerciseFilterId={params?.exercise}
            showCalendar={false}
          />
        </main>
      </AuthGate>
    </AppShell>
  );
}
