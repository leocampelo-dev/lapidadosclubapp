import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { patWeekLabel } from "@/lib/utils";
import { ChevronRight, Flame } from "lucide-react";
import Link from "next/link";

// Mapeamento de pontos para nível (igual ao LAPIDADOS_CLUB_FORMS)
function getLevel(points: number): { level: number; name: string; nextAt: number } {
  if (points < 300) return { level: 1, name: "Iniciante", nextAt: 300 };
  if (points < 700) return { level: 2, name: "Comprometido", nextAt: 700 };
  if (points < 1200) return { level: 3, name: "Consistente", nextAt: 1200 };
  if (points < 2000) return { level: 4, name: "Dedicado", nextAt: 2000 };
  return { level: 5, name: "Lapidado", nextAt: 2000 };
}

export default async function InicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Busca dados do paciente (pelo user_id linkado)
  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, started_at, goal")
    .eq("user_id", user.id)
    .single();

  // Pontos totais (tabela points_ledger — pode não existir ainda)
  let totalPoints = 0;
  try {
    const { data: pts } = await supabase
      .from("points_ledger")
      .select("points")
      .eq("patient_id", patient?.id ?? "");
    totalPoints = pts?.reduce((acc, p) => acc + p.points, 0) ?? 0;
  } catch {
    // Tabela ainda não criada — ignora
  }

  // Último check-in
  const { data: lastCheckin } = await supabase
    .from("checkins")
    .select("created_at, weight")
    .eq("patient_id", patient?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { level, name: levelName, nextAt } = getLevel(totalPoints);
  const progress = Math.min((totalPoints / nextAt) * 100, 100);
  const firstName = patient?.name?.split(" ")[0] ?? "Aluno";
  const weekLabel = patient?.started_at ? patWeekLabel(patient.started_at) : "Semana 1";

  // Próximo check-in (semanal — 7 dias após o último)
  let daysUntilCheckin = 0;
  if (lastCheckin?.created_at) {
    const last = new Date(lastCheckin.created_at);
    const next = new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000);
    daysUntilCheckin = Math.max(0, Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="px-4 pt-10 max-w-md mx-auto">
      {/* Saudação */}
      <div className="flex items-start justify-between mb-6 animate-fade-up">
        <div>
          <p className="text-ink-secondary text-sm">{weekLabel}</p>
          <h1 className="text-2xl font-semibold text-ink mt-0.5">Olá, {firstName} 👋</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
          <span className="text-brand font-semibold text-sm">{firstName.charAt(0)}</span>
        </div>
      </div>

      {/* Card de nível */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up delay-1">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">Nível {level}</p>
            <p className="text-ink font-semibold">{levelName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand">{totalPoints}</p>
            <p className="text-xs text-ink-muted">pontos</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-ink-muted mt-1.5">
          {totalPoints} / {nextAt} pts para o próximo nível
        </p>
      </div>

      {/* Check-in semanal */}
      <div className="mb-4 animate-fade-up delay-2">
        <h2 className="text-sm font-semibold text-ink mb-2">Check-in semanal</h2>
        {daysUntilCheckin > 0 ? (
          <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card flex items-center justify-between">
            <div>
              <p className="text-ink font-medium text-sm">Próximo check-in</p>
              <p className="text-ink-secondary text-xs mt-0.5">em {daysUntilCheckin} dia{daysUntilCheckin !== 1 ? "s" : ""}</p>
            </div>
            <Flame size={20} className="text-ink-disabled" />
          </div>
        ) : (
          <Link
            href="/checkin"
            className="block bg-brand rounded-md p-4 shadow-brand animate-fade-up"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-sm">Fazer check-in agora</p>
                <p className="text-white/70 text-xs mt-0.5">Ganhe pontos e mostre sua evolução</p>
              </div>
              <ChevronRight size={20} className="text-white" />
            </div>
          </Link>
        )}
      </div>

      {/* Atalhos */}
      <div className="animate-fade-up delay-3">
        <h2 className="text-sm font-semibold text-ink mb-2">Hoje</h2>
        <div className="flex flex-col gap-2">
          {[
            { href: "/dieta", label: "Ver minha dieta", sub: "Refeições de hoje" },
            { href: "/treino", label: "Ver meu treino", sub: "Exercícios do dia" },
            { href: "/evolucao", label: "Minha evolução", sub: lastCheckin ? `Último peso: ${lastCheckin.weight ?? "—"} kg` : "Sem dados ainda" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white border border-surface-muted rounded-md p-4 shadow-card flex items-center justify-between hover:shadow-card-hover transition-shadow"
            >
              <div>
                <p className="text-ink font-medium text-sm">{item.label}</p>
                <p className="text-ink-secondary text-xs mt-0.5">{item.sub}</p>
              </div>
              <ChevronRight size={16} className="text-ink-muted" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
