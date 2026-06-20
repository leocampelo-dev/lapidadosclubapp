"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── GAMIFICAÇÃO ────────────────────────────────────────────
const RANKS = [
  { id: "bruto",     min: 0,    max: 199,      icon: "🪨", name: "Bruto",     color: "#8B7355" },
  { id: "destravado",min: 200,  max: 499,      icon: "🧠", name: "Destravado",color: "#6366f1" },
  { id: "afiado",    min: 500,  max: 999,      icon: "⚡", name: "Afiado",    color: "#3b82f6" },
  { id: "imparavel", min: 1000, max: 1999,     icon: "🔥", name: "Imparável", color: "#f59e0b" },
  { id: "lapidado",  min: 2000, max: Infinity, icon: "👑", name: "Lapidado",  color: "#E85D04" },
];

const WEEK_TIERS = [
  { min: 90, name: "🔥 LAPIDADO!",   color: "#FF5C1A", bg: "rgba(255,92,26,.12)" },
  { min: 75, name: "💪 NO CAMINHO",  color: "#22c55e", bg: "rgba(34,197,94,.1)"  },
  { min: 55, name: "⚡ PROGREDINDO", color: "#3b82f6", bg: "rgba(59,130,246,.1)" },
  { min: 40, name: "🎯 FOCO TOTAL",  color: "#f59e0b", bg: "rgba(245,158,11,.1)" },
  { min: 0,  name: "🚨 ATENÇÃO",     color: "#ef4444", bg: "rgba(239,68,68,.1)"  },
];

function getRank(pts: number) {
  return [...RANKS].reverse().find((r) => pts >= r.min) ?? RANKS[0];
}
function getWeekTier(score: number) {
  return WEEK_TIERS.find((t) => score >= t.min) ?? WEEK_TIERS[4];
}
function scoreBreakdown(c: Record<string, number | boolean | null>) {
  return [
    { icon: "🥗", lbl: "Dieta",      pts: Math.round(((Number(c.diet_score)      || 0) / 10) * 25), max: 25 },
    { icon: "🏋️", lbl: "Treino",     pts: Math.round(((Number(c.training_score)  || 0) / 10) * 20), max: 20 },
    { icon: "⚡", lbl: "Energia",    pts: Math.round(((Number(c.energy_level)     || 0) / 10) * 15), max: 15 },
    { icon: "🏃", lbl: "Cardio",     pts: c.cardio_done ? 10 : 0,                                    max: 10 },
    { icon: "🍽️", lbl: "Aderência",  pts: Math.max(0, 10 - (Number(c.off_plan_meals) || 0) * 2),    max: 10 },
    { icon: "😴", lbl: "Sono",       pts: Math.round(((Number(c.sleep_score)      || 0) / 10) * 10), max: 10 },
    { icon: "🫁", lbl: "Intestino",  pts: Number(c.bowel_score) || 0,                                max: 5  },
    { icon: "😋", lbl: "Saciedade",  pts: Math.round(((10 - (Number(c.hunger_level) || 5)) / 10) * 5), max: 5 },
  ];
}

// ─── IA ─────────────────────────────────────────────────────
async function callGemini(key: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "gemini_error");
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGroq(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "groq_error");
  return data.choices?.[0]?.message?.content ?? "";
}

function buildPrompt(patName: string, plan: string, totalPts: number, ci: Record<string, unknown>, prevCi?: Record<string, unknown> | null) {
  const rank = getRank(totalPts);
  const prev = prevCi
    ? `\nCheck-in anterior:\n- Dieta: ${prevCi.diet_score}/10\n- Treino: ${prevCi.training_score}/10\n- Score: ${prevCi.lapidados_score}/100`
    : "";
  return `Você é um assistente de nutrição analisando check-in semanal.\n\nPaciente: ${patName}\nPlano: ${plan || "N/A"}\nRank: ${rank.name}\n\nCheck-in:\n- Dieta: ${ci.diet_score || 0}/10\n- Treino: ${ci.training_score || 0}/10\n- Sono: ${ci.sleep_score || 0}/10\n- Cardio: ${ci.cardio_score || ci.cardio_done ? "Sim" : "Não"}\n- Energia: ${ci.energy_level || 0}/10\n- Score: ${ci.lapidados_score || 0}/100\n- Vitória: "${ci.wins || ci.weekly_win || "N/A"}"\n- Dificuldade: "${ci.main_difficulty || ci.weekly_difficulty || "N/A"}"\n- Ajuda: "${ci.needs_help || "N/A"}"${prev}\n\nResponda APENAS em JSON válido sem markdown:\n{"summary":"2-3 frases encorajadoras","focus":"foco principal próxima semana","risk":"baixo|medio|evasao","insights":["insight1","insight2","insight3"],"reply":"mensagem WhatsApp 2-3 frases tom pessoal"}`;
}

// ─── TIPOS ──────────────────────────────────────────────────
interface Checkin {
  id: string;
  patient_id: string;
  week_number: number;
  year: number;
  lapidados_score?: number;
  diet_score?: number;
  training_score?: number;
  sleep_score?: number;
  energy_level?: number;
  cardio_done?: boolean;
  cardio_score?: number;
  off_plan_meals?: number;
  hunger_level?: number;
  bowel_score?: number;
  wins?: string;
  weekly_win?: string;
  main_difficulty?: string;
  weekly_difficulty?: string;
  needs_help?: string;
  created_at: string;
}

interface Patient { id: string; name: string; phone?: string; plan?: string; start_date?: string; }

interface EnrichedPatient {
  patient: Patient;
  checkins: Checkin[];
  weekCheckin: Checkin | null;
  totalPts: number;
  streak: number;
  evasionRisk: boolean;
  neverCheckedIn: boolean;
  hasThisWeek: boolean;
}

interface AiResult {
  summary: string;
  focus: string;
  risk: string;
  insights: string[];
  reply: string;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function CheckinsHub({
  enriched, currentWeek, currentYear,
  totalPatients, responderam, pendentes, avgScore,
  geminiKey, groqKey,
}: {
  enriched: EnrichedPatient[];
  currentWeek: number; currentYear: number;
  totalPatients: number; responderam: number;
  pendentes: number; avgScore: number;
  geminiKey: string; groqKey: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const [aiResults, setAiResults] = useState<Record<string, AiResult>>({});
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());
  const [detailModal, setDetailModal] = useState<EnrichedPatient | null>(null);

  const filtered = useMemo(() =>
    enriched.filter((e) =>
      e.patient.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      // Sem check-in primeiro, depois por score desc
      if (a.hasThisWeek !== b.hasThisWeek) return a.hasThisWeek ? 1 : -1;
      return (b.weekCheckin?.lapidados_score ?? 0) - (a.weekCheckin?.lapidados_score ?? 0);
    }),
    [enriched, search]
  );

  function toggleCard(id: string) {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generateAI(e: EnrichedPatient) {
    const pid = e.patient.id;
    if (!e.weekCheckin) return;
    if (!geminiKey && !groqKey) {
      alert("Configure sua chave Gemini ou Groq em Configurações.");
      return;
    }
    setAiLoading((prev) => new Set(prev).add(pid));
    try {
      const prevCi = e.checkins[1] ?? null;
      const prompt = buildPrompt(e.patient.name, e.patient.plan ?? "", e.totalPts, e.weekCheckin as Record<string, unknown>, prevCi as Record<string, unknown> | null);
      let raw = "";
      if (groqKey) raw = await callGroq(groqKey, prompt);
      else raw = await callGemini(geminiKey, prompt);
      const clean = raw.replace(/```json|```/g, "").trim();
      const result: AiResult = JSON.parse(clean);
      setAiResults((prev) => ({ ...prev, [pid]: result }));
    } catch (err) {
      console.error("Erro IA:", err);
      alert("Erro ao gerar análise. Verifique sua chave de IA em Configurações.");
    } finally {
      setAiLoading((prev) => { const n = new Set(prev); n.delete(pid); return n; });
    }
  }

  function whatsappUrl(phone: string, name: string, weekNum: number, reply?: string) {
    const msg = reply ?? `Oi ${name.split(" ")[0]}! 💪 Vi seus resultados da semana ${weekNum} e quero conversar sobre eles!`;
    return `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink flex items-center gap-2">
            📋 Check-in Inteligente
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Semana {currentWeek} · {currentYear} · {responderam > 0 ? Math.round((responderam / totalPatients) * 100) : 0}% respondidos · Score médio: {avgScore}pts
          </p>
        </div>
        <button onClick={() => router.refresh()} className="flex items-center gap-1.5 h-8 px-3 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle transition-colors">
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total de alunos", value: totalPatients, color: "text-brand", bg: "bg-brand/5", border: "border-brand/20" },
          { label: "Responderam ✅", value: responderam, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
          { label: "Pendentes ⏳", value: pendentes, color: "text-red-500", bg: "bg-red-50", border: "border-red-200" },
          { label: "Score médio 📊", value: `${avgScore}pts`, color: "text-brand", bg: "bg-brand/5", border: "border-brand/20" },
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

      {/* Cards por paciente */}
      <div className="flex flex-col gap-3">
        {filtered.map((e) => {
          const { patient, weekCheckin, totalPts, streak, evasionRisk, neverCheckedIn, hasThisWeek } = e;
          const rank = getRank(totalPts);
          const tier = weekCheckin ? getWeekTier(weekCheckin.lapidados_score ?? 0) : null;
          const isOpen = openCards.has(patient.id);
          const ai = aiResults[patient.id];
          const isLoadingAI = aiLoading.has(patient.id);
          const breakdown = weekCheckin ? scoreBreakdown(weekCheckin as Record<string, number | boolean | null>) : [];

          return (
            <div key={patient.id} className={cn(
              "bg-white border rounded-md shadow-card overflow-hidden transition-colors",
              !hasThisWeek ? "border-surface-muted" : "border-surface-muted"
            )}>
              {/* Header do card */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand font-bold text-sm">{patient.name.charAt(0)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink">{patient.name}</p>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${rank.color}18`, color: rank.color }}>
                      {rank.icon} {rank.name}
                    </span>
                    <span className="text-[10px] text-ink-muted font-medium">{totalPts}pts</span>
                    {streak > 1 && (
                      <span className="text-[10px] font-bold text-amber-500">🔥 {streak}sem</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {!hasThisWeek && !neverCheckedIn && (
                      <span className="text-[10px] text-ink-muted">📋 Sem check-in</span>
                    )}
                    {neverCheckedIn && (
                      <span className="text-[10px] text-ink-muted">📋 Nunca fez check-in</span>
                    )}
                    {evasionRisk && (
                      <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">• Risco evasão</span>
                    )}
                    {weekCheckin && tier && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: tier.bg, color: tier.color }}>
                        {tier.name}
                      </span>
                    )}
                    {weekCheckin && (
                      <span className="text-[10px] text-ink-muted">
                        Score: {weekCheckin.lapidados_score ?? 0}/100 · Sem {weekCheckin.week_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Score semanal + ações */}
                <div className="flex items-center gap-2 shrink-0">
                  {weekCheckin && (
                    <span className="text-lg font-bold" style={{ color: tier?.color ?? "#E85D04" }}>
                      {weekCheckin.lapidados_score ?? 0}pts
                    </span>
                  )}
                  {weekCheckin && (
                    <button
                      onClick={() => setDetailModal(e)}
                      className="h-7 px-2.5 text-xs border border-surface-muted rounded-sm text-ink hover:bg-surface-subtle transition-colors"
                    >
                      Ver evolução
                    </button>
                  )}
                  {patient.phone && (
                    <a
                      href={whatsappUrl(patient.phone, patient.name, currentWeek, ai?.reply)}
                      target="_blank" rel="noreferrer"
                      className="h-7 px-2.5 text-xs border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-sm transition-colors flex items-center gap-1"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  {weekCheckin && (
                    <button
                      onClick={() => toggleCard(patient.id)}
                      className="p-1 text-ink-muted hover:text-ink"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expansão: breakdown + IA */}
              {isOpen && weekCheckin && (
                <div className="border-t border-surface-muted px-4 pb-4 pt-3">
                  {/* Scores breakdown */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {breakdown.map((item) => (
                      <div key={item.lbl} className="text-center">
                        <p className="text-[10px] text-ink-muted mb-1">{item.icon} {item.lbl}</p>
                        <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden mb-1">
                          <div className="h-full bg-brand rounded-full"
                            style={{ width: `${Math.round((item.pts / item.max) * 100)}%` }} />
                        </div>
                        <p className="text-[10px] font-semibold text-ink">{item.pts}/{item.max}</p>
                      </div>
                    ))}
                  </div>

                  {/* Vitória, dificuldade, ajuda */}
                  <div className="flex flex-col gap-2 mb-4">
                    {(weekCheckin.wins || weekCheckin.weekly_win) && (
                      <div className="bg-green-50 border border-green-100 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-green-700 mb-0.5">🏆 VITÓRIA</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.wins || weekCheckin.weekly_win}</p>
                      </div>
                    )}
                    {(weekCheckin.main_difficulty || weekCheckin.weekly_difficulty) && (
                      <div className="bg-red-50 border border-red-100 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-red-600 mb-0.5">🔴 DIFICULDADE</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.main_difficulty || weekCheckin.weekly_difficulty}</p>
                      </div>
                    )}
                    {weekCheckin.needs_help && weekCheckin.needs_help.toLowerCase() !== "não" && weekCheckin.needs_help.toLowerCase() !== "nao" && (
                      <div className="bg-brand/5 border border-brand/20 rounded-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-brand mb-0.5">🙋 PEDIU AJUDA</p>
                        <p className="text-xs text-ink-secondary">{weekCheckin.needs_help}</p>
                      </div>
                    )}
                  </div>

                  {/* Análise IA */}
                  {!ai ? (
                    <button
                      onClick={() => generateAI(e)}
                      disabled={isLoadingAI || (!geminiKey && !groqKey)}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs bg-surface-subtle hover:bg-surface-muted border border-surface-muted rounded-sm text-ink transition-colors disabled:opacity-50"
                    >
                      <Sparkles size={13} className="text-brand" />
                      {isLoadingAI ? "Gerando análise..." : "🤖 Análise · Clique para gerar"}
                      {!geminiKey && !groqKey && " (configure chave em Configurações)"}
                    </button>
                  ) : (
                    <div className="bg-surface-subtle border border-surface-muted rounded-sm p-3">
                      <p className="text-[10px] font-bold text-brand mb-2 flex items-center gap-1">
                        <Sparkles size={11} /> ANÁLISE IA
                      </p>
                      <p className="text-xs text-ink-secondary mb-2">{ai.summary}</p>
                      <p className="text-xs font-medium text-ink mb-2">🎯 Foco: {ai.focus}</p>
                      {ai.insights.map((ins, i) => (
                        <p key={i} className="text-xs text-ink-secondary">• {ins}</p>
                      ))}
                      {ai.reply && (
                        <div className="mt-3 pt-3 border-t border-surface-muted">
                          <p className="text-[10px] font-bold text-green-700 mb-1">💬 Mensagem sugerida para WhatsApp:</p>
                          <p className="text-xs text-ink-secondary italic">&ldquo;{ai.reply}&rdquo;</p>
                          {patient.phone && (
                            <a href={whatsappUrl(patient.phone, patient.name, currentWeek, ai.reply)}
                              target="_blank" rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 h-7 px-3 text-xs bg-green-600 text-white rounded-sm hover:bg-green-700 transition-colors">
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

      {/* Modal de evolução — últimas 5 semanas */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 py-8">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg flex flex-col" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-ink">{detailModal.patient.name}</h3>
                <p className="text-xs text-ink-muted">
                  {getRank(detailModal.totalPts).icon} {getRank(detailModal.totalPts).name} · {detailModal.totalPts}pts totais
                </p>
              </div>
              <button onClick={() => setDetailModal(null)} className="text-ink-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Rank progress bar */}
              <div className="mb-5">
                {(() => {
                  const rank = getRank(detailModal.totalPts);
                  const nextRank = RANKS.find((r) => r.min > detailModal.totalPts);
                  const pct = nextRank
                    ? Math.round(((detailModal.totalPts - rank.min) / (nextRank.min - rank.min)) * 100)
                    : 100;
                  return (
                    <>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: rank.color }}>{rank.icon} {rank.name}</span>
                        {nextRank && <span className="text-ink-muted">→ {nextRank.icon} {nextRank.name}</span>}
                      </div>
                      <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: rank.color }} />
                      </div>
                      <p className="text-[10px] text-ink-muted mt-1">
                        {nextRank ? `${nextRank.min - detailModal.totalPts}pts para ${nextRank.name}` : "Rank máximo!"}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Timeline das últimas semanas */}
              <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
                Timeline de evolução ({Math.min(detailModal.checkins.length, 5)} semanas)
              </h4>
              <div className="flex flex-col gap-3">
                {detailModal.checkins.slice(0, 5).map((c) => {
                  const t = getWeekTier(c.lapidados_score ?? 0);
                  const bd = scoreBreakdown(c as Record<string, number | boolean | null>);
                  return (
                    <div key={c.id} className="border border-surface-muted rounded-md overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2.5 bg-surface-subtle">
                        <p className="text-xs font-medium text-ink">Semana {c.week_number}/{c.year}</p>
                        <span className="text-xs font-bold" style={{ color: t.color }}>{c.lapidados_score ?? 0}pts · {t.name}</span>
                      </div>
                      <div className="px-3 py-2 grid grid-cols-4 gap-2">
                        {bd.map((item) => (
                          <div key={item.lbl} className="text-center">
                            <p className="text-[9px] text-ink-muted">{item.icon}</p>
                            <div className="h-1 bg-surface-subtle rounded-full overflow-hidden mt-0.5 mb-0.5">
                              <div className="h-full bg-brand rounded-full" style={{ width: `${Math.round((item.pts / item.max) * 100)}%` }} />
                            </div>
                            <p className="text-[9px] font-medium text-ink">{item.pts}</p>
                          </div>
                        ))}
                      </div>
                      {(c.wins || c.main_difficulty) && (
                        <div className="px-3 pb-2 flex gap-2">
                          {c.wins && (
                            <p className="text-[10px] text-green-700 bg-green-50 rounded-sm px-2 py-1 flex-1">🏆 {c.wins}</p>
                          )}
                          {c.main_difficulty && (
                            <p className="text-[10px] text-red-600 bg-red-50 rounded-sm px-2 py-1 flex-1">🔴 {c.main_difficulty}</p>
                          )}
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
