import { createClient } from "@/lib/supabase/server";
import PacientesClient from "./PacientesClient";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const [patientsRes, appointmentsRes, plansRes] = await Promise.all([
    supabase.from("patients").select("*").eq("user_id", user!.id).order("name"),
    supabase.from("appointments").select("*").eq("user_id", user!.id).order("date", { ascending: false }),
    supabase.from("plans").select("*").eq("user_id", user!.id).order("duration_days"),
  ]);

  const patients = patientsRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const plans = plansRes.data ?? [];

  const patientsWithStatus = patients.map((p) => {
    const patientAppts = appointments
      .filter((a) => a.patient_id === p.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastAppt = patientAppts[0] ?? null;

    const nextDate = lastAppt?.next_date ? new Date(lastAppt.next_date) : null;
    nextDate?.setHours(0, 0, 0, 0);

    const patientPlan = plans.find((pl) => pl.name === p.plan);
    const durationDays = patientPlan?.duration_days ?? 30;
    const sessions = patientPlan?.sessions ?? 1;

    const startDate = new Date(p.start_date);
    const planEnd = new Date(startDate);
    planEnd.setDate(startDate.getDate() + durationDays);
    planEnd.setHours(0, 0, 0, 0);
    const daysUntilPlanEnd = Math.ceil((planEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const lastApptDate = lastAppt ? new Date(lastAppt.date) : null;
    const daysSinceLastAppt = lastApptDate
      ? Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let alertStatus: "em_dia" | "atrasado" | "renovacao" = "em_dia";
    if (daysUntilPlanEnd <= 30 && daysUntilPlanEnd >= 0) alertStatus = "renovacao";
    else if (nextDate && nextDate < today) alertStatus = "atrasado";

    return {
      ...p,
      lastAppt,
      nextDate: nextDate ? nextDate.toISOString().split("T")[0] : null,
      daysSinceLastAppt,
      daysUntilPlanEnd,
      sessions,
      totalAppts: patientAppts.length,
      alertStatus,
      isInactive: p.status === "inativo",
    };
  });

  return <PacientesClient patients={patientsWithStatus} plans={plans} />;
}
