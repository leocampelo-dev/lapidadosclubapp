import { createClient } from "@/lib/supabase/server";
import { formatDate, patWeekLabel } from "@/lib/utils";
import { Search, UserPlus, ChevronRight } from "lucide-react";
import Link from "next/link";

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  inativo: "bg-surface-subtle text-ink-muted",
  pausado: "bg-amber-100 text-amber-700",
};

export default async function PacientesPage() {
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, name, email, phone, status, started_at, goal")
    .order("name");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Pacientes</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {patients?.length ?? 0} no total
          </p>
        </div>
        <button className="flex items-center gap-2 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors shadow-brand">
          <UserPlus size={15} />
          Novo paciente
        </button>
      </div>

      {/* Search (decorativo por ora) */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          placeholder="Buscar paciente..."
          className="w-full h-9 pl-9 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {/* Lista */}
      <div className="flex flex-col gap-2">
        {patients?.map((p, i) => (
          <Link
            key={p.id}
            href={`/pacientes/${p.id}`}
            className={`bg-white border border-surface-muted rounded-md px-4 py-3.5 shadow-card
                       hover:shadow-card-hover transition-shadow flex items-center gap-3 animate-fade-up delay-${Math.min(i + 1, 4)}`}
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-brand text-sm font-semibold">
                {p.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[p.status] ?? statusColors.inativo}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {p.started_at ? patWeekLabel(p.started_at) : "—"}
                {p.goal ? ` · ${p.goal}` : ""}
              </p>
            </div>

            <ChevronRight size={16} className="text-ink-muted shrink-0" />
          </Link>
        ))}

        {(!patients || patients.length === 0) && (
          <div className="bg-white border border-surface-muted rounded-md p-8 text-center">
            <p className="text-ink-secondary text-sm">Nenhum paciente cadastrado ainda.</p>
            <p className="text-ink-muted text-xs mt-1">Clique em "Novo paciente" para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
