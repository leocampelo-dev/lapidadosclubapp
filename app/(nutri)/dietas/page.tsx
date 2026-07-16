import { createClient } from "@/lib/supabase/server";
import DietasClient from "./DietasClient";

export default async function DietasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [patientsRes, dietsRes] = await Promise.all([
    supabase.from("patients").select("id, name, phone, status").eq("owner_id", user!.id).order("name"),
    supabase.from("diet_plans").select("id, patient_id, name, active, created_at").eq("active", true),
  ]);

  const patients = patientsRes.data ?? [];
  const diets = dietsRes.data ?? [];

  const patientsWithDiet = patients.map((p) => ({
    ...p,
    diet: diets.find((d) => d.patient_id === p.id) ?? null,
    isInactive: p.status === "inativo",
  }));

  return <DietasClient patients={patientsWithDiet} />;
}
