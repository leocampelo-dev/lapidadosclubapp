import { createClient } from "@/lib/supabase/server";
import FinanceiroClient from "./FinanceiroClient";

export default async function FinanceiroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [recordsRes, patientsRes] = await Promise.all([
    supabase.from("financial").select("*, patients(name, plan)").eq("user_id", user!.id).order("date", { ascending: false }),
    supabase.from("patients").select("id, name").eq("user_id", user!.id).order("name"),
  ]);

  return <FinanceiroClient records={recordsRes.data ?? []} patients={patientsRes.data ?? []} />;
}
