import { createClient } from "@/lib/supabase/server";
import AtendimentosClient from "./AtendimentosClient";

export default async function AtendimentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [appointmentsRes, patientsRes, plansRes] = await Promise.all([
    supabase.from("appointments").select("*").eq("user_id", user!.id).order("date", { ascending: false }),
    supabase.from("patients").select("id, name, phone, plan, start_date").eq("user_id", user!.id).eq("status", "ativo").order("name"),
    supabase.from("plans").select("*").eq("user_id", user!.id),
  ]);

  const appointments = appointmentsRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const plans = plansRes.data ?? [];

  // Agrupa atendimentos por paciente
  const grouped = patients
    .map((p) => {
      const patAppts = appointments
        .filter((a) => a.patient_id === p.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const plan = plans.find((pl) => pl.name === p.plan);
      return { patient: p, plan, appointments: patAppts, totalAppts: patAppts.length };
    })
    .filter((g) => g.appointments.length > 0);

  // ── PREVISTOS: gera todas as consultas futuras de todos os pacientes ─────────
  // Lógica: cada paciente tem N sessões no plano, com intervalo de 30 dias.
  // A partir da última consulta registrada (ou start_date), projeta as próximas.
  interface PrevistoItem {
    patient_id: string;
    patient_name: string;
    patient_phone?: string;
    plan_name: string;
    sessions_total: number;
    sessions_done: number;
    projected_date: string; // "2026-07-15"
    session_number: number; // qual número de consulta (ex: 2ª de 3)
    last_appt_date: string | null;
    days_until: number;
  }

  const previstos: PrevistoItem[] = [];

  patients.forEach((p) => {
    const plan = plans.find((pl) => pl.name === p.plan);
    if (!plan) return;

    const patAppts = appointments
      .filter((a) => a.patient_id === p.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const sessionsDone = patAppts.length;
    const sessionsTotal = plan.sessions;
    const remaining = sessionsTotal - sessionsDone;
    if (remaining <= 0) return; // plano completo

    // Base: last appointment next_date ou last appt date + 30, ou start_date + 30
    let baseDate: Date;
    const lastAppt = patAppts[patAppts.length - 1];
    if (lastAppt?.next_date) {
      baseDate = new Date(lastAppt.next_date);
    } else if (lastAppt) {
      baseDate = new Date(lastAppt.date);
      baseDate.setDate(baseDate.getDate() + 30);
    } else {
      baseDate = new Date(p.start_date);
      baseDate.setDate(baseDate.getDate() + 30);
    }
    baseDate.setHours(0, 0, 0, 0);

    // Projeta as consultas restantes em intervalos de 30 dias
    for (let i = 0; i < remaining; i++) {
      const projDate = new Date(baseDate);
      projDate.setDate(baseDate.getDate() + i * 30);

      // Só inclui datas futuras (a partir de hoje)
      if (projDate < today) continue;

      const daysUntil = Math.ceil((projDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      previstos.push({
        patient_id:    p.id,
        patient_name:  p.name,
        patient_phone: p.phone,
        plan_name:     plan.name,
        sessions_total: sessionsTotal,
        sessions_done:  sessionsDone,
        projected_date: projDate.toISOString().split("T")[0],
        session_number: sessionsDone + i + 1,
        last_appt_date: lastAppt?.date ?? null,
        days_until:     daysUntil,
      });
    }
  });

  // Ordena por data
  previstos.sort((a, b) => new Date(a.projected_date).getTime() - new Date(b.projected_date).getTime());

  return (
    <AtendimentosClient
      grouped={grouped}
      previstos={previstos}
      patients={patients}
      today={today.toISOString().split("T")[0]}
    />
  );
}
