"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, ChevronLeft, ChevronRight, Check, User, Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  sessions: number;
  price?: number;
}

interface Props {
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}

type Step = 1 | 2 | 3;

export default function NovoPacienteWizard({ plans, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Dados do paciente (passo 1)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [planName, setPlanName] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Atendimento (passo 2) — opcional, ativado por toggle
  const [includeAppt, setIncludeAppt] = useState(true);
  const [apptDate, setApptDate] = useState(new Date().toISOString().split("T")[0]);
  const [apptWeight, setApptWeight] = useState("");
  const [apptEvaluation, setApptEvaluation] = useState("");
  const [apptConduct, setApptConduct] = useState("");
  const [apptNextDate, setApptNextDate] = useState("");

  // Financeiro (passo 3) — opcional, ativado por toggle
  const [includeFin, setIncludeFin] = useState(true);
  const [finTotal, setFinTotal] = useState("");
  const [finPaid, setFinPaid] = useState("");
  const [finMethod, setFinMethod] = useState("PIX");

  const selectedPlan = plans.find((p) => p.name === planName);
  const planEnd = selectedPlan && startDate
    ? (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + selectedPlan.duration_days);
        return d.toISOString().split("T")[0];
      })()
    : null;

  function fmtBR(dateStr: string) {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR");
  }

  function canAdvanceStep1() {
    return name.trim() !== "" && planName !== "" && startDate !== "";
  }

  async function handleFinish() {
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const patientId = `PAC-${String(Date.now()).slice(-6)}`;
      const { error: pErr } = await supabase.from("patients").insert({
        id: patientId,
        owner_id: user.id,
        name,
        phone: phone || "",
        email: email || "",
        plan: planName,
        start_date: startDate,
        notes: notes || "",
      });
      if (pErr) throw pErr;

      let lastApptDate = apptDate;
      if (includeAppt && apptDate) {
        let nextDate = apptNextDate || null;
        if (!nextDate) {
          const d = new Date(apptDate);
          d.setDate(d.getDate() + 30);
          nextDate = d.toISOString().split("T")[0];
        }
        const { error: aErr } = await supabase.from("appointments").insert({
          id: `APT-${Date.now()}`,
          user_id: user.id,
          patient_id: patientId,
          date: apptDate,
          weight: apptWeight ? Number(apptWeight) : null,
          evaluation: apptEvaluation || "",
          conduct: apptConduct || "",
          next_date: nextDate,
        });
        if (aErr) throw aErr;
        lastApptDate = apptDate;
      }

      if (includeFin && finTotal) {
        const totalNum = Number(finTotal);
        const paidNum = finPaid ? Number(finPaid) : 0;
        const { error: fErr } = await supabase.from("financial").insert({
          id: `FIN-${Date.now()}`,
          user_id: user.id,
          patient_id: patientId,
          date: lastApptDate || startDate,
          total_value: totalNum,
          paid_value: paidNum,
          pay_method: finMethod,
          status: paidNum >= totalNum ? "PAGO" : "PENDENTE",
          notes: `Plano ${planName}`,
        });
        if (fErr) throw fErr;
      }

      onSaved();
    } catch (e) {
      console.error("Erro ao salvar paciente:", e);
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      setError(msg || "Erro desconhecido ao salvar. Veja o console (F12).");
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { num: 1, label: "Dados", icon: User },
    { num: 2, label: "Atendimento", icon: Calendar },
    { num: 3, label: "Financeiro", icon: DollarSign },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100vh - 4rem)" }}>

        {/* Header com indicador de passos */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
          <h3 className="text-sm font-semibold text-ink">Novo paciente</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="flex items-center justify-center gap-2 px-5 py-3 border-b border-surface-muted shrink-0">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                step === s.num ? "bg-brand text-white" : step > s.num ? "bg-brand/20 text-brand" : "bg-surface-subtle text-ink-muted"
              )}>
                {step > s.num ? <Check size={13} /> : s.num}
              </div>
              <span className={cn("text-xs font-medium hidden sm:inline", step === s.num ? "text-ink" : "text-ink-muted")}>{s.label}</span>
              {i < steps.length - 1 && <div className="w-6 h-px bg-surface-muted" />}
            </div>
          ))}
        </div>

        {/* Conteúdo da etapa atual — sem scroll aninhado, ocupa o espaço disponível */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">

          {/* PASSO 1: Dados do paciente */}
          {step === 1 && <>
            <Field label="Nome completo *" value={name} onChange={setName} placeholder="Ex: Ana Carolina Souza" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp" value={phone} onChange={setPhone} placeholder="(82) 99999-9999" />
              <Field label="Email" value={email} onChange={setEmail} placeholder="paciente@email.com" type="email" />
            </div>
            <p className="text-[11px] text-ink-muted -mt-1">
              O email é usado depois pra enviar o convite de acesso ao app do paciente.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Plano *</label>
                <select value={planName} onChange={(e) => setPlanName(e.target.value)}
                  className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value="">Selecionar plano...</option>
                  {plans.map((pl) => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Consultas no plano</label>
                <input value={selectedPlan?.sessions ?? "—"} readOnly className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink text-sm cursor-not-allowed" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de início *" value={startDate} onChange={setStartDate} type="date" />
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Término (automático)</label>
                <input value={planEnd ? fmtBR(planEnd) : "Selecione o plano"} readOnly
                  className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface-subtle text-ink-muted text-sm cursor-not-allowed" />
              </div>
            </div>
            <Field label="Observações" value={notes} onChange={setNotes} placeholder="Objetivos, alergias..." textarea />
          </>}

          {/* PASSO 2: Atendimento */}
          {step === 2 && <>
            <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
              <input type="checkbox" checked={includeAppt} onChange={(e) => setIncludeAppt(e.target.checked)} className="w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-sm font-medium text-ink">Registrar 1º atendimento</span>
            </label>
            {includeAppt ? <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data" value={apptDate} onChange={setApptDate} type="date" />
                <Field label="Peso (kg)" value={apptWeight} onChange={setApptWeight} placeholder="75.5" type="number" />
              </div>
              <Field label="Avaliação clínica" value={apptEvaluation} onChange={setApptEvaluation} placeholder="Observações clínicas..." textarea />
              <Field label="Conduta / Plano alimentar" value={apptConduct} onChange={setApptConduct} placeholder="Prescrição, orientações..." textarea />
              <Field label="Próxima consulta" value={apptNextDate} onChange={setApptNextDate} type="date" />
              <p className="text-[11px] text-ink-muted -mt-1">Se deixar em branco, calculamos +30 dias automaticamente.</p>
            </> : (
              <p className="text-sm text-ink-muted py-4 text-center">Você pode registrar o atendimento depois, na ficha do paciente.</p>
            )}
          </>}

          {/* PASSO 3: Financeiro */}
          {step === 3 && <>
            <label className="flex items-center gap-2 mb-1 cursor-pointer select-none">
              <input type="checkbox" checked={includeFin} onChange={(e) => setIncludeFin(e.target.checked)} className="w-4 h-4 accent-brand cursor-pointer" />
              <span className="text-sm font-medium text-ink">Registrar pagamento</span>
            </label>
            {includeFin ? <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor total (R$)" value={finTotal} onChange={setFinTotal} placeholder={selectedPlan?.price ? String(selectedPlan.price) : "0.00"} type="number" />
                <Field label="Valor pago (R$)" value={finPaid} onChange={setFinPaid} placeholder="0.00" type="number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Forma de pagamento</label>
                <select value={finMethod} onChange={(e) => setFinMethod(e.target.value)}
                  className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  <option>PIX</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option>
                </select>
              </div>
              {selectedPlan?.price && (
                <p className="text-[11px] text-ink-muted -mt-1">Preço sugerido do plano: R$ {Number(selectedPlan.price).toFixed(2)}</p>
              )}
            </> : (
              <p className="text-sm text-ink-muted py-4 text-center">Você pode registrar o pagamento depois, na ficha do paciente.</p>
            )}
          </>}

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-sm">{error}</p>}
        </div>

        {/* Footer com navegação */}
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-surface-muted shrink-0">
          {step > 1 ? (
            <button onClick={() => setStep((s) => (s - 1) as Step)} className="flex items-center gap-1 h-9 px-4 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
              <ChevronLeft size={14} /> Voltar
            </button>
          ) : (
            <button onClick={onClose} className="h-9 px-4 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
              Cancelar
            </button>
          )}

          <div className="flex-1" />

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 1 && !canAdvanceStep1()}
              className="flex items-center gap-1 h-9 px-4 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50 transition-colors">
              Continuar <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading}
              className="flex items-center gap-1.5 h-9 px-5 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50 transition-colors">
              {loading ? "Salvando..." : <>Salvar paciente <Check size={14} /></>}
            </button>
          )}
        </div>
      </div>
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
