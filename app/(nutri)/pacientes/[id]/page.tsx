import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import PacienteDetailClient from "./PacienteDetailClient";

export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [patientRes, appointmentsRes, financialRes, plansRes] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("appointments").select("*").eq("patient_id", id).order("date", { ascending: false }),
    supabase.from("financial").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("plans").select("*").eq("user_id", user!.id),
  ]);

  if (!patientRes.data) notFound();

  const patient = patientRes.data;
  const appointments = appointmentsRes.data ?? [];
  const financial = financialRes.data ?? [];
  const plans = plansRes.data ?? [];
  const plan = plans.find((pl) => pl.name === patient.plan);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastAppt = appointments[0] ?? null;
  const nextDate = lastAppt?.next_date ? new Date(lastAppt.next_date) : null;
  nextDate?.setHours(0, 0, 0, 0);

  const startDate = new Date(patient.start_date);
  const durationDays = plan?.duration_days ?? 30;
  const planEnd = new Date(startDate);
  planEnd.setDate(startDate.getDate() + durationDays);
  const daysUntilPlanEnd = Math.ceil((planEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const lastApptDate = lastAppt ? new Date(lastAppt.date) : null;
  const daysSinceLastAppt = lastApptDate
    ? Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let status: "em_dia" | "atrasado" | "renovacao" = "em_dia";
  if (daysUntilPlanEnd <= 30 && daysUntilPlanEnd >= 0) status = "renovacao";
  else if (nextDate && nextDate < today) status = "atrasado";

  const totalPago = financial.reduce((acc, f) => acc + Number(f.paid_value || 0), 0);
  const totalPendente = financial.reduce((acc, f) => acc + (Number(f.total_value || 0) - Number(f.paid_value || 0)), 0);

  return (
    <PacienteDetailClient
      patient={patient}
      appointments={appointments}
      financial={financial}
      plan={plan}
      plans={plans}
      status={status}
      daysSinceLastAppt={daysSinceLastAppt}
      daysUntilPlanEnd={daysUntilPlanEnd}
      planEndDate={planEnd.toISOString().split("T")[0]}
      nextDate={nextDate ? nextDate.toISOString().split("T")[0] : null}
      totalPago={totalPago}
      totalPendente={totalPendente}
    />
  );
}
