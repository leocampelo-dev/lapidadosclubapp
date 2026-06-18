"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  DollarSign, Eye, EyeOff, Search, Plus, X, Edit2, Trash2,
  ChevronDown, ChevronUp, Target,
} from "lucide-react";

interface FinancialRecord {
  id: string;
  patient_id: string;
  date: string;
  total_value: number;
  paid_value: number;
  pay_method: string;
  status: string;
  notes?: string;
  created_at: string;
  patients?: { name: string; plan?: string } | null;
}

interface Patient { id: string; name: string; }

const statusColors: Record<string, string> = {
  PAGO: "text-green-700 bg-green-100",
  PENDENTE: "text-amber-700 bg-amber-100",
};

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(d);
}

export default function FinanceiroClient({ records: initialRecords, patients }: { records: FinancialRecord[]; patients: Patient[] }) {
  const supabase = createClient();
  const router = useRouter();

  const [records, setRecords] = useState(initialRecords);
  const [hideValues, setHideValues] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [monthFilter, setMonthFilter] = useState<string>("todos");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [goal, setGoal] = useState(5000); // meta de faturamento mensal (pode evoluir para vir do banco)
  const [editGoal, setEditGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goal));

  const [modal, setModal] = useState<"new" | FinancialRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const currentMonthKey = monthKey(new Date().toISOString());

  // Agrupamento por mês para histórico
  const months = useMemo(() => {
    const map = new Map<string, FinancialRecord[]>();
    records.forEach((r) => {
      const key = monthKey(r.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, recs]) => ({
        key,
        label: monthLabel(key),
        faturado: recs.reduce((acc, r) => acc + Number(r.paid_value || 0), 0),
        pendente: recs.reduce((acc, r) => acc + (Number(r.total_value || 0) - Number(r.paid_value || 0)), 0),
        count: recs.length,
      }));
  }, [records]);

  const currentMonthData = months.find((m) => m.key === currentMonthKey);
  const goalProgress = currentMonthData ? Math.min((currentMonthData.faturado / goal) * 100, 100) : 0;

  const totalFaturado = records.reduce((acc, r) => acc + Number(r.paid_value || 0), 0);
  const totalPendente = records.reduce((acc, r) => acc + (Number(r.total_value || 0) - Number(r.paid_value || 0)), 0);

  const filtered = records.filter((r) => {
    const patientName = r.patients?.name ?? "";
    const matchesSearch = patientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || r.status === statusFilter;
    const matchesMonth = monthFilter === "todos" || monthKey(r.date) === monthFilter;
    return matchesSearch && matchesStatus && matchesMonth;
  });

  function openNew() {
    setForm({ date: new Date().toISOString().split("T")[0], pay_method: "PIX" });
    setModal("new");
  }

  function openEdit(r: FinancialRecord) {
    setForm({
      patient_id: r.patient_id, date: r.date,
      total_value: String(r.total_value), paid_value: String(r.paid_value),
      pay_method: r.pay_method, notes: r.notes ?? "",
    });
    setModal(r);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const totalNum = Number(form.total_value || 0);
      const paidNum = Number(form.paid_value || 0);
      const status = paidNum >= totalNum ? "PAGO" : "PENDENTE";

      const payload = {
        patient_id: form.patient_id, date: form.date,
        total_value: totalNum, paid_value: paidNum,
        pay_method: form.pay_method ?? "PIX", status,
        notes: form.notes ?? "",
      };

      if (modal !== "new" && modal) {
        const { data, error } = await supabase.from("financial").update(payload).eq("id", modal.id).select("*, patients(name, plan)").single();
        if (error) throw error;
        setRecords((prev) => prev.map((r) => r.id === modal.id ? data : r));
      } else {
        const { data, error } = await supabase.from("financial").insert({ id: `FIN-${Date.now()}`, user_id: user.id, ...payload }).select("*, patients(name, plan)").single();
        if (error) throw error;
        setRecords((prev) => [data, ...prev]);
      }
      setModal(null);
      setForm({});
    } catch (e) {
      console.error("Erro ao salvar lançamento:", e);
      alert("Erro ao salvar. Veja o console para detalhes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar este lançamento?")) return;
    await supabase.from("financial").delete().eq("id", id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DollarSign size={20} className="text-brand" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Financeiro</h1>
            <p className="text-ink-secondary text-xs mt-0.5">Controle de pagamentos e receitas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setHideValues(!hideValues)}
            className="flex items-center gap-1.5 h-9 px-3 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
            {hideValues ? <EyeOff size={14} /> : <Eye size={14} />} {hideValues ? "Mostrar valores" : "Ocultar valores"}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm shadow-brand transition-colors">
            <Plus size={14} /> Novo lançamento
          </button>
        </div>
      </div>

      {/* Meta de faturamento */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-ink flex items-center gap-2">
            <Target size={15} className="text-brand" /> Meta de faturamento — {monthLabel(currentMonthKey)}
          </p>
          {!editGoal ? (
            <button onClick={() => { setGoalInput(String(goal)); setEditGoal(true); }} className="text-xs text-brand hover:underline">Editar meta</button>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                className="w-24 h-7 px-2 text-xs rounded-sm border border-surface-muted focus:outline-none focus:ring-2 focus:ring-brand" />
              <button onClick={() => { setGoal(Number(goalInput) || goal); setEditGoal(false); }} className="text-xs text-brand font-medium hover:underline">Salvar</button>
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-3xl font-bold text-ink">{hideValues ? "••••••" : formatCurrency(currentMonthData?.faturado ?? 0)}</p>
          <p className="text-sm text-ink-muted">de {hideValues ? "••••••" : formatCurrency(goal)}</p>
        </div>
        <div className="h-2.5 bg-surface-subtle rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-700" style={{ width: `${goalProgress}%` }} />
        </div>
        <div className="flex justify-between text-xs text-ink-muted mt-1.5">
          <span>{Math.round(goalProgress)}% da meta</span>
        </div>
      </div>

      {/* Histórico mensal */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card mb-5 overflow-hidden">
        <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between px-5 py-3.5">
          <p className="text-sm font-semibold text-ink">Histórico mensal</p>
          {historyOpen ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
        </button>
        {historyOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {months.slice(0, 6).map((m) => (
              <div key={m.key} className="border border-surface-muted rounded-md p-3.5">
                <p className="text-sm font-medium text-ink capitalize mb-2">{m.label}</p>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ink-muted">Faturado</span>
                  <span className="text-green-600 font-semibold">{hideValues ? "••••" : formatCurrency(m.faturado)}</span>
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-ink-muted">Pendente</span>
                  <span className="text-amber-600 font-semibold">{hideValues ? "••••" : formatCurrency(m.pendente)}</span>
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-ink-muted">Lançamentos</span>
                  <span className="text-ink font-medium">{m.count}</span>
                </div>
                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${m.faturado + m.pendente > 0 ? (m.faturado / (m.faturado + m.pendente)) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            {months.length === 0 && <p className="text-sm text-ink-muted col-span-full text-center py-4">Sem histórico ainda.</p>}
          </div>
        )}
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card text-center">
          <p className="text-xl font-bold text-green-600">{hideValues ? "••••••" : formatCurrency(totalFaturado)}</p>
          <p className="text-xs text-ink-muted mt-1">Faturado (todos)</p>
        </div>
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card text-center">
          <p className="text-xl font-bold text-red-500">{hideValues ? "••••••" : formatCurrency(totalPendente)}</p>
          <p className="text-xs text-ink-muted mt-1">Pendente (todos)</p>
        </div>
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card text-center">
          <p className="text-xl font-bold text-ink">{records.length}</p>
          <p className="text-xs text-ink-muted mt-1">Registros</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente..."
            className="w-full h-9 pl-8 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="todos">Todos os status</option>
          <option value="PAGO">Pago</option>
          <option value="PENDENTE">Pendente</option>
        </select>
        <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
          className="h-9 px-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="todos">Todos os meses</option>
          {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
        <div className="hidden md:grid grid-cols-[90px_1.4fr_70px_90px_90px_110px_90px_110px] gap-2 px-4 py-2.5 border-b border-surface-muted bg-surface-subtle text-xs font-medium text-ink-muted uppercase tracking-wide">
          <span>Data</span><span>Paciente</span><span>Plano</span><span>Total</span><span>Pago</span><span>Forma</span><span>Status</span><span>Ações</span>
        </div>
        <div className="divide-y divide-surface-muted">
          {filtered.map((r) => (
            <div key={r.id} className="grid grid-cols-1 md:grid-cols-[90px_1.4fr_70px_90px_90px_110px_90px_110px] gap-2 px-4 py-3 items-center">
              <span className="text-xs text-ink-muted hidden md:block">{formatDate(r.date)}</span>
              <div>
                <p className="text-sm font-medium text-ink">{r.patients?.name ?? "—"}</p>
                <p className="text-xs text-ink-muted md:hidden">{formatDate(r.date)}</p>
              </div>
              <span className="text-xs text-ink-muted hidden md:block">{r.patients?.plan ?? "—"}</span>
              <span className="text-sm text-ink hidden md:block">{hideValues ? "••••" : formatCurrency(r.total_value)}</span>
              <span className="text-sm font-medium text-green-600 hidden md:block">{hideValues ? "••••" : formatCurrency(r.paid_value)}</span>
              <span className="text-xs text-ink-muted hidden md:block">{r.pay_method}</span>
              <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full w-fit hidden md:flex md:items-center md:justify-center", statusColors[r.status] ?? "")}>
                {r.status}
              </span>
              <div className="flex gap-1.5 mt-2 md:mt-0">
                <button onClick={() => openEdit(r)} className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle transition-colors flex items-center gap-1">
                  <Edit2 size={11} /> Editar
                </button>
                <button onClick={() => handleDelete(r.id)} className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="p-8 text-center"><p className="text-ink-muted text-sm">Nenhum lançamento encontrado.</p></div>
          )}
        </div>
      </div>

      {/* Modal novo/editar lançamento */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <h3 className="text-sm font-semibold text-ink">{modal === "new" ? "Novo lançamento" : "Editar lançamento"}</h3>
              <button onClick={() => setModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
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
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted shrink-0">
              <button onClick={() => setModal(null)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">Cancelar</button>
              <button onClick={handleSave} disabled={loading} className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" />
    </div>
  );
}
