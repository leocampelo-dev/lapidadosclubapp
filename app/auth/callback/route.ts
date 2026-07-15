import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" | "invite" | "signup" | "magiclink"
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/erro`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/erro`);
  }

  // Link de convite (1º acesso) ou de recuperação de senha → sempre precisa
  // definir uma senha antes de qualquer outra coisa.
  if (type === "recovery" || type === "invite") {
    return NextResponse.redirect(`${origin}/auth/nova-senha`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
