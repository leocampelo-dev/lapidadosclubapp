import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NutriSidebar from "@/components/nutri/NutriSidebar";

export default async function NutriLayout({
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

  if (roleData?.role !== "nutri") redirect("/inicio");

  // Busca nome do nutri
  const { data: profile } = await supabase
    .from("profile")
    .select("name, avatar_url")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex h-screen bg-nutri-bg overflow-hidden">
      <NutriSidebar userName={profile?.name ?? "Nutricionista"} />

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto bg-[#F8F8F8]">
        {children}
      </main>
    </div>
  );
}
