import { notFound } from "next/navigation";
import WorkoutScreen from "@/components/WorkoutScreen";
import { getWorkout, WORKOUTS } from "@/lib/plan";

export const dynamicParams = false;

export function generateStaticParams() {
  return WORKOUTS.map((w) => ({ week: String(w.week), day: String(w.day) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ week: string; day: string }>;
}) {
  const { week, day } = await params;
  return { title: `Week ${week} · Run ${day} — Couch to 5K` };
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ week: string; day: string }>;
}) {
  const { week, day } = await params;
  const workout = getWorkout(Number(week), Number(day));
  if (!workout) notFound();
  return <WorkoutScreen workout={workout} />;
}
