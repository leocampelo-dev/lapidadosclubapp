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
  alertStatus: "em_dia" | "atrasado" | "renovacao";
  isInactive: boolean;
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
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [expandOptional, setExpandOptional] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const filtered = patients
    .filter((p) => showInactive || !p.isInactive)
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone ?? "").includes(search)
    )
    .sort((a, b) => Number(a.isInactive) - Number(b.isInactive));

  const inactiveCount = patients.filter((p) => p.isInactive).length;

  function handlePlanSelect(planName: string) {
    const selected = plans.find((pl) => pl.name === planName);
    if (!selected) { setForm((f) => ({ ...f, plan: planName })); return; }
    if (form.start_date) {
      const end = new Date(form.start_date);
      end.setDate(end.getDate() + selected.duration_days);
      setForm((f) => ({ ...f, plan: planName, plan_end: end.toISOString().split("T")[0], sessions: String(selected.sessions) }));
    } else {
      setForm((f) => ({ ...f, plan: planName, sessions: String(selected.sessions) }));
    }
  }

  function handleStartDateChange(date: string) {
    setForm((f) => {
      const selected = plans.find((pl) => pl.name === f.plan);
      if (!selected || !date) return { ...f, start_date: date };
      const end = new Date(date);
      end.setDate(end.getDate() + selected.duration_days);
      return { ...f, start_date: date, plan_end: end.toISOString().split("T")[0] };
    });
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const patientId = `PAC-${String(Date.now()).slice(-6)}`;
      const { error: pErr } = await supabase.from("patients").insert({
        id: patientId,
        user_id: user.id,
        name: form.name,
        phone: form.phone ?? "",
        plan: form.plan ?? "",
        start_date: form.start_date ?? new Date().toISOString().split("T")[0],
        notes: form.notes ?? "",
      });
      if (pErr) throw pErr;

      // 1º atendimento (opcional)
      if (expandOptional.atendimento && form.apt_date) {
        let calculatedNextDate = form.apt_next_date || null;
        if (!calculatedNextDate) {
          const next = new Date(form.apt_date);
          next.setDate(next.getDate() + 30);
          calculatedNextDate = next.toISOString().split("T")[0];
        }
        const { error: aErr } = await supabase.from("appointments").insert({
          id: `APT-${Date.now()}`,
          user_id: user.id,
          patient_id: patientId,
          date: form.apt_date,
          weight: form.apt_weight ? Number(form.apt_weight) : null,
          evaluation: form.apt_evaluation ?? "",
          conduct: form.apt_conduct ?? "",
          next_date: calculatedNextDate,
          notes: form.apt_notes ?? "",
        });
        if (aErr) throw aErr;
      }

      // Financeiro (opcional)
      if (expandOptional.financeiro && form.fin_amount) {
        const { error: fErr } = await supabase.from("financial").insert({
          user_id: user.id,
          patient_id: patientId,
          description: `Plano ${form.plan ?? ""}`,
          amount: Number(form.fin_amount),
          type: "receita",
          status: Number(form.fin_paid ?? 0) >= Number(form.fin_amount) ? "pago" : "pendente",
          notes: `Pago: R$${form.fin_paid ?? 0} | ${form.fin_method ?? "PIX"}`,
        });
        if (fErr) throw fErr;
      }

      setModal(false);
      setForm({});
      setExpandOptional({});
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
          <p className="text-ink-secondary text-sm mt-0.5">
            {patients.length - inactiveCount} ativo{patients.length - inactiveCount !== 1 ? "s" : ""}
            {inactiveCount > 0 && ` · ${inactiveCount} inativo${inactiveCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button onClick={() => { setForm({}); setExpandOptional({}); setModal(true); }}
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

      {/* Modal novo paciente — completo com atendimento e financeiro */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <h3 className="text-sm font-semibold text-ink">Novo paciente</h3>
              <button onClick={() => setModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              <Field label="Nome completo *" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ex: Ana Carolina Souza" />
              <Field label="WhatsApp" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(82) 99999-9999" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Plano *</label>
                  <select value={form.plan ?? ""} onChange={(e) => handlePlanSelect(e.target.value)}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">Selecionar plano...</option>
                    {plans.map((pl) => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Consultas no plano</label>
                  <input value={form.sessions ?? "—"} readOnly className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink text-sm cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de início *" value={form.start_date ?? ""} onChange={handleStartDateChange} type="date" />
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Término (automático)</label>
                  <input value={form.plan_end ? new Date(form.plan_end + "T12:00:00").toLocaleDateString("pt-BR") : "Preencha acima"} readOnly
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink-muted text-sm cursor-not-allowed" />
                </div>
              </div>

              <Field label="Observações" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Objetivos, alergias..." textarea />

              {/* Seção: 1º Atendimento */}
              <div className="border border-surface-muted rounded-md overflow-hidden">
                <button type="button" onClick={() => setExpandOptional((e) => ({ ...e, atendimento: !e.atendimento }))}
                  className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                    expandOptional.atendimento ? "bg-brand text-white" : "bg-surface-subtle text-ink hover:bg-surface-muted")}>
                  <span>✓ 1º Atendimento</span>
                  <span className="text-xs opacity-70">{expandOptional.atendimento ? "▲" : "▼"}</span>
                </button>
                {expandOptional.atendimento && (
                  <div className="p-4 flex flex-col gap-3 max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Data" value={form.apt_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_date: v }))} type="date" />
                      <Field label="Peso (kg)" value={form.apt_weight ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_weight: v }))} placeholder="75.5" type="number" />
                    </div>
                    <Field label="Avaliação clínica" value={form.apt_evaluation ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_evaluation: v }))} placeholder="Observações clínicas..." textarea />
                    <Field label="Conduta / Plano alimentar" value={form.apt_conduct ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_conduct: v }))} placeholder="Prescrição, orientações..." textarea />
                    <Field label="Próxima consulta" value={form.apt_next_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_next_date: v }))} type="date" />
                    <Field label="Notas extras" value={form.apt_notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_notes: v }))} placeholder="Observação rápida..." />
                    <p className="text-[11px] text-ink-muted -mt-1">Se deixar a próxima consulta em branco, calculamos automaticamente +30 dias.</p>
                  </div>
                )}
              </div>

              {/* Seção: Financeiro */}
              <div className="border border-surface-muted rounded-md overflow-hidden">
                <button type="button" onClick={() => setExpandOptional((e) => ({ ...e, financeiro: !e.financeiro }))}
                  className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                    expandOptional.financeiro ? "bg-brand text-white" : "bg-surface-subtle text-ink hover:bg-surface-muted")}>
                  <span>💰 Financeiro</span>
                  <span className="text-xs opacity-70">{expandOptional.financeiro ? "▲" : "▼"}</span>
                </button>
                {expandOptional.financeiro && (
                  <div className="p-4 flex flex-col gap-3 max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Valor total (R$)" value={form.fin_amount ?? ""} onChange={(v) => setForm((f) => ({ ...f, fin_amount: v }))} placeholder="0.00" type="number" />
                      <Field label="Valor pago (R$)" value={form.fin_paid ?? ""} onChange={(v) => setForm((f) => ({ ...f, fin_paid: v }))} placeholder="0.00" type="number" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">Forma de pagamento</label>
                      <select value={form.fin_method ?? "PIX"} onChange={(e) => setForm((f) => ({ ...f, fin_method: e.target.value }))}
                        className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                        <option>PIX</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
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
