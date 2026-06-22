import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CheckinForm from "./CheckinForm";

function isoWeek(d = new Date()) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay() || 7));
  const ys = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((u.getTime() - ys.getTime()) / 86400000) + 1) / 7),
    year: u.getUTCFullYear(),
  };
}

export default async function CheckinPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { week: currentWeek, year: currentYear } = isoWeek();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, plan, start_date")
    .eq("user_id", user.id)
    .single();

  if (!patient) redirect("/inicio");

  const [existingRes, historyRes] = await Promise.all([
    supabase.from("checkins").select("id").eq("patient_id", patient.id)
      .eq("week_number", currentWeek).eq("year", currentYear).maybeSingle(),
    supabase.from("checkins").select("id, week_number, year, lapidados_score, diet_score, training_score, sleep_score, energy_level, wins, main_difficulty, created_at")
      .eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const totalPts = (historyRes.data ?? []).reduce((acc, c) => acc + (c.lapidados_score || 0), 0);

  return (
    <CheckinForm
      patient={patient}
      currentWeek={currentWeek}
      currentYear={currentYear}
      alreadyDone={!!existingRes.data}
      history={historyRes.data ?? []}
      totalPts={totalPts}
    />
  );
}
