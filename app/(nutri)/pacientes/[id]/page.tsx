import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDate, patWeekLabel } from "@/lib/utils";
import { ChevronLeft, Phone, Mail } from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  inativo: "bg-surface-subtle text-ink-muted",
  pausado: "bg-amber-100 text-amber-700",
};

export default async function PacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!patient) notFound();

  // Checkins recentes
  const { data: checkins } = await supabase
    .from("checkins")
    .select("*")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Financeiro
  const { data: financial } = await supabase
    .from("financial")
    .select("*")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const lastCheckin = checkins?.[0];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Voltar */}
      <Link href="/pacientes" className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-ink text-sm mb-5 transition-colors">
        <ChevronLeft size={16} />
        Pacientes
      </Link>

      {/* Header do paciente */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card mb-5 animate-fade-up">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-brand text-xl font-bold">
              {patient.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-ink">{patient.name}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[patient.status] ?? statusColors.inativo}`}>
                {patient.status}
              </span>
            </div>
            {patient.goal && (
              <p className="text-ink-secondary text-sm mt-0.5">🎯 {patient.goal}</p>
            )}
            <div className="flex items-center gap-4 mt-2">
              {patient.phone && (
                <a href={`tel:${patient.phone}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand transition-colors">
                  <Phone size={12} /> {patient.phone}
                </a>
              )}
              {patient.email && (
                <a href={`mailto:${patient.email}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand transition-colors">
                  <Mail size={12} /> {patient.email}
                </a>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-ink-muted">Início</p>
            <p className="text-sm font-medium text-ink">
              {patient.started_at ? formatDate(patient.started_at) : "—"}
            </p>
            <p className="text-xs text-brand font-medium mt-0.5">
              {patient.started_at ? patWeekLabel(patient.started_at) : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Último check-in */}
        <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card animate-fade-up delay-1">
          <h2 className="text-sm font-semibold text-ink mb-3">Último check-in</h2>
          {lastCheckin ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-ink-muted">{formatDate(lastCheckin.created_at)}</span>
                <span className="text-xs text-brand font-medium">Semana {lastCheckin.week}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {lastCheckin.weight && (
                  <div className="text-center p-2 bg-surface-subtle rounded-sm">
                    <p className="text-lg font-bold text-ink">{lastCheckin.weight}</p>
                    <p className="text-xs text-ink-muted">kg</p>
                  </div>
                )}
                {lastCheckin.adherence !== undefined && (
                  <div className="text-center p-2 bg-surface-subtle rounded-sm">
                    <p className="text-lg font-bold text-brand">{lastCheckin.adherence}/10</p>
                    <p className="text-xs text-ink-muted">Adesão</p>
                  </div>
                )}
                {lastCheckin.energy !== undefined && (
                  <div className="text-center p-2 bg-surface-subtle rounded-sm">
                    <p className="text-lg font-bold text-ink">{lastCheckin.energy}/10</p>
                    <p className="text-xs text-ink-muted">Energia</p>
                  </div>
                )}
              </div>
              {lastCheckin.notes && (
                <p className="text-xs text-ink-secondary mt-3 border-t border-surface-muted pt-3">
                  &ldquo;{lastCheckin.notes}&rdquo;
                </p>
              )}
              <Link
                href={`/checkins?patient=${id}`}
                className="block text-xs text-brand font-medium mt-3 hover:underline"
              >
                Ver todos os check-ins →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Nenhum check-in ainda.</p>
          )}
        </div>

        {/* Financeiro resumo */}
        <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card animate-fade-up delay-2">
          <h2 className="text-sm font-semibold text-ink mb-3">Financeiro</h2>
          {financial && financial.length > 0 ? (
            <div className="flex flex-col gap-2">
              {financial.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink truncate flex-1 mr-2">{f.description}</span>
                  <span className={f.type === "receita" ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                    {f.type === "receita" ? "+" : "-"}R$ {Number(f.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Sem registros financeiros.</p>
          )}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="mt-5 flex gap-2 flex-wrap animate-fade-up delay-3">
        <button className="h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors shadow-brand">
          Editar dieta
        </button>
        <button className="h-9 px-4 bg-white hover:bg-surface-subtle text-ink text-sm font-medium rounded-sm border border-surface-muted transition-colors">
          Editar treino
        </button>
        <button className="h-9 px-4 bg-white hover:bg-surface-subtle text-ink text-sm font-medium rounded-sm border border-surface-muted transition-colors">
          Registrar pagamento
        </button>
      </div>
    </div>
  );
}
