import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export default async function EvolucaoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  const { data: checkins } = await supabase
    .from("checkins")
    .select("id, week, weight, created_at, adherence, energy, sleep")
    .eq("patient_id", patient?.id ?? "")
    .order("created_at", { ascending: true });

  const hasData = checkins && checkins.length > 0;
  const firstWeight = hasData ? checkins[0].weight : null;
  const lastWeight = hasData ? checkins[checkins.length - 1].weight : null;
  const weightDiff = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  return (
    <div className="px-4 pt-10 max-w-md mx-auto">
      <div className="mb-6">
        <p className="text-ink-secondary text-sm">Histórico</p>
        <h1 className="text-2xl font-semibold text-ink mt-0.5">Minha Evolução</h1>
      </div>

      {/* Card de variação de peso */}
      {hasData && weightDiff !== null && (
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
            Variação de peso
          </p>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1 text-lg font-bold ${
                weightDiff < 0 ? "text-green-600" : weightDiff > 0 ? "text-red-500" : "text-ink-secondary"
              }`}
            >
              {weightDiff < 0 ? (
                <TrendingDown size={20} />
              ) : weightDiff > 0 ? (
                <TrendingUp size={20} />
              ) : (
                <Minus size={20} />
              )}
              {weightDiff > 0 ? "+" : ""}
              {weightDiff.toFixed(1)} kg
            </div>
            <span className="text-ink-muted text-sm">
              {firstWeight} kg → {lastWeight} kg
            </span>
          </div>
        </div>
      )}

      {/* Histórico de check-ins */}
      <div className="animate-fade-up delay-1">
        <h2 className="text-sm font-semibold text-ink mb-3">Check-ins anteriores</h2>
        {hasData ? (
          <div className="flex flex-col gap-3">
            {[...checkins].reverse().map((c) => (
              <div
                key={c.id}
                className="bg-white border border-surface-muted rounded-md p-4 shadow-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-ink">Semana {c.week}</p>
                  <p className="text-xs text-ink-muted">{formatDate(c.created_at)}</p>
                </div>
                <div className="flex gap-4">
                  {c.weight && (
                    <div>
                      <p className="text-lg font-bold text-ink">{c.weight} kg</p>
                      <p className="text-xs text-ink-muted">Peso</p>
                    </div>
                  )}
                  {c.adherence !== undefined && (
                    <div>
                      <p className="text-lg font-bold text-brand">{c.adherence}/10</p>
                      <p className="text-xs text-ink-muted">Adesão</p>
                    </div>
                  )}
                  {c.energy !== undefined && (
                    <div>
                      <p className="text-lg font-bold text-ink">{c.energy}/10</p>
                      <p className="text-xs text-ink-muted">Energia</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
            <p className="text-sm text-ink-muted text-center">
              Faça seu primeiro check-in para ver sua evolução aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
