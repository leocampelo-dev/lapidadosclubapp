"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, cn } from "@/lib/utils";
import { Search, UserPlus, ChevronRight, X, Phone } from "lucide-react";
import Link from "next/link";

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
  status: "em_dia" | "atrasado" | "renovacao";
}

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  sessions: number;
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
  const supabase = createClient();
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? "").includes(search)
  );

  function handlePlanSelect(planName: string) {
    const selected = plans.find((pl) => pl.name === planName);
    if (!selected) { setForm((f) => ({ ...f, plan: planName })); return; }
    setForm((f) => ({ ...f, plan: planName, sessions: String(selected.sessions) }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const patientId = `PAC-${String(Date.now()).slice(-6)}`;
      const { error } = await supabase.from("patients").insert({
        id: patientId,
        user_id: user.id,
        name: form.name,
        phone: form.phone ?? "",
        plan: form.plan ?? "",
        start_date: form.start_date ?? new Date().toISOString().split("T")[0],
        notes: form.notes ?? "",
      });
      if (error) throw error;
      setModal(false);
      setForm({});
      window.location.reload();
    } catch (e) {
      console.error("Erro ao salvar paciente:", e);
      alert("Erro ao salvar paciente. Veja o console para detalhes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-ink">Pacientes</h1>
          <p className="text-ink-secondary text-sm mt-0.5">{patients.length} cadastrado{patients.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setForm({}); setModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors shadow-brand">
          <UserPlus size={15} />
          Novo paciente
        </button>
      </div>

      <div className="relative mb-4">
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

      {/* Tabela */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[80px_1.6fr_90px_90px_110px_110px_100px_140px] gap-2 px-4 py-2.5 border-b border-surface-muted bg-surface-subtle text-xs font-medium text-ink-muted uppercase tracking-wide">
          <span>ID</span><span>Nome</span><span>Plano</span><span>Consultas</span><span>Última</span><span>Próxima</span><span>Status</span><span>Ações</span>
        </div>

        <div className="divide-y divide-surface-muted">
          {filtered.map((p) => {
            const plan = plans.find((pl) => pl.name === p.plan);
            const sc = statusConfig[p.status];
            return (
              <div key={p.id} className="grid grid-cols-1 md:grid-cols-[80px_1.6fr_90px_90px_110px_110px_100px_140px] gap-2 px-4 py-3 items-center hover:bg-surface-subtle/50 transition-colors">
                <span className="text-xs text-ink-muted font-mono hidden md:block">{p.id}</span>

                <div className="flex items-center gap-2.5 md:contents">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0 md:hidden">
                    <span className="text-brand text-xs font-semibold">{p.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <Link href={`/pacientes/${p.id}`} className="text-sm font-medium text-ink hover:text-brand transition-colors truncate block">
                      {p.name}
                    </Link>
                    <p className="text-xs text-ink-muted">{p.phone}</p>
                  </div>
                </div>

                <span className="text-xs font-medium bg-surface-subtle text-ink px-2 py-0.5 rounded-full w-fit hidden md:flex md:items-center md:justify-center">
                  {planAbbrev(plan)} · {plan?.sessions ?? "—"}x
                </span>

                <span className="text-xs text-ink hidden md:block">
                  {p.totalAppts ?? 0}/{plan?.sessions ?? "—"}
                </span>

                <div className="hidden md:block">
                  {p.daysSinceLastAppt !== null && p.daysSinceLastAppt !== undefined ? (
                    <>
                      <p className="text-xs text-ink">{p.daysSinceLastAppt}d atrás</p>
                    </>
                  ) : <span className="text-xs text-ink-muted">—</span>}
                </div>

                <span className="text-xs text-ink hidden md:block">
                  {p.nextDate ? formatDate(p.nextDate) : "—"}
                </span>

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

      {/* Modal novo paciente */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <h3 className="text-sm font-semibold text-ink">Novo paciente</h3>
              <button onClick={() => setModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              <Field label="Nome completo *" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ex: Ana Carolina Souza" />
              <Field label="WhatsApp" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(82) 99999-9999" />
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Plano *</label>
                <select value={form.plan ?? ""} onChange={(e) => handlePlanSelect(e.target.value)}
                  className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">Selecionar plano...</option>
                  {plans.map((pl) => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                </select>
              </div>
              <Field label="Data de início *" value={form.start_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, start_date: v }))} type="date" />
              <Field label="Observações" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Objetivos, alergias..." textarea />
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted shrink-0">
              <button onClick={() => setModal(false)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={loading || !form.name || !form.plan}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar paciente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean;
}) {
  const base = "w-full px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${base} py-2 resize-none`} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${base} h-9`} />}
    </div>
  );
}
