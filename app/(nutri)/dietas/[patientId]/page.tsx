import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import DietaEditorClient from "./DietaEditorClient";

export default async function DietaEditorPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name")
    .eq("id", patientId)
    .eq("owner_id", user!.id)
    .single();

  if (!patient) notFound();

  const { data: diet } = await supabase
    .from("diet_plans")
    .select("id, name, active")
    .eq("patient_id", patientId)
    .eq("active", true)
    .maybeSingle();

  let meals: any[] = [];
  if (diet) {
    const { data: mealsData } = await supabase
      .from("meals")
      .select("id, name, time, order, meal_items(id, food_name, qty, unit, kcal, protein, carbs, fat)")
      .eq("diet_id", diet.id)
      .order("order");
    meals = mealsData ?? [];
  }

  return <DietaEditorClient patient={patient} initialDiet={diet} initialMeals={meals} />;
}
