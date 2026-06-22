import { createClient } from "@/lib/supabase/server";
import CheckinsHub from "./CheckinsHub";

function isoWeek(d = new Date()) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  u.setUTCDate(u.getUTCDate() + 4 - (u.getUTCDay() || 7));
  const ys = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil((((u.getTime() - ys.getTime()) / 86400000) + 1) / 7),
    year: u.getUTCFullYear(),
  };
}

export default async function CheckinsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { week: currentWeek, year: currentYear } = isoWeek();

  const [checkinsRes, patientsRes, profileRes] = await Promise.all([
    supabase.from("checkins").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("patients").select("id, name, phone, plan, start_date").eq("user_id", user!.id).order("name"),
    supabase.from("profile").select("gemini_api_key, groq_api_key").eq("user_id", user!.id).maybeSingle(),
  ]);

  const allCheckins = checkinsRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const geminiKey = profileRes.data?.gemini_api_key ?? "";
  const groqKey = profileRes.data?.groq_api_key ?? "";

  const patientIds = new Set(patients.map((p) => p.id));
  const checkins = allCheckins.filter((c) => patientIds.has(c.patient_id));

  function calcStreak(history: typeof checkins) {
    if (!history.length) return 0;
    let s = 1;
    for (let i = 1; i < history.length; i++) {
      const a = history[i - 1].year * 100 + history[i - 1].week_number;
      const b = history[i].year * 100 + history[i].week_number;
      const d = a - b;
      if (d === 1 || d === -51) s++;
      else break;
    }
    return s;
  }

  const enriched = patients.map((p) => {
    const patCheckins = checkins
      .filter((c) => c.patient_id === p.id)
      .sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return b.week_number - a.week_number;
      });

    const totalPts = patCheckins.reduce((s, c) => s + (c.lapidados_score || 0), 0);
    const weekCheckin = patCheckins.find(
      (c) => c.week_number === currentWeek && c.year === currentYear
    ) ?? null;

    const streak = calcStreak(patCheckins);

    const recentCheckins = patCheckins.filter((c) => {
      const diff = (currentYear - c.year) * 52 + (currentWeek - c.week_number);
      return diff <= 2;
    });
    const evasionRisk = recentCheckins.length === 0 && patCheckins.length > 0;

    return {
      patient: p,
      checkins: patCheckins,
      weekCheckin,
      totalPts,
      streak,
      evasionRisk,
      neverCheckedIn: patCheckins.length === 0,
      hasThisWeek: !!weekCheckin,
    };
  });

  const responderam = enriched.filter((e) => e.hasThisWeek).length;
  const pendentes = patients.length - responderam;
  const scores = enriched.filter((e) => e.weekCheckin).map((e) => e.weekCheckin!.lapidados_score || 0);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return (
    <CheckinsHub
      enriched={enriched}
      currentWeek={currentWeek}
      currentYear={currentYear}
      totalPatients={patients.length}
      responderam={responderam}
      pendentes={pendentes}
      avgScore={avgScore}
      geminiKey={geminiKey}
      groqKey={groqKey}
    />
  );
}
