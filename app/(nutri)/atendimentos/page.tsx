import { createClient } from "@/lib/supabase/server";
import AtendimentosClient from "./AtendimentosClient";

export default async function AtendimentosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.toISOString().slice(0, 7); // "2026-06"

  const [appointmentsRes, patientsRes, plansRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patients(id, name, phone, plan)")
      .eq("user_id", user!.id)
      .order("date", { ascending: false }),
    supabase.from("patients").select("id, name, phone, plan").eq("user_id", user!.id).order("name"),
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
      const lastAppt = patAppts[0] ?? null;
      const plan = plans.find((pl) => pl.name === p.plan);
      return {
        patient: p,
        plan,
        appointments: patAppts,
        lastAppt,
        totalAppts: patAppts.length,
      };
    })
    .filter((g) => g.appointments.length > 0);

  // Previstos: appointments com next_date no mês atual que ainda não têm consulta registrada depois
  const previstos = appointments.filter((a) => {
    if (!a.next_date) return false;
    const nextMonth = a.next_date.slice(0, 7);
    if (nextMonth !== currentMonth) return false;
    // Verifica se já existe atendimento posterior para esse paciente
    const laterAppt = appointments.find(
      (b) => b.patient_id === a.patient_id && new Date(b.date) > new Date(a.date)
    );
    return !laterAppt;
  });

  return (
    <AtendimentosClient
      grouped={grouped}
      previstos={previstos}
      patients={patients}
      currentMonth={currentMonth}
    />
  );
}
