"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── GAMIFICAÇÃO ─────────────────────────────────────────── */
const RANKS = [
  { name:"BRUTO",     icon:"🪨", min:0,    color:"#9ca3af" },
  { name:"POLIDO",    icon:"🧠", min:200,  color:"#60a5fa" },
  { name:"AFIADO",    icon:"⚡", min:500,  color:"#a78bfa" },
  { name:"IMPARÁVEL", icon:"🔥", min:1000, color:"#fb923c" },
  { name:"LAPIDADO",  icon:"👑", min:2000, color:"#fcd34d" },
];
const WEEK_TIERS = [
  { min:90, name:"✅ Semana Impecável!",   color:"#FF5C1A" },
  { min:75, name:"💪 Semana Muito Sólida", color:"#22c55e" },
  { min:55, name:"⚡ Semana em Progresso", color:"#3b82f6" },
  { min:40, name:"🎯 Semana Desafiadora",  color:"#f59e0b" },
  { min:0,  name:"🚨 Semana Difícil",      color:"#ef4444" },
];
const getRank     = (p: number) => [...RANKS].reverse().find((r) => p >= r.min) ?? RANKS[0];
const getWeekTier = (s: number) => WEEK_TIERS.find((t) => s >= t.min) ?? WEEK_TIERS[4];

interface FormState {
  weight: string; height: string;
  diet_score: number; off_plan_meals: number;
  training_score: number; cardio_score: number;
  energy_level: number; hunger_level: number;
  sleep_score: number; bowel_score: number;
  wins: string; main_difficulty: string;
  external_factors: string; improvements: string; needs_help: string;
}

const INIT: FormState = {
  weight:"", height:"",
  diet_score:8, off_plan_meals:0, training_score:8, cardio_score:10,
  energy_level:8, hunger_level:3, sleep_score:8, bowel_score:3,
  wins:"", main_difficulty:"", external_factors:"", improvements:"", needs_help:"",
};

function calcScore(f: FormState): number {
  return (
    Math.round((f.diet_score     / 10) * 25) +
    Math.round((f.training_score / 10) * 20) +
    Math.round((f.energy_level   / 10) * 15) +
    f.cardio_score +
    Math.max(0, 10 - f.off_plan_meals * 2) +
    Math.round(((10 - f.hunger_level) / 10) * 5) +
    Math.round((f.sleep_score / 10) * 10) +
    f.bowel_score
  );
}

/* ─── SLIDER ──────────────────────────────────────────────── */
function Slider({ label, sub, emoji, value, onChange }: {
  label:string; sub?:string; emoji:string; value:number; onChange:(v:number)=>void;
}) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-base font-bold text-white">{emoji} {label}</p>
          {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
        </div>
        <span className="text-4xl font-black" style={{ color:"#E85D04" }}>{value}</span>
      </div>
      <input type="range" min={1} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ background:`linear-gradient(to right,#E85D04 ${pct}%,rgba(255,255,255,.1) ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] text-white/20 mt-1">
        <span>1</span><span>10</span>
      </div>
    </div>
  );
}

/* ─── ANEL SVG ────────────────────────────────────────────── */
function ScoreRing({ score, color }: { score:number; color:string }) {
  const r = 80; const c = 2 * Math.PI * r;
  return (
    <div className="relative w-48 h-48 mx-auto my-6">
      <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="14"/>
        <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="14"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          style={{ transition:"stroke-dashoffset 1.2s ease-out" }}/>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black" style={{ color }}>{score}</span>
        <span className="text-xs text-white/30 font-medium">/ 100</span>
      </div>
    </div>
  );
}

interface Patient { id:string; name:string; plan?:string; start_date?:string; }
interface HistoryItem {
  id:string; week_number:number; year:number; lapidados_score?:number;
  diet_score?:number; training_score?:number; created_at:string;
}

export default function CheckinForm({
  patient, currentWeek, currentYear, alreadyDone, history, totalPts,
}: {
  patient:Patient; currentWeek:number; currentYear:number;
  alreadyDone:boolean; history:HistoryItem[]; totalPts:number;
}) {
  const supabase = createClient();
  const router   = useRouter();

  const [step, setStep]     = useState<number>(-1); // -1=dashboard
  const [form, setForm]     = useState<FormState>(INIT);
  const [loading, setLoading] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [animScore, setAnimScore]   = useState(0);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Animação do score no resultado
  useEffect(() => {
    if (step !== 8 || finalScore === 0) return;
    let cur = 0;
    const id = setInterval(() => {
      cur = Math.min(cur + Math.ceil(finalScore / 40), finalScore);
      setAnimScore(cur);
      if (cur >= finalScore) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [step, finalScore]);

  const rank    = getRank(totalPts);
  const score   = calcScore(form);
  const newTotal = totalPts + finalScore;
  const newRank  = getRank(newTotal);

  const bg = {
    background:"linear-gradient(135deg,#0a0a0a 0%,#111111 50%,#1a0800 100%)",
    minHeight:"100vh",
  };

  async function handleSubmit() {
    setLoading(true);
    const s = calcScore(form);
    try {
      const { error } = await supabase.from("checkins").insert({
        patient_id:       patient.id,
        week_number:      currentWeek,
        year:             currentYear,
        weight:           form.weight  ? Number(form.weight)  : null,
        height:           form.height  ? Number(form.height)  : null,
        diet_score:       form.diet_score,
        off_plan_meals:   form.off_plan_meals,
        training_score:   form.training_score,
        cardio_score:     form.cardio_score,
        cardio_done:      form.cardio_score > 0,
        energy_level:     form.energy_level,
        hunger_level:     form.hunger_level,
        sleep_score:      form.sleep_score,
        bowel_score:      form.bowel_score,
        wins:             form.wins,
        main_difficulty:  form.main_difficulty,
        external_factors: form.external_factors,
        improvements:     form.improvements,
        needs_help:       form.needs_help,
        lapidados_score:  s,
      });
      if (error) throw error;
      setFinalScore(s);
      setStep(8);
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  /* ── DASHBOARD / JÁ FEZ ─────────────────────────────────── */
  if (step === -1) {
    return (
      <div style={bg} className="max-w-md mx-auto px-4 pt-8 pb-28">
        {/* Card de rank */}
        <div className="rounded-2xl p-5 mb-5 border border-white/10"
          style={{ background:`linear-gradient(135deg,${rank.color}18,transparent)` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">Seu Rank</p>
              <p className="text-2xl font-black" style={{ color:rank.color }}>{rank.icon} {rank.name}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-white">{totalPts}</p>
              <p className="text-white/30 text-xs">pontos totais</p>
            </div>
          </div>
          {(() => {
            const next = [...RANKS].find((r) => r.min > totalPts);
            const pct  = next ? Math.round(((totalPts - rank.min) / (next.min - rank.min)) * 100) : 100;
            return (
              <>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full" style={{ width:`${pct}%`, background:rank.color }} />
                </div>
                <p className="text-white/25 text-[10px]">
                  {next ? `${next.min - totalPts}pts para ${next.icon} ${next.name}` : "Rank máximo! 👑"}
                </p>
              </>
            );
          })()}
        </div>

        {alreadyDone ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-5 text-center">
            <p className="text-green-400 text-xl font-black mb-1">✅ Check-in enviado!</p>
            <p className="text-white/40 text-sm">Você já fez seu check-in desta semana.</p>
            {history[0] && (
              <p className="text-white/60 text-sm mt-2">
                Score da semana: <span className="font-black text-brand">{history[0].lapidados_score}pts</span>
              </p>
            )}
          </div>
        ) : (
          <button onClick={() => setStep(0)}
            className="w-full py-5 rounded-2xl text-white font-black text-lg mb-5 active:scale-95 transition-all"
            style={{ background:"linear-gradient(135deg,#E85D04,#C44D00)", boxShadow:"0 4px 24px rgba(232,93,4,.45)" }}>
            📋 Fazer Check-in — Semana {currentWeek}
          </button>
        )}

        {/* Histórico */}
        {history.length > 0 && (
          <div>
            <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest mb-3">Histórico</p>
            <div className="flex flex-col gap-2">
              {history.slice(0, 6).map((c) => {
                const t = getWeekTier(c.lapidados_score ?? 0);
                const sentDate = c.created_at
                  ? new Date(c.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" })
                  : null;
                return (
                  <div key={c.id}
                    className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-white/50 text-sm">Sem {c.week_number}/{c.year}</p>
                      {sentDate && <p className="text-white/25 text-[10px] mt-0.5">Respondido em {sentDate}</p>}
                    </div>
                    <span className="text-sm font-black" style={{ color:t.color }}>
                      {c.lapidados_score ?? 0}pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── RESULTADO ───────────────────────────────────────────── */
  if (step === 8) {
    const tier = getWeekTier(finalScore);
    return (
      <div style={bg} className="max-w-md mx-auto px-4 pt-8 pb-28 flex flex-col items-center">
        <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-2">Semana {currentWeek}/{currentYear}</p>
        <p className="text-xl font-black mb-1" style={{ color:tier.color }}>{tier.name}</p>
        <p className="text-white/20 text-[10px] mb-2">
          Enviado em {new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" })} às {new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
        </p>
        <ScoreRing score={animScore} color={tier.color} />
        <p className="text-white/40 text-sm mb-6">Check-in enviado com sucesso! 🎉</p>

        {/* Breakdown */}
        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-4">Detalhamento</p>
          {[
            { icon:"🥗", lbl:"Dieta",     pts:Math.round((form.diet_score/10)*25),     max:25 },
            { icon:"🏋️", lbl:"Treino",    pts:Math.round((form.training_score/10)*20), max:20 },
            { icon:"⚡", lbl:"Energia",   pts:Math.round((form.energy_level/10)*15),   max:15 },
            { icon:"🏃", lbl:"Cardio",    pts:form.cardio_score,                        max:10 },
            { icon:"🍽️", lbl:"Aderência", pts:Math.max(0,10-form.off_plan_meals*2),    max:10 },
            { icon:"😴", lbl:"Sono",      pts:Math.round((form.sleep_score/10)*10),    max:10 },
            { icon:"🫁", lbl:"Intestino", pts:form.bowel_score,                         max:5  },
            { icon:"😋", lbl:"Saciedade", pts:Math.round(((10-form.hunger_level)/10)*5),max:5 },
          ].map((item) => (
            <div key={item.lbl} className="flex items-center gap-3 mb-2.5">
              <span className="text-sm w-5 shrink-0">{item.icon}</span>
              <p className="text-white/40 text-xs w-16 shrink-0">{item.lbl}</p>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width:`${(item.pts/item.max)*100}%`, background:"#E85D04" }} />
              </div>
              <p className="text-white/70 text-xs font-bold w-10 text-right shrink-0">{item.pts}/{item.max}</p>
            </div>
          ))}
        </div>

        {/* Rank */}
        <div className="w-full border border-white/10 rounded-2xl p-4 mb-6 text-center"
          style={{ background:`${newRank.color}12` }}>
          <p className="text-white/30 text-[10px] mb-1">Rank atual</p>
          <p className="text-2xl font-black" style={{ color:newRank.color }}>{newRank.icon} {newRank.name}</p>
          <p className="text-white/40 text-sm mt-1">{newTotal}pts totais</p>
        </div>

        <button onClick={() => router.push("/inicio")}
          className="w-full py-4 rounded-2xl text-white font-black text-base active:scale-95 transition-all"
          style={{ background:"linear-gradient(135deg,#E85D04,#C44D00)" }}>
          Voltar ao início
        </button>
      </div>
    );
  }

  /* ── FORMULÁRIO STEPS ────────────────────────────────────── */
  const STEPS = 7;
  const pct   = Math.round((step / STEPS) * 100);

  return (
    <div style={{ ...bg, minHeight:"100vh" }} className="max-w-md mx-auto flex flex-col">
      {/* Barra de progresso */}
      <div className="px-4 pt-6 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => step === 0 ? setStep(-1) : setStep(step - 1)}
            className="text-white/30 hover:text-white/60 transition-colors p-1">
            <ChevronLeft size={20} />
          </button>
          <p className="text-white/25 text-[11px] font-medium">
            {step === 0 ? "Início" : `Passo ${step} de 6`}
          </p>
          <div className="w-8" />
        </div>
        <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width:`${pct}%` }} />
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* ── Step 0: Intro ─────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center pt-10">
            <div className="text-7xl mb-5">📋</div>
            <h1 className="text-2xl font-black text-white mb-2">Semana {currentWeek}</h1>
            <p className="text-white/40 text-sm mb-8">Avalie sua semana honestamente.<br/>Leva cerca de 3 minutos.</p>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black" style={{ color:rank.color }}>{rank.icon} {rank.name}</p>
                  <p className="text-white/30 text-xs">{totalPts}pts acumulados</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white/20">+{score}</p>
                  <p className="text-white/20 text-[10px]">pts estimados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Corpo ─────────────────────────────────── */}
        {step === 1 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">⚖️ Medidas</h2>
            <p className="text-white/30 text-sm mb-6">Registre seu peso e altura</p>
            <div className="grid grid-cols-2 gap-4">
              {(["weight","height"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-white/40 text-xs font-medium mb-2">
                    {k === "weight" ? "Peso (kg)" : "Altura (cm)"}
                  </label>
                  <input type="number" step="0.1"
                    placeholder={k === "weight" ? "82.5" : "174"}
                    value={form[k]}
                    onChange={(e) => upd(k, e.target.value)}
                    className="w-full h-14 px-4 rounded-2xl bg-white/8 border border-white/10 text-white text-xl font-black text-center focus:outline-none focus:border-brand focus:bg-white/12 transition-all" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Dieta ─────────────────────────────────── */}
        {step === 2 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">🥗 Alimentação</h2>
            <p className="text-white/30 text-sm mb-6">Como foi sua dieta esta semana?</p>
            <Slider label="Adesão à dieta" sub="Quanto você seguiu o plano?" emoji="🥗"
              value={form.diet_score} onChange={(v) => upd("diet_score", v)} />
            <div>
              <p className="text-base font-bold text-white mb-1">🍽️ Refeições fora do plano</p>
              <p className="text-white/30 text-xs mb-4">Quantas vezes comeu fora do planejado?</p>
              <div className="flex gap-2">
                {[0,1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => upd("off_plan_meals", n)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-black border transition-all",
                      form.off_plan_meals === n
                        ? "border-brand bg-brand/20 text-brand"
                        : "border-white/10 bg-white/5 text-white/40 hover:border-white/25"
                    )}>{n}</button>
                ))}
              </div>
              <p className="text-white/25 text-[10px] text-center mt-2">
                {form.off_plan_meals === 0 ? "🏆 Impecável!" : form.off_plan_meals <= 2 ? "😊 Bom controle" : "⚠️ Tente reduzir"}
              </p>
            </div>
          </div>
        )}

        {/* ── Step 3: Treino ────────────────────────────────── */}
        {step === 3 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">🏋️ Treino</h2>
            <p className="text-white/30 text-sm mb-6">Como foram seus treinos?</p>
            <Slider label="Desempenho no treino" sub="Qualidade e consistência" emoji="🏋️"
              value={form.training_score} onChange={(v) => upd("training_score", v)} />
            <div className="mt-2">
              <p className="text-base font-bold text-white mb-1">🏃 Cardio</p>
              <p className="text-white/30 text-xs mb-4">Como foi o cardio desta semana?</p>
              <div className="flex flex-col gap-2">
                {[
                  { label:"✅ Fiz todos os cardios",    pts:10 },
                  { label:"⚡ Fiz pelo menos a metade", pts:5  },
                  { label:"❌ Não consegui fazer",       pts:0  },
                  { label:"➖ Não tinha no plano",       pts:0  },
                ].map((opt) => (
                  <button key={opt.label} onClick={() => upd("cardio_score", opt.pts)}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl text-sm font-medium border text-left transition-all",
                      form.cardio_score === opt.pts
                        ? "border-brand bg-brand/15 text-white"
                        : "border-white/8 bg-white/4 text-white/40 hover:border-white/20 hover:text-white/70"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Energia & Fome ───────────────────────── */}
        {step === 4 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">⚡ Energia & Fome</h2>
            <p className="text-white/30 text-sm mb-6">Como seu corpo se sentiu?</p>
            <Slider label="Nível de energia" sub="Energia geral durante a semana" emoji="⚡"
              value={form.energy_level} onChange={(v) => upd("energy_level", v)} />
            <Slider label="Nível de fome" sub="1 = sem fome · 10 = fome constante" emoji="😋"
              value={form.hunger_level} onChange={(v) => upd("hunger_level", v)} />
          </div>
        )}

        {/* ── Step 5: Sono & Intestino ─────────────────────── */}
        {step === 5 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">😴 Sono & Intestino</h2>
            <p className="text-white/30 text-sm mb-6">Recuperação e funcionamento do organismo</p>
            <Slider label="Qualidade do sono" sub="Dormiu bem? Acordou disposto?" emoji="😴"
              value={form.sleep_score} onChange={(v) => upd("sleep_score", v)} />
            <div className="mt-2">
              <p className="text-base font-bold text-white mb-1">🫁 Intestino</p>
              <p className="text-white/30 text-xs mb-4">Como funcionou esta semana?</p>
              <div className="flex gap-2">
                {[
                  { label:"✅ Diário",     pts:5 },
                  { label:"⚡ Quase todo dia", pts:3 },
                  { label:"🚨 Irregular",  pts:0 },
                ].map((opt) => (
                  <button key={opt.label} onClick={() => upd("bowel_score", opt.pts)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-xs font-bold border text-center transition-all",
                      form.bowel_score === opt.pts
                        ? "border-brand bg-brand/20 text-brand"
                        : "border-white/8 bg-white/4 text-white/40 hover:border-white/20"
                    )}>{opt.label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Reflexões ────────────────────────────── */}
        {step === 6 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">💭 Reflexões</h2>
            <p className="text-white/30 text-sm mb-6">Compartilhe como foi sua semana</p>
            {[
              { k:"wins" as const,             label:"🏆 Vitória da semana",    ph:"Qual sua maior conquista?",              req:true  },
              { k:"main_difficulty" as const,  label:"🔴 Principal dificuldade", ph:"O que foi mais difícil?",               req:false },
              { k:"external_factors" as const, label:"🌍 Fatores externos",      ph:"Algo externo influenciou? (trabalho, estresse...)", req:false },
              { k:"improvements" as const,     label:"💡 O que melhorar",        ph:"O que faria diferente na próxima semana?", req:false },
              { k:"needs_help" as const,       label:"🙋 Precisa de ajuda?",     ph:"Tem alguma dúvida ou pedido especial?",  req:false },
            ].map((f) => (
              <div key={f.k} className="mb-4">
                <label className="block text-sm font-bold text-white/60 mb-2">
                  {f.label}{f.req && <span className="text-brand ml-1">*</span>}
                </label>
                <textarea value={form[f.k]} rows={2}
                  onChange={(e) => upd(f.k, e.target.value)}
                  placeholder={f.ph}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white text-sm placeholder:text-white/18 focus:outline-none focus:border-brand focus:bg-white/8 transition-all resize-none" />
              </div>
            ))}
          </div>
        )}

        {/* ── Step 7: Revisão ──────────────────────────────── */}
        {step === 7 && (
          <div className="pt-6">
            <h2 className="text-xl font-black text-white mb-1">✅ Revisão</h2>
            <p className="text-white/30 text-sm mb-5">Confira antes de enviar</p>
            <div className="bg-brand/12 border border-brand/25 rounded-2xl p-5 text-center mb-5">
              <p className="text-white/40 text-xs mb-1">Score estimado</p>
              <p className="text-6xl font-black text-brand">{score}</p>
              <p className="text-white/30 text-xs mt-1">/ 100 pontos</p>
              <p className="text-sm font-black mt-2" style={{ color:getWeekTier(score).color }}>
                {getWeekTier(score).name}
              </p>
            </div>
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["🥗 Dieta",    `${form.diet_score}/10`    ],
                  ["🏋️ Treino",   `${form.training_score}/10`],
                  ["⚡ Energia",  `${form.energy_level}/10`  ],
                  ["😴 Sono",     `${form.sleep_score}/10`   ],
                  ["😋 Fome",     `${form.hunger_level}/10`  ],
                  ["🍽️ Fora",     form.off_plan_meals        ],
                ].map(([lbl, val]) => (
                  <div key={String(lbl)} className="flex justify-between text-sm">
                    <span className="text-white/35">{lbl}</span>
                    <span className="text-white font-bold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-8 pt-3 shrink-0" style={{ borderTop:"1px solid rgba(255,255,255,.06)" }}>
        {step === 7 ? (
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-black text-base active:scale-95 transition-all disabled:opacity-40"
            style={{ background:"linear-gradient(135deg,#E85D04,#C44D00)", boxShadow:"0 4px 24px rgba(232,93,4,.4)" }}>
            {loading ? "Enviando..." : "🚀 Enviar Check-in"}
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 6 && !form.wins.trim()}
            className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-25"
            style={{ background:"linear-gradient(135deg,#E85D04,#C44D00)", boxShadow:"0 4px 24px rgba(232,93,4,.4)" }}>
            {step === 0 ? "Começar" : "Continuar"} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
