"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── GAMIFICAÇÃO ─────────────────────────────────────────── */
const RANKS = [
  { name:"BRUTO",     icon:"🪨", min:0,    max:199,      color:"#9ca3af", glow:"rgba(156,163,175,.25)" },
  { name:"POLIDO",    icon:"🧠", min:200,  max:499,      color:"#60a5fa", glow:"rgba(96,165,250,.25)"  },
  { name:"AFIADO",    icon:"⚡", min:500,  max:999,      color:"#a78bfa", glow:"rgba(167,139,250,.25)" },
  { name:"IMPARÁVEL", icon:"🔥", min:1000, max:1999,     color:"#fb923c", glow:"rgba(251,146,60,.25)"  },
  { name:"LAPIDADO",  icon:"👑", min:2000, max:Infinity, color:"#fcd34d", glow:"rgba(252,211,77,.25)"  },
];
const WEEK_TIERS = [
  { min:90, name:"✅ Semana Impecável!",   color:"#FF5C1A", bg:"rgba(255,92,26,.1)"  },
  { min:75, name:"💪 Semana Muito Sólida", color:"#22c55e", bg:"rgba(34,197,94,.1)"  },
  { min:55, name:"⚡ Semana em Progresso", color:"#3b82f6", bg:"rgba(59,130,246,.1)" },
  { min:40, name:"🎯 Semana Desafiadora",  color:"#f59e0b", bg:"rgba(245,158,11,.1)" },
  { min:0,  name:"🚨 Semana Difícil",      color:"#ef4444", bg:"rgba(239,68,68,.1)"  },
];
const getRank     = (p: number) => [...RANKS].reverse().find((r) => p >= r.min) ?? RANKS[0];
const getWeekTier = (s: number) => WEEK_TIERS.find((t) => s >= t.min) ?? WEEK_TIERS[4];

function scoreBreakdown(c: Record<string, unknown>) {
  const diet     = Math.round(((Number(c.diet_score)     || 0) / 10) * 25);
  const train    = Math.round(((Number(c.training_score) || 0) / 10) * 20);
  const energy   = Math.round(((Number(c.energy_level)   || 0) / 10) * 15);
  const cardio   = Number(c.cardio_score) || 0;
  const offPlan  = Math.max(0, 10 - (Number(c.off_plan_meals) || 0) * 2);
  const hunger   = Math.round(((10 - (Number(c.hunger_level)  || 5)) / 10) * 5);
  const sleep    = Math.round(((Number(c.sleep_score)    || 0) / 10) * 10);
  const bowel    = Number(c.bowel_score) || 0;
  return [
    { icon:"🥗", lbl:"Dieta",     pts:diet,    max:25 },
    { icon:"🏋️", lbl:"Treino",    pts:train,   max:20 },
    { icon:"⚡", lbl:"Energia",   pts:energy,  max:15 },
    { icon:"🏃", lbl:"Cardio",    pts:cardio,  max:10 },
    { icon:"🍽️", lbl:"Aderência", pts:offPlan, max:10 },
    { icon:"😴", lbl:"Sono",      pts:sleep,   max:10 },
    { icon:"🫁", lbl:"Intestino", pts:bowel,   max:5  },
    { icon:"😋", lbl:"Saciedade", pts:hunger,  max:5  },
  ];
}

/* ─── IA ──────────────────────────────────────────────────── */
async function callAI(groqKey: string, geminiKey: string, prompt: string): Promise<string> {
  if (groqKey) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model:"llama3-8b-8192", messages:[{ role:"user", content:prompt }], temperature:0.7, max_tokens:600 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message);
    return data.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ contents:[{ parts:[{ text:prompt }] }], generationConfig:{ temperature:0.6, maxOutputTokens:600 } }) }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function buildPrompt(patName: string, plan: string, totalPts: number, ci: Record<string, unknown>, prev: Record<string, unknown> | null) {
  const rank = getRank(totalPts);
  const prevTxt = prev
    ? `\nSemana anterior: Dieta ${prev.diet_score}/10, Treino ${prev.training_score}/10, Score ${prev.lapidados_score}/100`
    : "";
  return `Você é assistente de nutrição esportiva do Lapidados Club. Analise o check-in e responda APENAS em JSON válido sem markdown.\n\nPaciente: ${patName} | Plano: ${plan||"N/A"} | Rank: ${rank.name} | Pts totais: ${totalPts}\n\nCheck-in:\n- Dieta: ${ci.diet_score||0}/10\n- Treino: ${ci.training_score||0}/10\n- Cardio: ${ci.cardio_score||0}pts\n- Sono: ${ci.sleep_score||0}/10\n- Energia: ${ci.energy_level||0}/10\n- Fome: ${ci.hunger_level||0}/10\n- Refeições fora: ${ci.off_plan_meals||0}\n- Score: ${ci.lapidados_score||0}/100\n- Vitória: "${ci.wins||"N/A"}"\n- Dificuldade: "${ci.main_difficulty||"N/A"}"\n- Precisa de ajuda: "${ci.needs_help||"N/A"}"${prevTxt}\n\nGere:\n{"summary":"2-3 frases encorajadoras e específicas","focus":"foco principal para próxima semana (max 12 palavras)","risk":"baixo|medio|evasao","insights":["insight1","insight2","insight3"],"reply":"mensagem WhatsApp curta 2-3 frases tom pessoal e motivador"}`;
}

/* ─── TIPOS ───────────────────────────────────────────────── */
interface Checkin {
  id: string; patient_id: string; week_number: number; year: number;
  lapidados_score?: number; diet_score?: number; training_score?: number;
  sleep_score?: number; energy_level?: number; cardio_score?: number;
  off_plan_meals?: number; hunger_level?: number; bowel_score?: number;
  wins?: string; main_difficulty?: string; external_factors?: string;
  improvements?: string; needs_help?: string;
  ai_summary?: string; ai_focus?: string; ai_risk?: string;
  ai_insights?: string[]; ai_reply?: string;
  created_at: string;
}
interface Patient { id: string; name: string; phone?: string; plan?: string; }
interface EnrichedPatient {
  patient: Patient; checkins: Checkin[]; weekCheckin: Checkin | null;
  totalPts: number; streak: number; evasionRisk: boolean;
  neverCheckedIn: boolean; hasThisWeek: boolean;
}
interface AiResult { summary:string; focus:string; risk:string; insights:string[]; reply:string; }

/* ─── COMPONENTE PRINCIPAL ────────────────────────────────── */
export default function CheckinsHub({
  enriched, currentWeek, currentYear,
  totalPatients, responderam, pendentes, avgScore,
  geminiKey, groqKey,
}: {
  enriched: EnrichedPatient[];
  currentWeek: number; currentYear: number;
  totalPatients: number; responderam: number; pendentes: number; avgScore: number;
  geminiKey: string; groqKey: string;
}) {
  const supabase = createClient();
  const router   = useRouter();

  const [search, setSearch]           = useState("");
  const [openCards, setOpenCards]     = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading]     = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<EnrichedPatient | null>(null);
  // Cache local de análises IA (para não perder ao reabrir o card)
  const [aiCache, setAiCache]         = useState<Record<string, AiResult>>({});

  const filtered = useMemo(() =>
    enriched
      .filter((e) => e.patient.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.hasThisWeek !== b.hasThisWeek) return a.hasThisWeek ? 1 : -1;
        return (b.weekCheckin?.lapidados_score ?? 0) - (a.weekCheckin?.lapidados_score ?? 0);
      }),
    [enriched, search]
  );

  function toggleCard(id: string) {
    setOpenCards((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function generateAI(e: EnrichedPatient) {
    const pid = e.patient.id;
    const ci  = e.weekCheckin;
    if (!ci) return;
    if (!geminiKey && !groqKey) { alert("Configure sua chave Gemini ou Groq em Configurações → Perfil."); return; }

    // Se já tem análise salva no banco, usa ela
    if (ci.ai_summary) {
      setAiCache((prev) => ({ ...prev, [pid]: {
        summary:  ci.ai_summary!,
        focus:    ci.ai_focus   ?? "",
        risk:     ci.ai_risk    ?? "baixo",
        insights: ci.ai_insights ?? [],
        reply:    ci.ai_reply   ?? "",
      }}));
      return;
    }

    setAiLoading((prev) => new Set(prev).add(pid));
    try {
      const prev = e.checkins[1] ?? null;
      const prompt = buildPrompt(e.patient.name, e.patient.plan ?? "", e.totalPts, ci as Record<string, unknown>, prev as Record<string, unknown> | null);
      const raw    = await callAI(groqKey, geminiKey, prompt);
      const clean  = raw.replace(/```json|```/g, "").trim();
      const result: AiResult = JSON.parse(clean);

      // Salva permanentemente no banco nas colunas ai_*
      await supabase.from("checkins").update({
        ai_summary:  result.summary,
        ai_focus:    result.focus,
        ai_risk:     result.risk,
        ai_insights: result.insights,
        ai_reply:    result.reply,
      }).eq("id", ci.id);

      setAiCache((prev) => ({ ...prev, [pid]: result }));
    } catch (err) {
      console.error("Erro IA:", err);
      alert("Erro ao gerar análise. Verifique sua chave de IA em Configurações.");
    } finally {
      setAiLoading((prev) => { const n = new Set(prev); n.delete(pid); return n; });
    }
  }

  function whatsappUrl(phone: string, reply?: string) {
    const msg = reply ?? `Oi! 💪 Vi seu check-in da semana ${currentWeek} e quero conversar!`;
    return `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink flex items-center gap-2">📋 Check-in Inteligente</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Semana {currentWeek} · {currentYear} ·{" "}
            <span className={responderam === 0 ? "text-red-500" : "text-green-600"}>
              {totalPatients > 0 ? Math.round((responderam / totalPatients) * 100) : 0}% respondidos
            </span>
            {avgScore > 0 && ` · Score médio: ${avgScore}pts`}
          </p>
        </div>
        <button onClick={() => router.refresh()}
          className="flex items-center gap-1.5 h-8 px-3 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label:"Total de alunos", value:totalPatients, color:"text-brand",   border:"border-brand/20",   bg:"bg-brand/5"  },
          { label:"Responderam ✅",  value:responderam,   color:"text-green-600", border:"border-green-200", bg:"bg-green-50" },
          { label:"Pendentes ⏳",    value:pendentes,     color:"text-red-500",  border:"border-red-200",    bg:"bg-red-50"   },
          { label:"Score médio 📊",  value:avgScore > 0 ? `${avgScore}pts` : "—", color:"text-brand", border:"border-brand/20", bg:"bg-brand/5" },
        ].map((s) => (
          <div key={s.label} className={cn("border rounded-md p-4 shadow-card", s.bg, s.border)}>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-ink-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aluno..."
          className="w-full h-9 pl-8 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>

      {/* Lista de pacientes */}
      <div className="flex flex-col gap-3">
        {filtered.map((e) => {
          const { patient, weekCheckin, totalPts, streak, evasionRisk, neverCheckedIn, hasThisWeek } = e;
          const rank      = getRank(totalPts);
          const tier      = weekCheckin ? getWeekTier(weekCheckin.lapidados_score ?? 0) : null;
          const isOpen    = openCards.has(patient.id);
          const isLoading = aiLoading.has(patient.id);
          const breakdown = weekCheckin ? scoreBreakdown(weekCheckin as Record<string, unknown>) : [];
          // Usa cache local ou análise salva no banco
          const ai: AiResult | null = aiCache[patient.id] ?? (weekCheckin?.ai_summary ? {
            summary:  weekCheckin.ai_summary,
            focus:    weekCheckin.ai_focus    ?? "",
            risk:     weekCheckin.ai_risk     ?? "baixo",
            insights: weekCheckin.ai_insights ?? [],
            reply:    weekCheckin.ai_reply    ?? "",
          } : null);

          return (
            <div key={patient.id} className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                  style={{ background: rank.color }}>
                  {patient.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink">{patient.name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:`${rank.color}18`, color:rank.color }}>
                      {rank.icon} {rank.name}
                    </span>
                    <span className="text-[10px] text-ink-muted">{totalPts}pts</span>
                    {streak > 1 && <span className="text-[10px] font-bold text-amber-500">🔥 {streak}sem</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {!hasThisWeek && <span className="text-[10px] text-ink-muted">📋 {neverCheckedIn ? "Nunca fez check-in" : "Sem check-in esta semana"}</span>}
                    {evasionRisk && <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">• Risco evasão</span>}
                    {weekCheckin && tier && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background:tier.bg, color:tier.color }}>{tier.name}</span>
                    )}
                    {weekCheckin && (
                      <span className="text-[10px] text-ink-muted">Score: {weekCheckin.lapidados_score ?? 0}/100 · Sem {weekCheckin.week_number}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {weekCheckin && (
                    <span className="text-lg font-bold" style={{ color:tier?.color ?? "#E85D04" }}>
                      {weekCheckin.lapidados_score ?? 0}pts
                    </span>
                  )}
                  {weekCheckin && (
                    <button onClick={() => setDetailModal(e)}
                      className="h-7 px-2 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle transition-colors">
                      Ver evolução
                    </button>
                  )}
                  {patient.phone && (
                    <a href={whatsappUrl(patient.phone, ai?.reply)}
                      target="_blank" rel="noreferrer"
                      className="h-7 px-2 text-xs border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-sm transition-colors flex items-center gap-1">
                      💬 WhatsApp
                    </a>
                  )}
                  {weekCheckin && (
                    <button onClick={() => toggleCard(patient.id)} className="p-1 text-ink-muted hover:text-ink">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expansão */}
              {isOpen && weekCheckin && (
                <div className="border-t border-surface-muted px-4 pb-5 pt-4">
                  {/* Breakdown de pontos */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {breakdown.map((item) => (
                      <div key={item.lbl} className="text-center bg-surface-subtle rounded-sm p-2">
                        <p className="text-[10px] text-ink-muted mb-1">{item.icon} {item.lbl}</p>
                        <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-brand rounded-full"
                            style={{ width:`${Math.round((item.pts / item.max) * 100)}%` }} />
                        </div>
                        <p className="text-xs font-bold text-ink">{item.pts}<span className="text-ink-muted font-normal">/{item.max}</span></p>
                      </div>
                    ))}
                  </div>

                  {/* Reflexões */}
                  <div className="flex flex-col gap-2 mb-4">
                    {weekCheckin.wins && (
                      <div className="bg-green-50 border border-green-100 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-green-700 mb-0.5">🏆 VITÓRIA</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.wins}</p>
                      </div>
                    )}
                    {weekCheckin.main_difficulty && (
                      <div className="bg-red-50 border border-red-100 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-red-600 mb-0.5">🔴 DIFICULDADE</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.main_difficulty}</p>
                      </div>
                    )}
                    {weekCheckin.needs_help && weekCheckin.needs_help.trim().toLowerCase() !== "não" && weekCheckin.needs_help.trim() !== "" && (
                      <div className="bg-brand/5 border border-brand/20 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-brand mb-0.5">🙋 PEDIU AJUDA</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.needs_help}</p>
                      </div>
                    )}
                    {weekCheckin.improvements && (
                      <div className="bg-surface-subtle border border-surface-muted rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-ink-muted mb-0.5">💡 MELHORIAS</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.improvements}</p>
                      </div>
                    )}
                  </div>

                  {/* Análise IA */}
                  {!ai ? (
                    <button onClick={() => generateAI(e)} disabled={isLoading || (!geminiKey && !groqKey)}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs bg-surface-subtle hover:bg-surface-muted border border-surface-muted rounded-sm text-ink transition-colors disabled:opacity-50 w-full justify-center">
                      <Sparkles size={13} className="text-brand" />
                      {isLoading ? "Gerando análise..." : !geminiKey && !groqKey ? "🤖 Configure chave de IA em Configurações" : "🤖 Análise IA · Clique para gerar"}
                    </button>
                  ) : (
                    <div className="bg-blue-50 border border-blue-100 rounded-sm p-3">
                      <p className="text-[10px] font-bold text-blue-700 mb-2 flex items-center gap-1">
                        <Sparkles size={11} /> ANÁLISE IA{ai === aiCache[patient.id] ? "" : " · salva"}
                      </p>
                      <p className="text-xs text-ink-secondary mb-2">{ai.summary}</p>
                      {ai.focus && <p className="text-xs font-semibold text-ink mb-2">🎯 Foco: {ai.focus}</p>}
                      <div className="flex flex-col gap-1 mb-3">
                        {ai.insights.map((ins, i) => (
                          <p key={i} className="text-xs text-ink-secondary">• {ins}</p>
                        ))}
                      </div>
                      {ai.reply && (
                        <div className="pt-2 border-t border-blue-100">
                          <p className="text-[10px] font-bold text-green-700 mb-1">💬 Mensagem sugerida:</p>
                          <p className="text-xs text-ink-secondary italic mb-2">&ldquo;{ai.reply}&rdquo;</p>
                          {patient.phone && (
                            <a href={whatsappUrl(patient.phone, ai.reply)} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 h-7 px-3 text-xs bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors">
                              Enviar via WhatsApp
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-white border border-surface-muted rounded-md p-8 text-center shadow-card">
            <p className="text-ink-muted text-sm">Nenhum aluno encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal evolução */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight:"calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-ink">{detailModal.patient.name}</h3>
                <p className="text-xs text-ink-muted">
                  {getRank(detailModal.totalPts).icon} {getRank(detailModal.totalPts).name} · {detailModal.totalPts}pts · {detailModal.streak > 1 ? `🔥 ${detailModal.streak} semanas seguidas` : ""}
                </p>
              </div>
              <button onClick={() => setDetailModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Barra de progresso de rank */}
              {(() => {
                const rank = getRank(detailModal.totalPts);
                const nextRank = [...RANKS].find((r) => r.min > detailModal.totalPts);
                const pct = nextRank
                  ? Math.round(((detailModal.totalPts - rank.min) / (nextRank.min - rank.min)) * 100)
                  : 100;
                return (
                  <div className="mb-5 bg-surface-subtle rounded-md p-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="font-bold" style={{ color:rank.color }}>{rank.icon} {rank.name}</span>
                      {nextRank && <span className="text-ink-muted">→ {nextRank.icon} {nextRank.name}</span>}
                    </div>
                    <div className="h-2 bg-surface-muted rounded-full overflow-hidden mb-1">
                      <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:rank.color }} />
                    </div>
                    <p className="text-[10px] text-ink-muted">
                      {nextRank ? `${nextRank.min - detailModal.totalPts}pts para ${nextRank.name}` : "Rank máximo! 👑"}
                    </p>
                  </div>
                );
              })()}

              {/* Timeline */}
              <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
                Últimas {Math.min(detailModal.checkins.length, 5)} semanas
              </h4>
              <div className="flex flex-col gap-3">
                {detailModal.checkins.slice(0, 5).map((c) => {
                  const t  = getWeekTier(c.lapidados_score ?? 0);
                  const bd = scoreBreakdown(c as Record<string, unknown>);
                  return (
                    <div key={c.id} className="border border-surface-muted rounded-md overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-subtle">
                        <p className="text-xs font-semibold text-ink">Semana {c.week_number}/{c.year}</p>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background:t.bg, color:t.color }}>
                          {c.lapidados_score ?? 0}pts · {t.name}
                        </span>
                      </div>
                      <div className="px-3 py-2 grid grid-cols-4 gap-1.5">
                        {bd.map((item) => (
                          <div key={item.lbl} className="text-center">
                            <p className="text-[9px] text-ink-muted">{item.icon}</p>
                            <div className="h-1 bg-surface-subtle rounded-full overflow-hidden mt-0.5 mb-0.5">
                              <div className="h-full bg-brand rounded-full" style={{ width:`${Math.round((item.pts/item.max)*100)}%` }} />
                            </div>
                            <p className="text-[9px] font-semibold text-ink">{item.pts}</p>
                          </div>
                        ))}
                      </div>
                      {(c.wins || c.main_difficulty) && (
                        <div className="px-3 pb-2 flex gap-2">
                          {c.wins && <p className="text-[10px] text-green-700 bg-green-50 rounded-sm px-2 py-1 flex-1">🏆 {c.wins}</p>}
                          {c.main_difficulty && <p className="text-[10px] text-red-600 bg-red-50 rounded-sm px-2 py-1 flex-1">🔴 {c.main_difficulty}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
