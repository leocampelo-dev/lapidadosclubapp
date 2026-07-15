import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // --- Guarda de autorização: só o nutricionista logado pode convidar. ---
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "nutri") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    // --- Fim da guarda ---

    const { email, patientId, patientName } = await request.json();

    if (!email || !patientId) {
      return NextResponse.json({ error: "email e patientId são obrigatórios" }, { status: 400 });
    }

    // Usa service role para operações admin
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Garante que o patientId pertence de fato a este nutricionista antes de
    // vincular qualquer conta a ele.
    const { data: patientRow } = await adminSupabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .single();

    if (!patientRow) {
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    // 1. Verifica se já existe usuário com esse email
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === email);

    let userId: string;

    if (existing) {
      // Usuário já existe — usa o ID existente
      userId = existing.id;
    } else {
      // 2. Cria o usuário via invite (envia email automático)
      const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
        data: { patient_name: patientName },
      });

      if (inviteError) throw inviteError;
      userId = inviteData.user.id;
    }

    // 3. Linka o user ao paciente
    await adminSupabase.from("patients").update({ user_id: userId }).eq("id", patientId);

    // 4. Cria o role de paciente se não existir
    await adminSupabase.from("user_roles").upsert(
      { user_id: userId, role: "paciente" },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ success: true, userId });
  } catch (e: unknown) {
    console.error("Erro ao convidar paciente:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }
}
