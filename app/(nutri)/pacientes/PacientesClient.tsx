"use client";

import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Search, UserPlus, ChevronRight, Phone } from "lucide-react";
import Link from "next/link";
import NovoPacienteWizard from "@/components/nutri/NovoPacienteWizard";

interface Patient {
  id: string;
  name: string;
  phone?: string;
  plan?: string;
  start_date: string;
  notes?: string;
  nextDate?: string | null;
  daysSinceLastAppt?: number | null;
  daysUntilPlanEnd?: number;
  sessions?: number;
  totalAppts?: number;
  alertStatus: "em_dia" | "atrasado" | "renovacao";
  isInactive: boolean;
}

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  sessions: number;
  price?: number;
}

const statusConfig = {
  em_dia: { label: "EM DIA", color: "bg-green-100 text-green-700" },
  atrasado: { label: "ATRASADO", color: "bg-red-100 text-red-700" },
  renovacao: { label: "RENOVAÇÃO", color: "bg-blue-100 text-blue-700" },
};

function planAbbrev(plan?: Plan) {
  if (!plan) return "—";
  const m = Math.round(plan.duration_days / 30);
  if (m >= 12) return "12M";
  if (m >= 6) return "6M";
  if (m >= 3) return "3M";
  return "AV";
}

export default function PacientesClient({ patients, plans }: { patients: Patient[]; plans: Plan[] }) {
  const [showWizard, setShowWizard] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = patients
    .filter((p) => showInactive || !p.isInactive)
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? "").includes(search)
    )
    .sort((a, b) => Number(a.isInactive) - Number(b.isInactive));

  const inactiveCount = patients.filter((p) => p.isInactive).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Pacientes</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {patients.length - inactiveCount} ativo{patients.length - inactiveCount !== 1 ? "s" : ""}
            {inactiveCount > 0 && ` · ${inactiveCount} inativo${inactiveCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors shadow-brand">
          <UserPlus size={15} />
          Novo paciente
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, ID ou WhatsApp..."
            className="w-full h-9 pl-9 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer shrink-0 select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand cursor-pointer" />
            Mostrar inativos
          </label>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_1.6fr_90px_90px_110px_110px_100px_140px] gap-2 px-4 py-2.5 border-b border-surface-muted bg-surface-subtle text-xs font-medium text-ink-muted uppercase tracking-wide">
          <span>ID</span><span>Nome</span><span>Plano</span><span>Consultas</span><span>Última</span><span>Próxima</span><span>Status</span><span>Ações</span>
        </div>

        <div className="divide-y divide-surface-muted">
          {filtered.map((p) => {
            const plan = plans.find((pl) => pl.name === p.plan);
            const sc = statusConfig[p.alertStatus];
            return (
              <div key={p.id} className={cn(
                "grid grid-cols-1 md:grid-cols-[80px_1.6fr_90px_90px_110px_110px_100px_140px] gap-2 px-4 py-3 items-center hover:bg-surface-subtle/50 transition-colors",
                p.isInactive && "opacity-50"
              )}>
                <span className="text-xs text-ink-muted font-mono hidden md:block">{p.id}</span>

                <div className="flex items-center gap-2.5 md:contents">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 md:hidden">
                    <span className="text-brand text-xs font-semibold">{p.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <Link href={`/pacientes/${p.id}`} className="text-sm font-medium text-ink hover:text-brand transition-colors truncate flex items-center gap-1.5">
                      {p.name}
                      {p.isInactive && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-muted text-ink-muted shrink-0">INATIVO</span>}
                    </Link>
                    <p className="text-xs text-ink-muted">{p.phone}</p>
                  </div>
                </div>

                <span className="text-xs font-medium bg-surface-subtle text-ink px-2 py-0.5 rounded-full w-fit hidden md:flex md:items-center md:justify-center">
                  {planAbbrev(plan)} · {plan?.sessions ?? "—"}x
                </span>

                <span className="text-xs text-ink hidden md:block">{p.totalAppts ?? 0}/{plan?.sessions ?? "—"}</span>

                <div className="hidden md:block">
                  {p.daysSinceLastAppt !== null && p.daysSinceLastAppt !== undefined ? (
                    <p className="text-xs text-ink">{p.daysSinceLastAppt}d atrás</p>
                  ) : <span className="text-xs text-ink-muted">—</span>}
                </div>

                <span className="text-xs text-ink hidden md:block">{p.nextDate ? formatDate(p.nextDate) : "—"}</span>

                <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full w-fit hidden md:flex md:items-center md:justify-center", sc.color)}>
                  {sc.label}
                </span>

                <div className="flex gap-1.5 mt-2 md:mt-0">
                  {p.phone && (
                    <a href={`https://wa.me/55${p.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle transition-colors flex items-center gap-1">
                      <Phone size={11} />
                    </a>
                  )}
                  <Link href={`/pacientes/${p.id}`}
                    className="h-7 px-2.5 text-xs bg-brand text-white rounded-sm hover:bg-brand-dark transition-colors flex items-center gap-1">
                    Ver <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-ink-secondary text-sm">
                {search ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado ainda."}
              </p>
              {!search && <p className="text-ink-muted text-xs mt-1">Clique em &ldquo;Novo paciente&rdquo; para começar.</p>}
            </div>
          )}
        </div>
      </div>

      {showWizard && (
        <NovoPacienteWizard
          plans={plans}
          onClose={() => setShowWizard(false)}
          onSaved={() => { setShowWizard(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
