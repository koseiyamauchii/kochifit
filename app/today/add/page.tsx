import { redirect } from "next/navigation";
import { toDateKey } from "@/lib/workouts/date";

export default async function TodayAddPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params?.date ?? "") ? params!.date! : toDateKey(new Date());
  redirect(`/today?date=${date}&add=1`);
}
