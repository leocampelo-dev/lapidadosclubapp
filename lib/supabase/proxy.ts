import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca a sessão — obrigatório para o SSR funcionar
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Rotas públicas — não exigem auth
  const publicRoutes = ["/auth/login", "/auth/callback", "/auth/erro"];
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // Sem usuário → login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return NextResponse.redirect(loginUrl);
  }

  // Busca o role do usuário na tabela user_roles
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const role = roleData?.role ?? "paciente";

  // Redireciona para a raiz correta se necessário
  if (pathname === "/") {
    const dest = request.nextUrl.clone();
    dest.pathname = role === "nutri" ? "/dashboard" : "/inicio";
    return NextResponse.redirect(dest);
  }

  // Bloqueia paciente tentando acessar rotas do nutri e vice-versa.
  // Usa match por segmento inteiro (não startsWith cru) pra "/dietas" não
  // ser confundido com "/dieta", nem "/treinos" com "/treino".
  const matchesRoute = (path: string, route: string) =>
    path === route || path.startsWith(route + "/");

  const nutriRoutes = ["/dashboard", "/pacientes", "/checkins", "/atendimentos", "/dietas", "/treinos", "/financeiro", "/membros"];
  const pacienteRoutes = ["/inicio", "/dieta", "/treino", "/checkin", "/evolucao", "/conquistas"];

  if (role === "paciente" && nutriRoutes.some((r) => matchesRoute(pathname, r))) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/inicio";
    return NextResponse.redirect(dest);
  }

  if (role === "nutri" && pacienteRoutes.some((r) => matchesRoute(pathname, r))) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/dashboard";
    return NextResponse.redirect(dest);
  }

  return supabaseResponse;
}
