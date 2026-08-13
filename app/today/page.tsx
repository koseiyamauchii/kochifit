import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth/auth-gate";
import { WorkoutCalendar } from "@/components/calendar/workout-calendar";

function formatToday() {
  const today = new Date();
  return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
}

function formatDateHeading(dateKey: string) {
  return `${Number(dateKey.slice(0, 4))}年${Number(dateKey.slice(5, 7))}月${Number(
    dateKey.slice(8, 10),
  )}日`;
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params?.date;
  const heading = selectedDate ? formatDateHeading(selectedDate) : formatToday();

  return (
    <AppShell active="today">
      <AuthGate>
        <main>
          <WorkoutCalendar
            backHref="/"
            detailsHeading={heading}
            showCalendar={false}
            selectedDateOverride={selectedDate}
          />
        </main>
      </AuthGate>
    </AppShell>
  );
}
