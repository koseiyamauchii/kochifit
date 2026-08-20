import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { WorkoutCalendar } from "@/components/calendar/workout-calendar";

function todayKey() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function normalizeDateKey(value: string | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : todayKey();
}

function formatDateHeading(dateKey: string) {
  return `${Number(dateKey.slice(0, 4))}年${Number(dateKey.slice(5, 7))}月${Number(
    dateKey.slice(8, 10),
  )}日の記録を追加`;
}

export default async function TodayAddPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = normalizeDateKey(params?.date);

  return (
    <AppShell active="today" immersive>
      <AuthGate>
        <main>
          <WorkoutCalendar
            backHref={`/today?date=${selectedDate}`}
            detailsHeading={formatDateHeading(selectedDate)}
            showAddForm
            showCalendar={false}
            selectedDateOverride={selectedDate}
          />
        </main>
      </AuthGate>
    </AppShell>
  );
}
