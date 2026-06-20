import { createClient } from "@/lib/supabase/server";
import CheckinsHub from "./CheckinsHub";

export default async function CheckinsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const currentWeek = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  const currentYear = now.getFullYear();

  const [checkinsRes, patientsRes, profileRes] = await Promise.all([
    supabase.from("checkins").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("patients").select("id, name, phone, plan, start_date").eq("user_id", user!.id).order("name"),
    supabase.from("profile").select("gemini_api_key, groq_api_key").eq("user_id", user!.id).maybeSingle(),
  ]);

  const allCheckins = checkinsRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const geminiKey = profileRes.data?.gemini_api_key ?? "";
  const groqKey = profileRes.data?.groq_api_key ?? "";

  // Filtra checkins apenas dos pacientes deste nutri
  const patientIds = new Set(patients.map((p) => p.id));
  const checkins = allCheckins.filter((c) => patientIds.has(c.patient_id));

  // Monta dados enriquecidos por paciente
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
    );

    // Streak: semanas consecutivas com check-in (contando de trás pra frente)
    let streak = 0;
    if (patCheckins.length > 0) {
      let expectedWeek = currentWeek;
      let expectedYear = currentYear;
      for (const c of patCheckins) {
        if (c.week_number === expectedWeek && c.year === expectedYear) {
          streak++;
          expectedWeek--;
          if (expectedWeek === 0) { expectedWeek = 52; expectedYear--; }
        } else break;
      }
    }

    // Risco de evasão: sem check-in nas últimas 2 semanas
    const recentCheckins = patCheckins.filter((c) => {
      const diff = (currentYear - c.year) * 52 + (currentWeek - c.week_number);
      return diff <= 2;
    });
    const evasionRisk = recentCheckins.length === 0 && patCheckins.length > 0;
    const neverCheckedIn = patCheckins.length === 0;

    return {
      patient: p,
      checkins: patCheckins,
      weekCheckin: weekCheckin ?? null,
      totalPts,
      streak,
      evasionRisk,
      neverCheckedIn,
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
