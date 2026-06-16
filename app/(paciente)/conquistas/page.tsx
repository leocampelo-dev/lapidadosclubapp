import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Trophy, Flame, Star } from "lucide-react";

function getLevel(points: number) {
  if (points < 300) return { level: 1, name: "Iniciante", emoji: "🥉", nextAt: 300 };
  if (points < 700) return { level: 2, name: "Comprometido", emoji: "🥈", nextAt: 700 };
  if (points < 1200) return { level: 3, name: "Consistente", emoji: "🥇", nextAt: 1200 };
  if (points < 2000) return { level: 4, name: "Dedicado", emoji: "💎", nextAt: 2000 };
  return { level: 5, name: "Lapidado", emoji: "👑", nextAt: 2000 };
}

export default async function ConquistasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  // Pontos do paciente atual
  let totalPoints = 0;
  let ranking: { name: string; points: number; patient_id: string }[] = [];

  try {
    const { data: pts } = await supabase
      .from("points_ledger")
      .select("points")
      .eq("patient_id", patient?.id ?? "");
    totalPoints = pts?.reduce((acc, p) => acc + p.points, 0) ?? 0;

    // Ranking geral (todos os pacientes do nutri)
    const { data: allPts } = await supabase
      .from("points_ledger")
      .select("patient_id, points");

    if (allPts) {
      const grouped: Record<string, number> = {};
      allPts.forEach(({ patient_id, points }) => {
        grouped[patient_id] = (grouped[patient_id] ?? 0) + points;
      });

      const { data: patients } = await supabase
        .from("patients")
        .select("id, name")
        .in("id", Object.keys(grouped));

      ranking = (patients ?? [])
        .map((p) => ({ patient_id: p.id, name: p.name, points: grouped[p.id] ?? 0 }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10);
    }
  } catch {
    // Tabela points_ledger ainda não existe
  }

  const { level, name: levelName, emoji, nextAt } = getLevel(totalPoints);
  const progress = Math.min((totalPoints / nextAt) * 100, 100);
  const myRankPos = ranking.findIndex((r) => r.patient_id === patient?.id) + 1;

  return (
    <div className="px-4 pt-10 max-w-md mx-auto pb-4">
      <div className="mb-6">
        <p className="text-ink-secondary text-sm">Gamificação</p>
        <h1 className="text-2xl font-semibold text-ink mt-0.5">Conquistas</h1>
      </div>

      {/* Card do nível atual */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card mb-4 animate-fade-up">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{emoji}</div>
          <div className="flex-1">
            <p className="text-xs text-ink-muted font-medium uppercase tracking-wide">Nível {level}</p>
            <p className="text-xl font-bold text-ink">{levelName}</p>
            <p className="text-sm text-brand font-semibold">{totalPoints} pontos</p>
          </div>
          {myRankPos > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-ink">#{myRankPos}</p>
              <p className="text-xs text-ink-muted">ranking</p>
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="h-2.5 bg-surface-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-ink-muted mt-1.5">
            {totalPoints} / {nextAt} pts para o próximo nível
          </p>
        </div>
      </div>

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="animate-fade-up delay-1">
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-brand" />
            Ranking
          </h2>
          <div className="flex flex-col gap-2">
            {ranking.map((r, i) => {
              const isMe = r.patient_id === patient?.id;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div
                  key={r.patient_id}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                    isMe
                      ? "bg-brand/5 border-brand/20"
                      : "bg-white border-surface-muted shadow-card"
                  }`}
                >
                  <span className="text-lg w-7 text-center">
                    {i < 3 ? medals[i] : <span className="text-ink-muted text-sm font-medium">#{i + 1}</span>}
                  </span>
                  <p className={`flex-1 text-sm font-medium ${isMe ? "text-brand" : "text-ink"}`}>
                    {r.name} {isMe && "(você)"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Star size={12} className="text-brand" />
                    <span className="text-sm font-semibold text-ink">{r.points}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Como ganhar pontos */}
      <div className="mt-6 animate-fade-up delay-2">
        <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
          <Flame size={16} className="text-brand" />
          Como ganhar pontos
        </h2>
        <div className="flex flex-col gap-2">
          {[
            { action: "Fazer check-in semanal", pts: "+50 pts" },
            { action: "Adesão 8+ no check-in", pts: "+20 pts" },
            { action: "Enviar foto de evolução", pts: "+10 pts" },
            { action: "Streak de 4 semanas seguidas", pts: "+100 pts" },
          ].map((item) => (
            <div
              key={item.action}
              className="flex items-center justify-between bg-white border border-surface-muted rounded-md px-4 py-3 shadow-card"
            >
              <p className="text-sm text-ink">{item.action}</p>
              <p className="text-sm font-semibold text-brand">{item.pts}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
