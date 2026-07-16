import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

/**
 * Confirma links de e-mail (recovery/invite/signup) via token_hash, em vez
 * do fluxo PKCE (?code=). Isso não depende de cookie salvo no navegador que
 * originou o pedido — funciona mesmo se o paciente abrir o link em outro
 * navegador, perfil, ou dispositivo diferente de onde solicitou.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // Recovery e invite sempre precisam passar por definir senha primeiro.
      if (type === "recovery" || type === "invite") {
        return NextResponse.redirect(`${origin}/auth/nova-senha`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/erro?motivo=link-invalido`);
}
