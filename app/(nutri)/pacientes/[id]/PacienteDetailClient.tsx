"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  ChevronLeft, Phone, Plus, X, Edit2, Trash2, Pause, Play,
  Calendar, DollarSign, FileText, MoreVertical, Mail, Check,
} from "lucide-react";
import Link from "next/link";

interface Patient {
  id: string; name: string; phone?: string; plan?: string;
  start_date: string; notes?: string; status?: string; user_id?: string;
}
interface Appointment {
  id: string; date: string; weight?: number; evaluation?: string;
  conduct?: string; next_date?: string; notes?: string;
}
interface Financial {
  id: string; date: string; total_value: number; paid_value: number;
  pay_method: string; status: string; notes?: string; created_at: string;
}
interface Plan { id: string; name: string; duration_days: number; sessions: number; price?: number; }

type Tab = "historico" | "financeiro" | "dados";

export default function PacienteDetailClient({
  patient, appointments, financial, plan, plans, status,
  daysSinceLastAppt, daysUntilPlanEnd, planEndDate, nextDate,
  totalPago, totalPendente,
}: {
  patient: Patient; appointments: Appointment[]; financial: Financial[];
  plan?: Plan; plans: Plan[]; status: "em_dia" | "atrasado" | "renovacao";
  daysSinceLastAppt: number | null; daysUntilPlanEnd: number;
  planEndDate: string; nextDate: string | null; totalPago: number; totalPendente: number;
}) {
  const supabase = createClient();
  const router   = useRouter();

  const [tab, setTab]                   = useState<Tab>("historico");
  const [menuOpen, setMenuOpen]         = useState(false);
  const [editModal, setEditModal]       = useState(false);
  const [apptModal, setApptModal]       = useState<Appointment | null | "new">(null);
  const [finModal, setFinModal]         = useState<Financial | null | "new">(null);
  const [loading, setLoading]           = useState(false);
  const [form, setForm]                 = useState<Record<string, string>>({});
  const [inviteModal, setInviteModal]   = useState(false);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSent, setInviteSent]     = useState(false);

  const isInactive = patient.status === "inativo";
  const hasLogin   = !!patient.user_id;

  const statusConfig = {
    em_dia:    { label:"EM DIA",    color:"bg-green-100 text-green-700" },
    atrasado:  { label:"ATRASADO",  color:"bg-red-100 text-red-700"    },
    renovacao: { label:"RENOVAÇÃO", color:"bg-blue-100 text-blue-700"  },
  };
  const sc = statusConfig[status];

  // ── Funções ──────────────────────────────────────────────
  function openEdit() {
    setForm({ name:patient.name, phone:patient.phone??"", plan:patient.plan??"", start_date:patient.start_date, notes:patient.notes??"" });
    setEditModal(true); setMenuOpen(false);
  }

  async function saveEdit() {
    setLoading(true);
    const { error } = await supabase.from("patients").update({
      name:form.name, phone:form.phone, plan:form.plan, start_date:form.start_date, notes:form.notes,
    }).eq("id", patient.id);
    if (!error) { setEditModal(false); router.refresh(); }
    else alert("Erro ao salvar.");
    setLoading(false);
  }

  async function toggleInactive() {
    setMenuOpen(false);
    await supabase.from("patients").update({ status: isInactive ? "ativo" : "inativo" }).eq("id", patient.id);
    router.refresh();
  }

  async function deletePatient() {
    setMenuOpen(false);
    if (!confirm(`Deletar permanentemente ${patient.name}? Esta ação não pode ser desfeita.`)) return;
    await supabase.from("patients").delete().eq("id", patient.id);
    router.push("/pacientes");
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invite-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email:inviteEmail.trim(), patientId:patient.id, patientName:patient.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar convite");
      setInviteSent(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao enviar convite");
    } finally { setInviteLoading(false); }
  }

  function openAppt(appt?: Appointment) {
    if (appt) setForm({ date:appt.date, weight:String(appt.weight??""), evaluation:appt.evaluation??"", conduct:appt.conduct??"", next_date:appt.next_date??"", notes:appt.notes??"" });
    else setForm({ date:new Date().toISOString().split("T")[0] });
    setApptModal(appt ?? "new");
  }

  async function saveAppt() {
    setLoading(true);
    const { data:{ user } } = await supabase.auth.getUser();
    let nextDate = form.next_date || null;
    if (!nextDate && form.date) {
      const d = new Date(form.date); d.setDate(d.getDate() + 30);
      nextDate = d.toISOString().split("T")[0];
    }
    const payload = { date:form.date, weight:form.weight?Number(form.weight):null, evaluation:form.evaluation??"", conduct:form.conduct??"", next_date:nextDate, notes:form.notes??"" };
    if (apptModal !== "new" && apptModal) await supabase.from("appointments").update(payload).eq("id", apptModal.id);
    else await supabase.from("appointments").insert({ id:`APT-${Date.now()}`, user_id:user?.id, patient_id:patient.id, ...payload });
    setApptModal(null); setLoading(false); router.refresh();
  }

  async function deleteAppt(id: string) {
    if (!confirm("Deletar este atendimento?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    router.refresh();
  }

  function openFin(fin?: Financial) {
    if (fin) setForm({ date:fin.date, total_value:String(fin.total_value), paid_value:String(fin.paid_value), pay_method:fin.pay_method, notes:fin.notes??"" });
    else setForm({ date:new Date().toISOString().split("T")[0], pay_method:"PIX" });
    setFinModal(fin ?? "new");
  }

  async function saveFin() {
    setLoading(true);
    const { data:{ user } } = await supabase.auth.getUser();
    const totalNum = Number(form.total_value||0), paidNum = Number(form.paid_value||0);
    const payload = { date:form.date, total_value:totalNum, paid_value:paidNum, pay_method:form.pay_method??"PIX", status:paidNum>=totalNum?"PAGO":"PENDENTE", notes:form.notes??"" };
    if (finModal !== "new" && finModal) await supabase.from("financial").update(payload).eq("id", finModal.id);
    else await supabase.from("financial").insert({ id:`FIN-${Date.now()}`, user_id:user?.id, patient_id:patient.id, ...payload });
    setFinModal(null); setLoading(false); router.refresh();
  }

  async function deleteFin(id: string) {
    if (!confirm("Deletar este lançamento?")) return;
    await supabase.from("financial").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/pacientes" className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-ink text-sm mb-5 transition-colors">
        <ChevronLeft size={16} /> Pacientes
      </Link>

      {/* Header */}
      <div className={cn("bg-white border rounded-md p-5 shadow-card mb-5", isInactive ? "opacity-70" : "", "border-surface-muted")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-brand text-xl font-bold">{patient.name.charAt(0)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-ink">{patient.name}</h1>
                {isInactive && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-subtle text-ink-muted">INATIVO</span>}
              </div>
              <p className="text-xs text-ink-muted font-mono mt-0.5">{patient.id} · {plan?.name ?? patient.plan ?? "Sem plano"}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", sc.color)}>{sc.label}</span>
                {patient.phone && (
                  <a href={`https://wa.me/55${patient.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                    className="text-xs text-ink-muted hover:text-brand flex items-center gap-1 transition-colors">
                    <Phone size={11} /> {patient.phone}
                  </a>
                )}
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", hasLogin ? "bg-green-50 text-green-700" : "bg-surface-subtle text-ink-muted")}>
                  {hasLogin ? "✅ Tem acesso ao app" : "⚪ Sem acesso ao app"}
                </span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="relative shrink-0">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-subtle rounded-sm transition-colors">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 bg-white border border-surface-muted rounded-md shadow-card-hover w-52 z-10 overflow-hidden">
                <button onClick={openEdit} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                  <Edit2 size={14} /> Editar dados
                </button>
                <button onClick={() => { setInviteModal(true); setInviteSent(false); setInviteEmail(""); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                  <Mail size={14} /> Enviar convite de acesso
                </button>
                <button onClick={toggleInactive} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                  {isInactive ? <Play size={14} /> : <Pause size={14} />} {isInactive ? "Reativar" : "Inativar"}
                </button>
                <button onClick={deletePatient} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} /> Deletar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progresso */}
        {plan && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-muted mb-1.5">
              <span>{appointments.length}/{plan.sessions} consultas</span>
              <span>{Math.round((appointments.length / plan.sessions) * 100)}%</span>
            </div>
            <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full" style={{ width:`${Math.min((appointments.length/plan.sessions)*100,100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:"Início", value:formatDate(patient.start_date), sub:`Término: ${formatDate(planEndDate)}` },
          { label:"Última consulta", value:appointments[0]?formatDate(appointments[0].date):"—", sub:daysSinceLastAppt!=null?`${daysSinceLastAppt}d atrás`:"Sem registros" },
          { label:"Total recebido", value:formatCurrency(totalPago), sub:totalPendente>0?`${formatCurrency(totalPendente)} pendente`:"Sem pendências", valueClass:"text-green-600" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-surface-muted rounded-md p-3.5 shadow-card">
            <p className="text-[10px] text-ink-muted uppercase font-medium tracking-wide mb-1">{c.label}</p>
            <p className={cn("text-sm font-semibold", c.valueClass ?? "text-ink")}>{c.value}</p>
            <p className="text-[10px] text-ink-muted mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card">
        <div className="flex border-b border-surface-muted">
          {([
            { key:"historico",  label:"Histórico",  icon:Calendar   },
            { key:"financeiro", label:"Financeiro", icon:DollarSign },
            { key:"dados",      label:"Dados",      icon:FileText   },
          ] as const).map(({ key, label, icon:Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2",
                tab === key ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink")}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="p-5">

          {/* HISTÓRICO */}
          {tab === "historico" && (
            <div className="flex flex-col gap-3">
              <button onClick={() => openAppt()}
                className="self-end flex items-center gap-1.5 h-9 px-3 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm shadow-brand transition-colors">
                <Plus size={14} /> Novo atendimento
              </button>
              {appointments.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Nenhum atendimento registrado.</p>}
              {appointments.map((a) => (
                <div key={a.id} className="border border-surface-muted rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-ink">{formatDate(a.date)}{a.weight?` · ${a.weight}kg`:""}</p>
                    <div className="flex gap-1">
                      <button onClick={() => openAppt(a)} className="text-ink-muted hover:text-ink p-1"><Edit2 size={13} /></button>
                      <button onClick={() => deleteAppt(a.id)} className="text-ink-muted hover:text-red-500 p-1"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {a.evaluation && <p className="text-xs text-ink-secondary mb-1"><span className="font-medium text-ink-muted">Avaliação: </span>{a.evaluation}</p>}
                  {a.conduct && <p className="text-xs text-ink-secondary mb-1"><span className="font-medium text-ink-muted">Conduta: </span>{a.conduct}</p>}
                  {a.next_date && <p className="text-xs text-brand font-medium mt-2">Próxima: {formatDate(a.next_date)}</p>}
                </div>
              ))}
            </div>
          )}

          {/* FINANCEIRO */}
          {tab === "financeiro" && (
            <div className="flex flex-col gap-3">
              <button onClick={() => openFin()}
                className="self-end flex items-center gap-1.5 h-9 px-3 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm shadow-brand transition-colors">
                <Plus size={14} /> Novo lançamento
              </button>
              {financial.length === 0 && <p className="text-sm text-ink-muted text-center py-6">Nenhum lançamento financeiro.</p>}
              {financial.map((f) => (
                <div key={f.id} className="flex items-center justify-between border border-surface-muted rounded-md p-3.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{formatDate(f.date)} · {f.pay_method}</p>
                    <p className="text-xs text-ink-muted">
                      <span className={cn("font-medium", f.status==="PAGO"?"text-green-600":"text-amber-600")}>{f.status}</span>
                      {f.notes && ` · ${f.notes}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(f.paid_value)}</p>
                      {f.paid_value < f.total_value && <p className="text-xs text-ink-muted">de {formatCurrency(f.total_value)}</p>}
                    </div>
                    <button onClick={() => openFin(f)} className="text-ink-muted hover:text-ink p-1"><Edit2 size={13} /></button>
                    <button onClick={() => deleteFin(f.id)} className="text-ink-muted hover:text-red-500 p-1"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DADOS */}
          {tab === "dados" && (
            <div className="flex flex-col gap-4">
              {[
                { label:"Nome completo", value:patient.name },
                { label:"WhatsApp",     value:patient.phone||"—" },
                { label:"Plano",        value:plan?`${plan.name} (${plan.sessions} consultas, ${plan.duration_days} dias)`:patient.plan||"—" },
                { label:"Observações",  value:patient.notes||"Nenhuma." },
              ].map((d) => (
                <div key={d.label}>
                  <p className="text-xs text-ink-muted font-medium uppercase tracking-wide mb-1">{d.label}</p>
                  <p className="text-sm text-ink whitespace-pre-wrap">{d.value}</p>
                </div>
              ))}
              <button onClick={openEdit}
                className="self-start flex items-center gap-1.5 h-9 px-4 bg-white border border-surface-muted hover:bg-surface-subtle text-ink text-sm font-medium rounded-sm transition-colors">
                <Edit2 size={14} /> Editar dados
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Modais ───────────────────────────────────────────── */}

      {/* Editar paciente */}
      {editModal && (
        <Modal title="Editar paciente" onClose={() => setEditModal(false)}>
          <Field label="Nome completo" value={form.name??""} onChange={(v)=>setForm(f=>({...f,name:v}))} />
          <Field label="WhatsApp" value={form.phone??""} onChange={(v)=>setForm(f=>({...f,phone:v}))} />
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Plano</label>
            <select value={form.plan??""} onChange={(e)=>setForm(f=>({...f,plan:e.target.value}))}
              className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {plans.map((pl)=><option key={pl.id} value={pl.name}>{pl.name}</option>)}
            </select>
          </div>
          <Field label="Data de início" value={form.start_date??""} onChange={(v)=>setForm(f=>({...f,start_date:v}))} type="date" />
          <Field label="Observações" value={form.notes??""} onChange={(v)=>setForm(f=>({...f,notes:v}))} textarea />
          <ModalFooter onCancel={()=>setEditModal(false)} onSave={saveEdit} loading={loading} />
        </Modal>
      )}

      {/* Atendimento */}
      {apptModal && (
        <Modal title={apptModal==="new"?"Novo atendimento":"Editar atendimento"} onClose={()=>setApptModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" value={form.date??""} onChange={(v)=>setForm(f=>({...f,date:v}))} type="date" />
            <Field label="Peso (kg)" value={form.weight??""} onChange={(v)=>setForm(f=>({...f,weight:v}))} type="number" />
          </div>
          <Field label="Avaliação clínica" value={form.evaluation??""} onChange={(v)=>setForm(f=>({...f,evaluation:v}))} textarea />
          <Field label="Conduta" value={form.conduct??""} onChange={(v)=>setForm(f=>({...f,conduct:v}))} textarea />
          <Field label="Próxima consulta" value={form.next_date??""} onChange={(v)=>setForm(f=>({...f,next_date:v}))} type="date" />
          <p className="text-[11px] text-ink-muted -mt-1">Se deixar em branco, calculamos +30 dias automaticamente.</p>
          <Field label="Notas" value={form.notes??""} onChange={(v)=>setForm(f=>({...f,notes:v}))} />
          <ModalFooter onCancel={()=>setApptModal(null)} onSave={saveAppt} loading={loading} />
        </Modal>
      )}

      {/* Financeiro */}
      {finModal && (
        <Modal title={finModal==="new"?"Novo lançamento":"Editar lançamento"} onClose={()=>setFinModal(null)}>
          <Field label="Data" value={form.date??""} onChange={(v)=>setForm(f=>({...f,date:v}))} type="date" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor total (R$)" value={form.total_value??""} onChange={(v)=>setForm(f=>({...f,total_value:v}))} type="number" />
            <Field label="Valor pago (R$)" value={form.paid_value??""} onChange={(v)=>setForm(f=>({...f,paid_value:v}))} type="number" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Forma de pagamento</label>
            <select value={form.pay_method??"PIX"} onChange={(e)=>setForm(f=>({...f,pay_method:e.target.value}))}
              className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option>PIX</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option>
            </select>
          </div>
          <Field label="Observações" value={form.notes??""} onChange={(v)=>setForm(f=>({...f,notes:v}))} />
          <ModalFooter onCancel={()=>setFinModal(null)} onSave={saveFin} loading={loading} />
        </Modal>
      )}

      {/* Convite */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted">
              <h3 className="text-sm font-semibold text-ink">Enviar convite de acesso</h3>
              <button onClick={() => setInviteModal(false)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>
            <div className="p-5">
              {inviteSent ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-ink mb-1">Convite enviado!</p>
                  <p className="text-xs text-ink-muted">{inviteEmail} receberá um link para criar a senha e acessar o app.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-ink-muted mb-4">
                    O paciente receberá um email com link de acesso. Ele clica, cria a senha e entra no app automaticamente.
                  </p>
                  <Field label="Email do paciente *" value={inviteEmail} onChange={setInviteEmail} placeholder="email@exemplo.com" type="email" />
                  <p className="text-[11px] text-ink-muted bg-surface-subtle rounded-sm px-3 py-2 mt-2">
                    💡 O acesso será vinculado automaticamente a <strong>{patient.name}</strong>.
                  </p>
                </>
              )}
            </div>
            {!inviteSent ? (
              <div className="flex gap-2 px-5 pb-5">
                <button onClick={() => setInviteModal(false)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">Cancelar</button>
                <button onClick={sendInvite} disabled={inviteLoading || !inviteEmail.trim()}
                  className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Mail size={14} /> {inviteLoading ? "Enviando..." : "Enviar convite"}
                </button>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <button onClick={() => setInviteModal(false)} className="w-full h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand">Fechar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers de UI ─────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-md shadow-xl w-full max-w-md flex flex-col" style={{ maxHeight:"calc(100vh - 4rem)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, loading }: { onCancel:()=>void; onSave:()=>void; loading:boolean }) {
  return (
    <div className="flex gap-2 pt-2 border-t border-surface-muted mt-2">
      <button onClick={onCancel} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">Cancelar</button>
      <button onClick={onSave} disabled={loading} className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
        {loading ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type="text", textarea=false }: {
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; textarea?:boolean;
}) {
  const base = "w-full px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1">{label}</label>
      {textarea
        ? <textarea value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${base} py-2 resize-none`} />
        : <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className={`${base} h-9`} />}
    </div>
  );
}
