"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertTriangle, Clock, RefreshCw, Users, ClipboardCheck,
  DollarSign, Plus, X, Eye, EyeOff, CheckSquare, Square,
  Trash2, ChevronRight, Phone,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import NovoPacienteWizard from "@/components/nutri/NovoPacienteWizard";

interface Patient {
  id: string; name: string; phone?: string; plan?: string; start_date: string;
  alert?: string | null; nextDate?: string | null; daysSinceLastAppt?: number | null;
  daysUntilPlanEnd?: number; sessions?: number; totalAppts?: number;
  lastAppt?: { date: string; next_date?: string } | null;
  patientPlan?: { name: string; duration_days: number; sessions: number } | null;
}
interface Plan { id: string; name: string; duration_days: number; sessions: number; price?: number; }
interface Task {
  id: string;
  text: string;       // coluna real no banco
  done: boolean;      // coluna real no banco
  done_at?: string | null;
  created_at: string;
}
interface Props {
  userName: string; patients: Patient[]; plans: Plan[]; patientsWithAlerts: Patient[];
  atrasados: Patient[]; proximos: Patient[]; renovacoes: Patient[];
  checkinsThisWeek: number; totalPatients: number; pendentesCheckin: number;
  avgScore: number | null; receitaTotal: number; pendente: number; tasks: Task[];
}
type ModalType = "atendimento" | "financeiro" | null;

export default function DashboardClient({
  userName, patients, plans, patientsWithAlerts,
  atrasados, proximos, renovacoes, checkinsThisWeek, totalPatients,
  pendentesCheckin, avgScore, receitaTotal, pendente, tasks: initialTasks,
}: Props) {
  const supabase = createClient();
  const [modal, setModal] = useState<ModalType>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [alertModal, setAlertModal] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [hideFinanceiro, setHideFinanceiro] = useState(false);
  const [hideNotas, setHideNotas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const hora = new Date().getHours();
  const greeting = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  // Tasks: separa pendentes e feitas (feitas somem após 7 dias)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const pendingTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done && (!t.done_at || new Date(t.done_at) > sevenDaysAgo));

  async function addTask() {
    if (!newTask.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newId = `TASK-${Date.now()}`;
    const { data, error } = await supabase.from("tasks").insert({
      id: newId,
      user_id: user.id,
      text: newTask.trim(),
      done: false,
    }).select().single();
    if (data && !error) setTasks((prev) => [data, ...prev]);
    else console.error("Erro ao criar task:", error);
    setNewTask("");
  }

  async function toggleTask(task: Task) {
    const done_at = !task.done ? new Date().toISOString() : null;
    const { error } = await supabase.from("tasks").update({ done: !task.done, done_at }).eq("id", task.id);
    if (!error) setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, done: !t.done, done_at } : t));
    else console.error("Erro ao toggle task:", error);
  }

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleModalSubmit() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (modal === "atendimento") {
        const apptDate = form.date ?? new Date().toISOString().split("T")[0];
        let calculatedNextDate = form.next_date || null;
        if (!calculatedNextDate) {
          const next = new Date(apptDate);
          next.setDate(next.getDate() + 30);
          calculatedNextDate = next.toISOString().split("T")[0];
        }
        const { error } = await supabase.from("appointments").insert({
          id: `APT-${Date.now()}`, user_id: user.id,
          patient_id: form.patient_id, date: apptDate,
          next_date: calculatedNextDate, weight: form.weight ? Number(form.weight) : null,
          evaluation: form.evaluation ?? "", conduct: form.conduct ?? "", notes: form.notes ?? "",
        });
        if (error) throw error;
      } else if (modal === "financeiro") {
        const totalNum = Number(form.total_value || 0);
        const paidNum = Number(form.paid_value || 0);
        const { error } = await supabase.from("financial").insert({
          id: `FIN-${Date.now()}`, user_id: user.id, patient_id: form.patient_id,
          date: form.date ?? new Date().toISOString().split("T")[0],
          total_value: totalNum, paid_value: paidNum,
          pay_method: form.pay_method ?? "PIX",
          status: paidNum >= totalNum ? "PAGO" : "PENDENTE",
          notes: form.notes ?? "",
        });
        if (error) throw error;
      }
      setModal(null); setForm({});
      window.location.reload();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar. Veja o console para detalhes.");
    } finally { setLoading(false); }
  }

  const alertGroups = {
    atrasado: { label: "Atrasados", sub: "sem consulta no prazo", count: atrasados.length, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: AlertTriangle, patients: atrasados },
    proximo:  { label: "Próximos 7 dias", sub: "consultas previstas", count: proximos.length, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: Clock, patients: proximos },
    renovacao:{ label: "Renovações", sub: "planos próximos do fim", count: renovacoes.length, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: RefreshCw, patients: renovacoes },
    total:    { label: "Total de pacientes", sub: "ativos no sistema", count: totalPatients, color: "text-ink-secondary", bg: "bg-surface-subtle", border: "border-surface-muted", icon: Users, patients: patientsWithAlerts },
  };
  const activeAlertGroup = alertModal ? alertGroups[alertModal as keyof typeof alertGroups] : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{greeting}, {userName}! 👋</h1>
          <p className="text-ink-secondary text-sm mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 h-9 px-3 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm transition-colors shadow-brand">
            <Plus size={14} /> Novo paciente
          </button>
          <button onClick={() => { setModal("atendimento"); setForm({}); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-surface-subtle text-ink text-sm font-medium rounded-sm border border-surface-muted transition-colors">
            <Plus size={14} /> Atendimento
          </button>
          <button onClick={() => { setModal("financeiro"); setForm({}); }}
            className="flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-surface-subtle text-ink text-sm font-medium rounded-sm border border-surface-muted transition-colors">
            <Plus size={14} /> Lançamento
          </button>
        </div>
      </div>

      {/* Cards de alerta */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.entries(alertGroups).map(([key, card]) => {
          const hasAlert = card.count > 0 && key !== "total";
          return (
            <button key={key} onClick={() => setAlertModal(key)}
              className={cn("bg-white border rounded-md p-4 shadow-card text-left hover:shadow-card-hover transition-shadow animate-fade-up w-full",
                hasAlert ? card.border : "border-surface-muted")}>
              <div className={cn("inline-flex p-2 rounded-sm mb-3", hasAlert ? card.bg : "bg-surface-subtle")}>
                <card.icon size={16} className={hasAlert ? card.color : "text-ink-muted"} />
              </div>
              <p className={cn("text-3xl font-bold", hasAlert ? card.color : "text-ink")}>{card.count}</p>
              <p className="text-sm font-medium text-ink mt-0.5">{card.label}</p>
              <p className="text-xs text-ink-muted">{card.sub}</p>
              {card.count > 0 && <p className="text-xs text-brand mt-2 font-medium">Ver lista →</p>}
            </button>
          );
        })}
      </div>

      {/* Check-ins + Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2"><ClipboardCheck size={16} className="text-brand" /> Check-in semanal</h2>
            <Link href="/checkins" className="text-xs text-brand hover:underline">Ver tudo →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Pendentes", value: pendentesCheckin, color: "text-red-500" },
              { label: "Responderam", value: checkinsThisWeek, color: "text-green-600" },
              { label: "Score médio", value: avgScore ?? "—", color: avgScore !== null ? (avgScore >= 7 ? "text-brand" : "text-amber-500") : "text-ink-muted" },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 bg-surface-subtle rounded-md">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-ink-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {totalPatients > 0 && (
            <div>
              <div className="flex justify-between text-xs text-ink-muted mb-1">
                <span>Taxa de resposta</span>
                <span>{Math.round((checkinsThisWeek / totalPatients) * 100)}%</span>
              </div>
              <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((checkinsThisWeek / totalPatients) * 100, 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2"><DollarSign size={16} className="text-green-600" /> Financeiro</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setHideFinanceiro(!hideFinanceiro)} className="text-ink-muted hover:text-ink transition-colors">
                {hideFinanceiro ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <Link href="/financeiro" className="text-xs text-brand hover:underline">Ver tudo →</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 rounded-md border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Recebido</p>
              <p className="text-xl font-bold text-green-700">{hideFinanceiro ? "••••••" : formatCurrency(receitaTotal)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-1">A receber</p>
              <p className="text-xl font-bold text-amber-700">{hideFinanceiro ? "••••••" : formatCurrency(pendente)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2"><CheckSquare size={16} className="text-brand" /> Notas</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setHideNotas(!hideNotas)} className="text-ink-muted hover:text-ink transition-colors">
              {hideNotas ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => setShowDoneTasks(!showDoneTasks)} className="text-xs text-ink-muted hover:text-ink transition-colors">
              {showDoneTasks ? "Ocultar feitas" : "Ver feitas"} ({doneTasks.length})
            </button>
          </div>
        </div>
        {!hideNotas ? (
          <>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="Nova nota... (Enter para adicionar)"
                className="flex-1 h-9 px-3 rounded-sm border border-surface-muted bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" />
              <button onClick={addTask} className="h-9 w-9 flex items-center justify-center bg-brand hover:bg-brand-dark text-white rounded-sm shadow-brand">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {pendingTasks.length === 0 && <p className="text-sm text-ink-muted text-center py-3">Nenhuma nota pendente.</p>}
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 group px-1 py-1 rounded-sm hover:bg-surface-subtle transition-colors">
                  <button onClick={() => toggleTask(task)} className="shrink-0 text-ink-muted hover:text-brand transition-colors"><Square size={16} /></button>
                  <span className="flex-1 text-sm text-ink">{task.text}</span>
                  <button onClick={() => deleteTask(task.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                </div>
              ))}
              {showDoneTasks && doneTasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-muted flex flex-col gap-1.5">
                  <p className="text-xs text-ink-muted font-medium mb-1">Feitas · somem após 7 dias</p>
                  {doneTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 group px-1 py-1 rounded-sm opacity-50 hover:opacity-80">
                      <button onClick={() => toggleTask(task)} className="shrink-0 text-brand"><CheckSquare size={16} /></button>
                      <span className="flex-1 text-sm text-ink line-through">{task.text}</span>
                      <button onClick={() => deleteTask(task.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : <p className="text-sm text-ink-muted text-center py-4">Notas ocultas</p>}
      </div>

      {/* Modal lista de alertas */}
      {alertModal && activeAlertGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted">
              <div className="flex items-center gap-2">
                <activeAlertGroup.icon size={16} className={activeAlertGroup.color} />
                <h3 className="text-sm font-semibold text-ink">{activeAlertGroup.label}</h3>
              </div>
              <button onClick={() => setAlertModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <p className="text-xs text-ink-muted px-5 pt-3">{activeAlertGroup.count} paciente{activeAlertGroup.count !== 1 ? "s" : ""} · {activeAlertGroup.sub}</p>
            <div className="p-3 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {activeAlertGroup.patients.length === 0 && <p className="text-sm text-ink-muted text-center py-4">Nenhum paciente nesta categoria.</p>}
              {activeAlertGroup.patients.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-subtle rounded-md">
                  <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <span className="text-brand text-sm font-semibold">{p.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                    <p className="text-xs text-ink-muted">
                      {alertModal === "atrasado" && `${p.daysSinceLastAppt ?? "?"}d sem consulta · Plano ${p.plan ?? "—"}`}
                      {alertModal === "proximo" && p.nextDate && `Última: ${p.lastAppt ? formatDate(p.lastAppt.date) : "—"} · Próxima: ${formatDate(p.nextDate)}`}
                      {alertModal === "renovacao" && `Termina em ${p.daysUntilPlanEnd}d · ${p.plan ?? "—"}`}
                      {alertModal === "total" && `Plano ${p.plan ?? "—"} · início ${formatDate(p.start_date)}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {p.phone && (
                      <a href={`https://wa.me/55${p.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle flex items-center gap-1">
                        <Phone size={11} /> WA
                      </a>
                    )}
                    <Link href={`/pacientes/${p.id}`} onClick={() => setAlertModal(null)}
                      className="h-7 px-2 text-xs bg-brand text-white rounded-sm hover:bg-brand-dark flex items-center">
                      Ver
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 pt-2 border-t border-surface-muted">
              <Link href="/pacientes" onClick={() => setAlertModal(null)} className="text-xs text-brand hover:underline flex items-center gap-1">
                Ver todos os pacientes <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modal paciente/atendimento/financeiro */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <h3 className="text-sm font-semibold text-ink">
                {modal === "atendimento" ? "Novo atendimento" : "Novo lançamento"}
              </h3>
              <button onClick={() => setModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">

              {modal === "atendimento" && <>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Paciente *</label>
                  <select value={form.patient_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">Selecione o paciente</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data da consulta *" value={form.date ?? ""} onChange={(v) => setForm((f) => ({ ...f, date: v }))} type="date" />
                  <Field label="Peso (kg)" value={form.weight ?? ""} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} placeholder="75.5" type="number" />
                </div>
                <Field label="Avaliação clínica" value={form.evaluation ?? ""} onChange={(v) => setForm((f) => ({ ...f, evaluation: v }))} placeholder="Queixas, composição corporal..." textarea />
                <Field label="Conduta / Plano alimentar" value={form.conduct ?? ""} onChange={(v) => setForm((f) => ({ ...f, conduct: v }))} placeholder="Prescrição, orientações..." textarea />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Próxima consulta" value={form.next_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, next_date: v }))} type="date" />
                  <Field label="Notas extras" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Observação rápida..." />
                </div>
                <p className="text-[11px] text-ink-muted -mt-2">Se deixar a próxima consulta em branco, calculamos automaticamente +30 dias.</p>
              </>}

              {modal === "financeiro" && <>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Paciente *</label>
                  <select value={form.patient_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">Selecione o paciente</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <Field label="Data *" value={form.date ?? ""} onChange={(v) => setForm((f) => ({ ...f, date: v }))} type="date" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor total (R$) *" value={form.total_value ?? ""} onChange={(v) => setForm((f) => ({ ...f, total_value: v }))} type="number" placeholder="350.00" />
                  <Field label="Valor pago (R$)" value={form.paid_value ?? ""} onChange={(v) => setForm((f) => ({ ...f, paid_value: v }))} type="number" placeholder="350.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Forma de pagamento</label>
                  <select value={form.pay_method ?? "PIX"} onChange={(e) => setForm((f) => ({ ...f, pay_method: e.target.value }))}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option>PIX</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option>
                  </select>
                </div>
                <Field label="Observações" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Mensalidade, consulta avulsa..." />
                <p className="text-[11px] text-ink-muted -mt-1">O status (PAGO/PENDENTE) é calculado automaticamente comparando valor pago com valor total.</p>
              </>}
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted shrink-0">
              <button onClick={() => setModal(null)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">Cancelar</button>
              <button onClick={handleModalSubmit} disabled={loading}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
