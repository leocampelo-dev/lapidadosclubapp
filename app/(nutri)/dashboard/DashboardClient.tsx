"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AlertTriangle, Clock, RefreshCw, Users, ClipboardCheck,
  DollarSign, Plus, X, ChevronRight, Eye, EyeOff,
  CheckSquare, Square, Trash2, Calendar, Phone,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  name: string;
  phone?: string;
  plan?: string;
  start_date: string;
  alert?: string | null;
  nextDate?: string | null;
  daysSinceLastAppt?: number | null;
  daysUntilPlanEnd?: number;
  planEnd?: string;
  sessions?: number;
  totalAppts?: number;
  lastAppt?: { date: string; next_date?: string } | null;
  patientPlan?: { name: string; duration_days: number; sessions: number } | null;
}

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  sessions: number;
  price?: number;
}

interface Task {
  id: string;
  text?: string;
  content?: string;
  completed: boolean;
  created_at: string;
  completed_at?: string | null;
}

interface Props {
  userName: string;
  patients: Patient[];
  plans: Plan[];
  patientsWithAlerts: Patient[];
  atrasados: Patient[];
  proximos: Patient[];
  renovacoes: Patient[];
  checkinsThisWeek: number;
  totalPatients: number;
  pendentesCheckin: number;
  avgScore: number | null;
  receitaTotal: number;
  pendente: number;
  tasks: Task[];
}

type ModalType = "paciente" | "atendimento" | "financeiro" | null;

export default function DashboardClient({
  userName, patients, plans, patientsWithAlerts,
  atrasados, proximos, renovacoes,
  checkinsThisWeek, totalPatients, pendentesCheckin,
  avgScore, receitaTotal, pendente, tasks: initialTasks,
}: Props) {
  const supabase = createClient();
  const [modal, setModal] = useState<ModalType>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTask, setNewTask] = useState("");
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [expandOptional, setExpandOptional] = useState<Record<string, boolean>>({});

  const hora = new Date().getHours();
  const greeting = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date());

  // Tarefas: feitas somem após 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const pendingTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.filter((t) => {
    if (!t.completed) return false;
    if (!t.completed_at) return true;
    return new Date(t.completed_at) > sevenDaysAgo;
  });

  // Quando seleciona plano no modal de paciente, calcula término e sessões
  function handlePlanSelect(planId: string) {
    const selected = plans.find((pl) => pl.id === planId || pl.name === planId);
    if (!selected || !form.start_date) {
      setForm((f) => ({ ...f, plan: planId }));
      return;
    }
    const end = new Date(form.start_date);
    end.setDate(end.getDate() + selected.duration_days);
    setForm((f) => ({
      ...f,
      plan: selected.name,
      plan_end: end.toISOString().split("T")[0],
      sessions: String(selected.sessions),
    }));
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

  async function addTask() {
    if (!newTask.trim()) return;
    const { data } = await supabase.from("tasks").insert({
      content: newTask.trim(),
      text: newTask.trim(),
      completed: false,
    }).select().single();
    if (data) setTasks((prev) => [data, ...prev]);
    setNewTask("");
  }

  async function toggleTask(task: Task) {
    const completed_at = !task.completed ? new Date().toISOString() : null;
    await supabase.from("tasks").update({ completed: !task.completed, completed_at }).eq("id", task.id);
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: !t.completed, completed_at } : t));
  }

  async function deleteTask(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleModalSubmit() {
    setLoading(true);
    try {
      if (modal === "paciente") {
        const patientId = `PAC-${String(Date.now()).slice(-6)}`;
        await supabase.from("patients").insert({
          id: patientId,
          name: form.name,
          phone: form.phone ?? "",
          plan: form.plan ?? "",
          start_date: form.start_date ?? new Date().toISOString().split("T")[0],
          notes: form.notes ?? "",
        });
        // 1º atendimento opcional
        if (expandOptional.atendimento && form.apt_date) {
          await supabase.from("appointments").insert({
            id: `APT-${Date.now()}`,
            patient_id: patientId,
            date: form.apt_date,
            weight: form.apt_weight ? Number(form.apt_weight) : null,
            evaluation: form.apt_evaluation ?? "",
            conduct: form.apt_conduct ?? "",
            next_date: form.apt_next_date ?? null,
          });
        }
        // Financeiro opcional
        if (expandOptional.financeiro && form.fin_amount) {
          await supabase.from("financial").insert({
            patient_id: patientId,
            description: `Plano ${form.plan ?? ""}`,
            amount: Number(form.fin_amount),
            type: "receita",
            status: Number(form.fin_paid) >= Number(form.fin_amount) ? "pago" : "pendente",
            notes: `Pago: R$${form.fin_paid ?? 0} | Forma: ${form.fin_method ?? "PIX"}`,
          });
        }
      } else if (modal === "atendimento") {
        await supabase.from("appointments").insert({
          id: `APT-${Date.now()}`,
          patient_id: form.patient_id,
          date: form.date ?? new Date().toISOString().split("T")[0],
          next_date: form.next_date ?? null,
          weight: form.weight ? Number(form.weight) : null,
          evaluation: form.evaluation ?? "",
          conduct: form.conduct ?? "",
          notes: form.notes ?? "",
        });
      } else if (modal === "financeiro") {
        await supabase.from("financial").insert({
          patient_id: form.patient_id,
          description: form.description,
          amount: Number(form.amount),
          type: form.type ?? "receita",
          status: form.status ?? "pendente",
          due_date: form.due_date ?? null,
        });
      }
      setModal(null);
      setForm({});
      setExpandOptional({});
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const alertCards = [
    {
      key: "atrasado",
      label: "Atrasados",
      sub: "sem consulta no prazo",
      count: atrasados.length,
      activeColor: "text-red-600",
      activeBg: "bg-red-50",
      activeBorder: "border-red-200",
      icon: AlertTriangle,
      patients: atrasados,
      detail: (p: Patient) => p.daysSinceLastAppt ? `${p.daysSinceLastAppt}d desde última` : "Sem consulta",
    },
    {
      key: "proximo",
      label: "Próximos 7 dias",
      sub: "consultas previstas",
      count: proximos.length,
      activeColor: "text-amber-600",
      activeBg: "bg-amber-50",
      activeBorder: "border-amber-200",
      icon: Clock,
      patients: proximos,
      detail: (p: Patient) => p.nextDate ? `Próxima: ${formatDate(p.nextDate)}` : "",
    },
    {
      key: "renovacao",
      label: "Renovações",
      sub: "planos próximos do fim",
      count: renovacoes.length,
      activeColor: "text-blue-600",
      activeBg: "bg-blue-50",
      activeBorder: "border-blue-200",
      icon: RefreshCw,
      patients: renovacoes,
      detail: (p: Patient) => p.daysUntilPlanEnd !== undefined ? `Termina em ${p.daysUntilPlanEnd}d` : "",
    },
    {
      key: "total",
      label: "Total de pacientes",
      sub: "ativos no sistema",
      count: totalPatients,
      activeColor: "text-ink-secondary",
      activeBg: "bg-surface-subtle",
      activeBorder: "border-surface-muted",
      icon: Users,
      patients: [],
      detail: () => "",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{greeting}, {userName}! 👋</h1>
          <p className="text-ink-secondary text-sm mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setModal("paciente"); setForm({}); setExpandOptional({}); }}
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
        {alertCards.map((card) => {
          const hasAlert = card.count > 0 && card.key !== "total";
          return (
            <div key={card.key} className={cn(
              "bg-white border rounded-md p-4 shadow-card animate-fade-up",
              hasAlert ? card.activeBorder : "border-surface-muted"
            )}>
              <div className={cn("inline-flex p-2 rounded-sm mb-3", hasAlert ? card.activeBg : "bg-surface-subtle")}>
                <card.icon size={16} className={hasAlert ? card.activeColor : "text-ink-muted"} />
              </div>
              <p className={cn("text-3xl font-bold", hasAlert ? card.activeColor : "text-ink")}>{card.count}</p>
              <p className="text-sm font-medium text-ink mt-0.5">{card.label}</p>
              <p className="text-xs text-ink-muted">{card.sub}</p>

              {card.patients.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-muted flex flex-col gap-2">
                  {card.patients.slice(0, 3).map((p) => (
                    <Link key={p.id} href={`/pacientes/${p.id}`}
                      className="flex flex-col hover:text-brand transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink group-hover:text-brand truncate">{p.name}</span>
                        <ChevronRight size={11} className="text-ink-muted shrink-0" />
                      </div>
                      {card.detail(p) && (
                        <span className={cn("text-[10px]", card.activeColor)}>{card.detail(p)}</span>
                      )}
                    </Link>
                  ))}
                  {card.patients.length > 3 && (
                    <Link href="/pacientes" className="text-xs text-brand hover:underline">+{card.patients.length - 3} mais →</Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid check-ins + financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ClipboardCheck size={16} className="text-brand" /> Check-in semanal
            </h2>
            <Link href="/checkins" className="text-xs text-brand hover:underline">Ver tudo →</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-surface-subtle rounded-md">
              <p className="text-2xl font-bold text-red-500">{pendentesCheckin}</p>
              <p className="text-xs text-ink-muted mt-0.5">Pendentes</p>
            </div>
            <div className="text-center p-3 bg-surface-subtle rounded-md">
              <p className="text-2xl font-bold text-green-600">{checkinsThisWeek}</p>
              <p className="text-xs text-ink-muted mt-0.5">Responderam</p>
            </div>
            <div className="text-center p-3 bg-surface-subtle rounded-md">
              <p className={cn("text-2xl font-bold", avgScore !== null ? (avgScore >= 7 ? "text-brand" : "text-amber-500") : "text-ink-muted")}>
                {avgScore !== null ? avgScore : "—"}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">Score médio</p>
            </div>
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
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <DollarSign size={16} className="text-green-600" /> Financeiro
            </h2>
            <Link href="/financeiro" className="text-xs text-brand hover:underline">Ver tudo →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 rounded-md border border-green-100">
              <p className="text-xs text-green-700 font-medium mb-1">Recebido</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(receitaTotal)}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
              <p className="text-xs text-amber-700 font-medium mb-1">A receber</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrency(pendente)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <CheckSquare size={16} className="text-brand" /> Notas
          </h2>
          <button onClick={() => setShowDoneTasks(!showDoneTasks)}
            className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
            {showDoneTasks ? <EyeOff size={13} /> : <Eye size={13} />}
            {showDoneTasks ? "Ocultar feitas" : "Ver feitas"} ({doneTasks.length})
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Nova nota... (Enter para adicionar)"
            className="flex-1 h-9 px-3 rounded-sm border border-surface-muted bg-surface text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
          <button onClick={addTask}
            className="h-9 w-9 flex items-center justify-center bg-brand hover:bg-brand-dark text-white rounded-sm transition-colors shadow-brand">
            <Plus size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {pendingTasks.length === 0 && <p className="text-sm text-ink-muted text-center py-3">Nenhuma nota pendente.</p>}
          {pendingTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2.5 group px-1 py-1 rounded-sm hover:bg-surface-subtle transition-colors">
              <button onClick={() => toggleTask(task)} className="shrink-0 text-ink-muted hover:text-brand transition-colors"><Square size={16} /></button>
              <span className="flex-1 text-sm text-ink">{task.content ?? task.text}</span>
              <button onClick={() => deleteTask(task.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-all"><Trash2 size={14} /></button>
            </div>
          ))}
          {showDoneTasks && doneTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-muted flex flex-col gap-1.5">
              <p className="text-xs text-ink-muted font-medium mb-1">Feitas · somem após 7 dias</p>
              {doneTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 group px-1 py-1 rounded-sm opacity-50 hover:opacity-80 transition-opacity">
                  <button onClick={() => toggleTask(task)} className="shrink-0 text-brand"><CheckSquare size={16} /></button>
                  <span className="flex-1 text-sm text-ink line-through">{task.content ?? task.text}</span>
                  <button onClick={() => deleteTask(task.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAIS */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setModal(null)}>
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg my-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted sticky top-0 bg-white rounded-t-md z-10">
              <h3 className="text-sm font-semibold text-ink">
                {modal === "paciente" ? "Novo paciente" : modal === "atendimento" ? "Novo atendimento" : "Novo lançamento"}
              </h3>
              <button onClick={() => setModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">

              {/* ── NOVO PACIENTE ── */}
              {modal === "paciente" && <>
                <Field label="Nome completo *" value={form.name ?? ""} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ex: Ana Carolina Souza" />
                <Field label="WhatsApp" value={form.phone ?? ""} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} placeholder="(82) 99999-9999" />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">Plano *</label>
                    <select value={form.plan ?? ""} onChange={(e) => handlePlanSelect(e.target.value)}
                      className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                      <option value="">Selecionar plano...</option>
                      {plans.map((pl) => (
                        <option key={pl.id} value={pl.name}>{pl.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">Consultas no plano</label>
                    <input value={form.sessions ?? "—"} readOnly
                      className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink text-sm cursor-not-allowed" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Data de início *" value={form.start_date ?? ""} onChange={handleStartDateChange} type="date" />
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">Término (automático)</label>
                    <input value={form.plan_end ? new Date(form.plan_end).toLocaleDateString("pt-BR") : "Preencha acima"} readOnly
                      className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink-muted text-sm cursor-not-allowed" />
                  </div>
                </div>

                <Field label="Observações" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Objetivos, alergias..." textarea />

                {/* Seção opcional: 1º Atendimento */}
                <div className="border border-surface-muted rounded-md overflow-hidden">
                  <button type="button"
                    onClick={() => setExpandOptional((e) => ({ ...e, atendimento: !e.atendimento }))}
                    className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                      expandOptional.atendimento ? "bg-brand text-white" : "bg-surface-subtle text-ink hover:bg-surface-muted")}>
                    <span>✓ 1º Atendimento</span>
                    <span className="text-xs opacity-70">{expandOptional.atendimento ? "▲" : "▼"}</span>
                  </button>
                  {expandOptional.atendimento && (
                    <div className="p-4 flex flex-col gap-3 border-t border-surface-muted">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Data" value={form.apt_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_date: v }))} type="date" />
                        <Field label="Peso (kg)" value={form.apt_weight ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_weight: v }))} placeholder="75.5" type="number" />
                      </div>
                      <Field label="Avaliação" value={form.apt_evaluation ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_evaluation: v }))} placeholder="Observações clínicas..." textarea />
                      <Field label="Conduta" value={form.apt_conduct ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_conduct: v }))} placeholder="Plano alimentar..." textarea />
                      <Field label="Próxima consulta" value={form.apt_next_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, apt_next_date: v }))} type="date" />
                    </div>
                  )}
                </div>

                {/* Seção opcional: Financeiro */}
                <div className="border border-surface-muted rounded-md overflow-hidden">
                  <button type="button"
                    onClick={() => setExpandOptional((e) => ({ ...e, financeiro: !e.financeiro }))}
                    className={cn("w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors",
                      expandOptional.financeiro ? "bg-brand text-white" : "bg-surface-subtle text-ink hover:bg-surface-muted")}>
                    <span>💰 Financeiro</span>
                    <span className="text-xs opacity-70">{expandOptional.financeiro ? "▲" : "▼"}</span>
                  </button>
                  {expandOptional.financeiro && (
                    <div className="p-4 flex flex-col gap-3 border-t border-surface-muted">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Valor total (R$)" value={form.fin_amount ?? ""} onChange={(v) => setForm((f) => ({ ...f, fin_amount: v }))} placeholder="0.00" type="number" />
                        <Field label="Valor pago (R$)" value={form.fin_paid ?? ""} onChange={(v) => setForm((f) => ({ ...f, fin_paid: v }))} placeholder="0.00" type="number" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-ink-secondary mb-1">Forma de pagamento</label>
                        <select value={form.fin_method ?? "PIX"} onChange={(e) => setForm((f) => ({ ...f, fin_method: e.target.value }))}
                          className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                          <option>PIX</option>
                          <option>Cartão de crédito</option>
                          <option>Cartão de débito</option>
                          <option>Dinheiro</option>
                          <option>Transferência</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </>}

              {/* ── NOVO ATENDIMENTO ── */}
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
              </>}

              {/* ── NOVO LANÇAMENTO ── */}
              {modal === "financeiro" && <>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Paciente *</label>
                  <select value={form.patient_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">Selecione o paciente</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <Field label="Descrição *" value={form.description ?? ""} onChange={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Mensalidade, consulta avulsa..." />
                <Field label="Valor (R$) *" value={form.amount ?? ""} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} type="number" placeholder="350.00" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">Tipo</label>
                    <select value={form.type ?? "receita"} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                      <option value="receita">Receita</option>
                      <option value="despesa">Despesa</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1">Status</label>
                    <select value={form.status ?? "pendente"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
                <Field label="Vencimento" value={form.due_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} type="date" />
              </>}
            </div>

            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted">
              <button onClick={() => setModal(null)}
                className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
                Cancelar
              </button>
              <button onClick={handleModalSubmit} disabled={loading}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium transition-colors shadow-brand disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; textarea?: boolean;
}) {
  const base = "w-full px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${base} py-2 resize-none`} />
        : <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${base} h-9`} />
      }
    </div>
  );
}
