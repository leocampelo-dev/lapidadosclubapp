"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatDate, cn } from "@/lib/utils";
import {
  Search, Plus, X, Edit2, Trash2, ChevronDown, ChevronUp,
  ClipboardList, Calendar, Phone,
} from "lucide-react";

interface Patient { id: string; name: string; phone?: string; plan?: string; start_date?: string; }
interface Plan { id: string; name: string; duration_days: number; sessions: number; }
interface Appointment {
  id: string; patient_id: string; date: string; weight?: number;
  evaluation?: string; conduct?: string; next_date?: string; notes?: string;
}
interface GroupedPatient {
  patient: Patient; plan?: Plan;
  appointments: Appointment[]; totalAppts: number;
}
interface PrevistoItem {
  patient_id: string; patient_name: string; patient_phone?: string;
  plan_name: string; sessions_total: number; sessions_done: number;
  projected_date: string; session_number: number;
  last_appt_date: string | null; days_until: number;
}

type TabType = "registros" | "previstos";

function monthKey(d: string) { return d.slice(0, 7); }
function monthLabel(k: string) {
  const [y, m] = k.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(Number(y), Number(m) - 1, 1));
}

export default function AtendimentosClient({
  grouped, previstos, patients, today,
}: {
  grouped: GroupedPatient[];
  previstos: PrevistoItem[];
  patients: Patient[];
  today: string;
}) {
  const supabase = createClient();
  const router   = useRouter();

  const [tab, setTab]                   = useState<TabType>("registros");
  const [search, setSearch]             = useState("");
  const [monthFilter, setMonthFilter]   = useState("todos");
  const [patientFilter, setPatientFilter] = useState("todos");
  const [openPatients, setOpenPatients] = useState<Set<string>>(new Set());
  const [modal, setModal]               = useState<"new" | Appointment | null>(null);
  const [form, setForm]                 = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(false);

  const allAppts = grouped.flatMap((g) => g.appointments);
  const months   = Array.from(new Set(allAppts.map((a) => monthKey(a.date))))
    .sort((a, b) => b.localeCompare(a));

  function togglePatient(id: string) {
    setOpenPatients((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const filteredGroups = useMemo(() =>
    grouped
      .filter((g) => {
        if (patientFilter !== "todos" && g.patient.id !== patientFilter) return false;
        if (search && !g.patient.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (monthFilter !== "todos") return g.appointments.some((a) => monthKey(a.date) === monthFilter);
        return true;
      })
      .map((g) => ({
        ...g,
        appointments: monthFilter !== "todos"
          ? g.appointments.filter((a) => monthKey(a.date) === monthFilter)
          : g.appointments,
      }))
      .filter((g) => g.appointments.length > 0),
    [grouped, patientFilter, search, monthFilter]
  );

  // Agrupa previstos por mês
  const previstosGrouped = useMemo(() => {
    const map = new Map<string, PrevistoItem[]>();
    previstos.forEach((p) => {
      const k = monthKey(p.projected_date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [previstos]);

  function openNew(patientId?: string) {
    setForm({ patient_id: patientId ?? "", date: new Date().toISOString().split("T")[0] });
    setModal("new");
  }
  function openEdit(appt: Appointment) {
    setForm({
      patient_id: appt.patient_id, date: appt.date,
      weight: appt.weight ? String(appt.weight) : "",
      evaluation: appt.evaluation ?? "", conduct: appt.conduct ?? "",
      next_date: appt.next_date ?? "", notes: appt.notes ?? "",
    });
    setModal(appt);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let nextDate = form.next_date || null;
      if (!nextDate && form.date) {
        const d = new Date(form.date);
        d.setDate(d.getDate() + 30);
        nextDate = d.toISOString().split("T")[0];
      }

      const payload = {
        patient_id: form.patient_id, date: form.date,
        weight: form.weight ? Number(form.weight) : null,
        evaluation: form.evaluation ?? "", conduct: form.conduct ?? "",
        next_date: nextDate, notes: form.notes ?? "",
      };

      if (modal !== "new" && modal) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", modal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert({
          id: `APT-${Date.now()}`, user_id: user.id, ...payload,
        });
        if (error) throw error;
      }
      setModal(null); setForm({});
      router.refresh();
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar. Veja o console.");
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar este atendimento?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    router.refresh();
  }

  const totalRegistros = grouped.reduce((acc, g) => acc + g.totalAppts, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Atendimentos</h1>
          <p className="text-ink-secondary text-sm mt-0.5">{totalRegistros} registros</p>
        </div>
        <button onClick={() => openNew()}
          className="flex items-center gap-1.5 h-9 px-4 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm shadow-brand transition-colors">
          <Plus size={14} /> Novo atendimento
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-muted mb-5 gap-1">
        {([
          { key:"registros", label:"Registros",                            icon:ClipboardList },
          { key:"previstos", label:`Previstos (${previstos.length})`,      icon:Calendar      },
        ] as const).map(({ key, label, icon:Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === key ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink"
            )}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── ABA REGISTROS ──────────────────────────────────── */}
      {tab === "registros" && (
        <>
          <div className="flex gap-2 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por paciente..."
                className="w-full h-9 pl-8 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)}
              className="h-9 px-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="todos">Todos os pacientes</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              className="h-9 px-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="todos">Todos os meses</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <span className="text-xs text-ink-muted self-center shrink-0">
              {filteredGroups.length} paciente{filteredGroups.length !== 1 ? "s" : ""} · {filteredGroups.reduce((acc, g) => acc + g.appointments.length, 0)} registros
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {filteredGroups.length === 0 && (
              <div className="bg-white border border-surface-muted rounded-md p-8 text-center shadow-card">
                <p className="text-ink-muted text-sm">Nenhum atendimento encontrado.</p>
              </div>
            )}
            {filteredGroups.map(({ patient, plan, appointments: appts }) => {
              const isOpen    = openPatients.has(patient.id);
              const lastAppt  = appts[0];
              const sessionsText = plan
                ? `${appts.length}/${plan.sessions} consultas (${Math.round((appts.length / plan.sessions) * 100)}%)`
                : `${appts.length} consulta${appts.length !== 1 ? "s" : ""}`;

              return (
                <div key={patient.id} className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
                  {/* Cabeçalho — DIV clicável (não button) */}
                  <div onClick={() => togglePatient(patient.id)}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-subtle/50 transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <span className="text-brand text-sm font-semibold">{patient.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-ink">{patient.name}</p>
                        {plan && (
                          <span className="text-[10px] font-medium bg-surface-subtle text-ink-secondary px-2 py-0.5 rounded-full">
                            {plan.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Último: {lastAppt ? `${formatDate(lastAppt.date)}${lastAppt.weight ? ` · ${lastAppt.weight}kg` : ""}` : "—"}
                        {" · "}{sessionsText}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-ink-muted">{appts.length} reg.</span>
                      <button onClick={() => openNew(patient.id)}
                        className="h-6 px-2 text-[11px] bg-brand text-white rounded-sm hover:bg-brand-dark transition-colors">
                        + Atend.
                      </button>
                      <span onClick={() => togglePatient(patient.id)} className="cursor-pointer">
                        {isOpen ? <ChevronUp size={16} className="text-ink-muted" /> : <ChevronDown size={16} className="text-ink-muted" />}
                      </span>
                    </div>
                  </div>

                  {/* Atendimentos expandidos */}
                  {isOpen && (
                    <div className="border-t border-surface-muted divide-y divide-surface-muted">
                      {appts.map((appt, idx) => (
                        <div key={appt.id} className="px-4 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center shrink-0">
                                <span className="text-white text-[10px] font-bold">{appts.length - idx}</span>
                              </div>
                              <p className="text-sm font-medium text-ink">
                                {formatDate(appt.date)}{appt.weight ? ` · ${appt.weight}kg` : ""}
                              </p>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => openEdit(appt)}
                                className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle flex items-center gap-1">
                                <Edit2 size={11} /> Editar
                              </button>
                              <button onClick={() => handleDelete(appt.id)}
                                className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-red-500 hover:bg-red-50">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-8">
                            {appt.evaluation && (
                              <div>
                                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide mb-0.5">Avaliação</p>
                                <p className="text-xs text-ink-secondary">{appt.evaluation}</p>
                              </div>
                            )}
                            {appt.conduct && (
                              <div>
                                <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide mb-0.5">Conduta</p>
                                <p className="text-xs text-ink-secondary">{appt.conduct}</p>
                              </div>
                            )}
                          </div>
                          {appt.notes && (
                            <p className="text-xs text-ink-muted ml-8 mt-1.5 italic">Nota: {appt.notes}</p>
                          )}
                          {appt.next_date && (
                            <p className="text-xs text-brand font-medium ml-8 mt-2">
                              Próxima: {formatDate(appt.next_date)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── ABA PREVISTOS ──────────────────────────────────── */}
      {tab === "previstos" && (
        <div className="flex flex-col gap-6">
          {previstosGrouped.length === 0 && (
            <div className="bg-white border border-surface-muted rounded-md p-8 text-center shadow-card">
              <p className="text-ink-muted text-sm">Nenhuma consulta prevista.</p>
            </div>
          )}

          {previstosGrouped.map(([monthK, items]) => {
            const isCurrentMonth = monthK === today.slice(0, 7);
            return (
              <div key={monthK}>
                {/* Cabeçalho do mês */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className={cn(
                    "text-sm font-semibold capitalize",
                    isCurrentMonth ? "text-brand" : "text-ink"
                  )}>
                    {monthLabel(monthK)}
                    {isCurrentMonth && <span className="ml-2 text-[10px] font-medium bg-brand/10 text-brand px-1.5 py-0.5 rounded-full">Este mês</span>}
                  </h2>
                  <span className="text-xs text-ink-muted">· {items.length} consulta{items.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="flex flex-col gap-2">
                  {items.map((item, i) => {
                    const isUrgent  = item.days_until <= 7;
                    const isNear    = item.days_until <= 14;
                    return (
                      <div key={`${item.patient_id}-${i}`}
                        className={cn(
                          "bg-white border rounded-md p-4 shadow-card",
                          isUrgent ? "border-amber-200" : "border-surface-muted"
                        )}>
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                            <span className="text-brand text-sm font-semibold">{item.patient_name.charAt(0)}</span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-ink">{item.patient_name}</p>
                              <span className="text-[10px] font-medium bg-surface-subtle text-ink-secondary px-1.5 py-0.5 rounded-full">
                                {item.plan_name}
                              </span>
                            </div>

                            {/* Consultas feitas / total */}
                            <div className="flex items-center gap-3 mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="flex gap-0.5">
                                  {Array.from({ length: item.sessions_total }).map((_, idx) => (
                                    <div key={idx}
                                      className={cn(
                                        "w-3 h-3 rounded-full",
                                        idx < item.sessions_done ? "bg-brand" : idx === item.session_number - 1 ? "bg-amber-400" : "bg-surface-muted"
                                      )} />
                                  ))}
                                </div>
                                <p className="text-xs text-ink-muted">
                                  {item.sessions_done}/{item.sessions_total} · <span className="font-medium text-ink">{item.session_number}ª consulta</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-ink-muted">
                                Previsão: <span className="font-medium text-ink">{formatDate(item.projected_date)}</span>
                              </p>
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                isUrgent ? "bg-amber-100 text-amber-700" : isNear ? "bg-yellow-50 text-yellow-700" : "bg-surface-subtle text-ink-muted"
                              )}>
                                {item.days_until === 0 ? "Hoje!" : `em ${item.days_until}d`}
                              </span>
                            </div>
                          </div>

                          {/* Ações */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => openNew(item.patient_id)}
                              className="h-7 px-3 text-xs bg-brand text-white rounded-sm hover:bg-brand-dark transition-colors">
                              Registrar
                            </button>
                            {item.patient_phone && (
                              <a href={`https://wa.me/55${item.patient_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Oi ${item.patient_name.split(" ")[0]}! Passando pra lembrar da sua consulta prevista para ${formatDate(item.projected_date)} 📅`)}`}
                                target="_blank" rel="noreferrer"
                                className="h-7 px-3 text-xs border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-sm transition-colors flex items-center justify-center gap-1">
                                <Phone size={10} /> WA
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo / editar atendimento */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight:"calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <h3 className="text-sm font-semibold text-ink">
                {modal === "new" ? "Novo atendimento" : "Editar atendimento"}
              </h3>
              <button onClick={() => setModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {modal === "new" && (
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Paciente *</label>
                  <select value={form.patient_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
                    className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">Selecione o paciente</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data *" value={form.date ?? ""} onChange={(v) => setForm((f) => ({ ...f, date: v }))} type="date" />
                <Field label="Peso (kg)" value={form.weight ?? ""} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} placeholder="75.5" type="number" />
              </div>
              <Field label="Avaliação clínica" value={form.evaluation ?? ""} onChange={(v) => setForm((f) => ({ ...f, evaluation: v }))} placeholder="Queixas, composição corporal..." textarea />
              <Field label="Conduta / Plano alimentar" value={form.conduct ?? ""} onChange={(v) => setForm((f) => ({ ...f, conduct: v }))} placeholder="Prescrição, orientações..." textarea />
              <Field label="Próxima consulta" value={form.next_date ?? ""} onChange={(v) => setForm((f) => ({ ...f, next_date: v }))} type="date" />
              <p className="text-[11px] text-ink-muted -mt-1">Se deixar em branco, calculamos +30 dias automaticamente.</p>
              <Field label="Notas extras" value={form.notes ?? ""} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Observação rápida..." />
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted shrink-0">
              <button onClick={() => setModal(null)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">Cancelar</button>
              <button onClick={handleSave} disabled={loading}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
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
