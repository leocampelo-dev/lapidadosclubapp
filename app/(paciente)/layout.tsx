import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PacienteTabBar from "@/components/paciente/PacienteTabBar";

export default async function PacienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleData?.role === "nutri") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-surface">
      {/* Área de conteúdo com padding para tab bar */}
      <main className="pb-20">{children}</main>

      <PacienteTabBar />
    </div>
  );
}
