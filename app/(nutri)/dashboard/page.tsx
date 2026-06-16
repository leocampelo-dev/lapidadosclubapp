import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const [patientsRes, appointmentsRes, checkinsRes, financialRes, tasksRes, plansRes] = await Promise.all([
    supabase.from("patients").select("*").eq("user_id", user!.id),
    supabase.from("appointments").select("*").eq("user_id", user!.id).order("date", { ascending: false }),
    supabase.from("checkins").select("id, patient_id, created_at, diet_score").order("created_at", { ascending: false }).limit(200),
    supabase.from("financial").select("amount, type, status").eq("user_id", user!.id),
    supabase.from("tasks").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("plans").select("*").eq("user_id", user!.id),
  ]);

  const patients = patientsRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const checkins = checkinsRes.data ?? [];
  const financial = financialRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const plans = plansRes.data ?? [];

  const patientsWithAlerts = patients.map((p) => {
    // Último atendimento deste paciente
    const patientAppts = appointments
      .filter((a) => a.patient_id === p.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastAppt = patientAppts[0] ?? null;

    // next_date do último atendimento
    const nextDate = lastAppt?.next_date ? new Date(lastAppt.next_date) : null;
    nextDate?.setHours(0, 0, 0, 0);

    // Plano do paciente (busca pelo nome do campo `plan`)
    const patientPlan = plans.find((pl) => pl.name === p.plan || pl.id === p.plan);
    const durationDays = patientPlan?.duration_days ?? 30;
    const sessions = patientPlan?.sessions ?? 1;

    // Término do plano
    const startDate = new Date(p.start_date);
    const planEnd = new Date(startDate);
    planEnd.setDate(startDate.getDate() + durationDays);
    planEnd.setHours(0, 0, 0, 0);

    const daysUntilPlanEnd = Math.ceil((planEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Dias desde o último atendimento
    const lastApptDate = lastAppt ? new Date(lastAppt.date) : null;
    const daysSinceLastAppt = lastApptDate
      ? Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Lógica de alertas — ordem de prioridade
    let alert = null;
    if (daysUntilPlanEnd <= 30 && daysUntilPlanEnd >= 0) {
      alert = "renovacao";
    } else if (nextDate && nextDate < today) {
      alert = "atrasado";
    } else if (nextDate && nextDate >= today && nextDate <= in7Days) {
      alert = "proximo";
    } else if (!lastAppt) {
      // Nunca teve atendimento — não alerta ainda
      alert = null;
    }

    return {
      ...p,
      lastAppt,
      nextDate: nextDate ? nextDate.toISOString().split("T")[0] : null,
      daysSinceLastAppt,
      daysUntilPlanEnd,
      planEnd: planEnd.toISOString().split("T")[0],
      patientPlan,
      sessions,
      totalAppts: patientAppts.length,
      alert,
    };
  });

  const atrasados = patientsWithAlerts.filter((p) => p.alert === "atrasado");
  const proximos = patientsWithAlerts.filter((p) => p.alert === "proximo");
  const renovacoes = patientsWithAlerts.filter((p) => p.alert === "renovacao");

  // Check-ins desta semana
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const checkinsThisWeek = checkins.filter((c) => new Date(c.created_at) >= weekAgo);

  const scores = checkinsThisWeek
    .map((c) => c.diet_score)
    .filter((s) => typeof s === "number");
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const patientIdsWithCheckin = new Set(checkinsThisWeek.map((c) => c.patient_id));
  const pendentesCheckin = patients.filter((p) => !patientIdsWithCheckin.has(p.id)).length;

  const receitaTotal = financial
    .filter((f) => f.type === "receita" && f.status === "pago")
    .reduce((acc, f) => acc + Number(f.amount), 0);
  const pendente = financial
    .filter((f) => f.status === "pendente")
    .reduce((acc, f) => acc + Number(f.amount), 0);

  return (
    <DashboardClient
      userName={user?.email?.split("@")[0] ?? "Nutricionista"}
      patients={patients}
      plans={plans}
      patientsWithAlerts={patientsWithAlerts}
      atrasados={atrasados}
      proximos={proximos}
      renovacoes={renovacoes}
      checkinsThisWeek={checkinsThisWeek.length}
      totalPatients={patients.length}
      pendentesCheckin={pendentesCheckin}
      avgScore={avgScore}
      receitaTotal={receitaTotal}
      pendente={pendente}
      tasks={tasks}
    />
  );
}
