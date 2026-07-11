import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InicioClient from "./InicioClient";

function isoWeek(d = new Date()) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay() || 7));
  const ys = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((u.getTime() - ys.getTime()) / 86400000) + 1) / 7),
    year: u.getUTCFullYear(),
  };
}

function calcStreak(checkins: { week_number: number; year: number }[]): number {
  if (!checkins.length) return 0;
  const sorted = [...checkins].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.week_number - a.week_number
  );
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1].year * 100 + sorted[i - 1].week_number;
    const b = sorted[i].year * 100 + sorted[i].week_number;
    if (a - b === 1 || a - b === -51) streak++;
    else break;
  }
  return streak;
}

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { week: currentWeek, year: currentYear } = isoWeek();

  const { data: patient } = await supabase
    .from("patients").select("id, name, plan, start_date")
    .eq("user_id", user.id).single();

  if (!patient) redirect("/auth/login");

  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, week_number, year, lapidados_score, diet_score, training_score, sleep_score, energy_level, created_at")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const all = checkins ?? [];
  const totalPts = all.reduce((s, c) => s + (c.lapidados_score || 0), 0);
  const weekCheckin = all.find((c) => c.week_number === currentWeek && c.year === currentYear) ?? null;
  const streak = calcStreak(all.map((c) => ({ week_number: c.week_number, year: c.year })));

  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x != null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
  };

  return (
    <InicioClient
      patient={patient}
      totalPts={totalPts}
      checkinCount={all.length}
      currentStreak={streak}
      bestStreak={streak}
      avgDiet={avg(all.map((c) => c.diet_score))}
      avgTraining={avg(all.map((c) => c.training_score))}
      avgSleep={avg(all.map((c) => c.sleep_score))}
      weekCheckin={weekCheckin}
      currentWeek={currentWeek}
      currentYear={currentYear}
      recentCheckins={all.slice(0, 5).map((c) => ({
        week_number: c.week_number, year: c.year,
        lapidados_score: c.lapidados_score, created_at: c.created_at,
      }))}
    />
  );
}
