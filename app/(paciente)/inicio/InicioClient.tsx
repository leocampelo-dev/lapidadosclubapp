"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Utensils, Dumbbell, ChevronRight } from "lucide-react";

const RANKS = [
  { name:"BRUTO",     icon:"🪨", min:0,    next:200,  color:"#9ca3af", glow:"rgba(156,163,175,.3)" },
  { name:"POLIDO",    icon:"🧠", min:200,  next:500,  color:"#60a5fa", glow:"rgba(96,165,250,.3)"  },
  { name:"AFIADO",    icon:"⚡", min:500,  next:1000, color:"#a78bfa", glow:"rgba(167,139,250,.3)" },
  { name:"IMPARÁVEL", icon:"🔥", min:1000, next:2000, color:"#fb923c", glow:"rgba(251,146,60,.3)"  },
  { name:"LAPIDADO",  icon:"👑", min:2000, next:3000, color:"#fcd34d", glow:"rgba(252,211,77,.3)"  },
];
const WEEK_TIERS = [
  { min:90, name:"✅ Impecável",  color:"#FF5C1A" },
  { min:75, name:"💪 Sólida",    color:"#22c55e" },
  { min:55, name:"⚡ Progresso", color:"#3b82f6" },
  { min:40, name:"🎯 Desafio",   color:"#f59e0b" },
  { min:0,  name:"🚨 Difícil",   color:"#ef4444" },
];
const getRank     = (p: number) => [...RANKS].reverse().find((r) => p >= r.min) ?? RANKS[0];
const getWeekTier = (s: number) => WEEK_TIERS.find((t) => s >= t.min) ?? WEEK_TIERS[4];

interface Achievement {
  id: string; category: string; name: string; icon: string;
  check: (count: number, streak: number, avg: number) => boolean;
}
const ACHIEVEMENTS: Achievement[] = [
  { id:"first",  category:"CHECK-IN",     name:"Primeira Semana",    icon:"🌱", check:(c)      => c >= 1  },
  { id:"4w",     category:"CHECK-IN",     name:"4 Sem. Seguidas",    icon:"💧", check:(_,s)    => s >= 4  },
  { id:"8w",     category:"CHECK-IN",     name:"8 Sem. Seguidas",    icon:"💪", check:(_,s)    => s >= 8  },
  { id:"12w",    category:"CHECK-IN",     name:"12 Sem. Seguidas",   icon:"👑", check:(_,s)    => s >= 12 },
  { id:"diet4",  category:"CONSISTÊNCIA", name:"Dieta ≥8 · 4 Sem.",  icon:"🥗", check:(_,__,a) => a >= 8  },
  { id:"train4", category:"CONSISTÊNCIA", name:"Treino ≥8 · 4 Sem.", icon:"🏋️", check:(_,__,a) => a >= 8  },
  { id:"cardio", category:"CONSISTÊNCIA", name:"Cardio Completo",    icon:"🏃", check:(_,__,a) => a >= 8  },
  { id:"sleep",  category:"CONSISTÊNCIA", name:"Sono Consistente",   icon:"😴", check:(_,__,a) => a >= 7  },
];

interface Props {
  patient: { id: string; name: string; plan?: string };
  totalPts: number; checkinCount: number; currentStreak: number; bestStreak: number;
  avgDiet: string | null; avgTraining: string | null; avgSleep: string | null;
  weekCheckin: { lapidados_score?: number; week_number: number } | null;
  currentWeek: number; currentYear: number;
  recentCheckins: { week_number: number; year: number; lapidados_score?: number; created_at: string }[];
}

export default function InicioClient({
  patient, totalPts, checkinCount, currentStreak, bestStreak,
  avgDiet, avgTraining, avgSleep, weekCheckin, currentWeek, currentYear, recentCheckins,
}: Props) {
  const [animPts, setAnimPts] = useState(0);
  const rank     = getRank(totalPts);
  const nextRank = [...RANKS].find((r) => r.min > totalPts);
  const pct      = nextRank ? Math.round(((totalPts - rank.min) / (nextRank.min - rank.min)) * 100) : 100;
  const firstName = patient.name.split(" ")[0];
  const hora = new Date().getHours();
  const greeting = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const weekTier = weekCheckin ? getWeekTier(weekCheckin.lapidados_score ?? 0) : null;

  const unlockedIds = new Set(
    ACHIEVEMENTS.filter((a) => a.check(checkinCount, currentStreak, Number(avgDiet ?? 0))).map((a) => a.id)
  );

  useEffect(() => {
    if (totalPts === 0) return;
    let cur = 0;
    const id = setInterval(() => {
      cur = Math.min(cur + Math.ceil(totalPts / 60), totalPts);
      setAnimPts(cur);
      if (cur >= totalPts) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [totalPts]);

  const bg = { background:"linear-gradient(180deg,#0d0d0d 0%,#111111 60%,#180800 100%)", minHeight:"100vh" };

  return (
    <div style={bg} className="max-w-md mx-auto pb-28 px-4 pt-6">

      {/* Saudação */}
      <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ duration:.35 }} className="mb-5">
        <p className="text-white/30 text-xs font-medium uppercase tracking-widest">{greeting}, {firstName}</p>
        <p className="text-white text-xl font-black mt-0.5">SUA EVOLUÇÃO CONTINUA.</p>
      </motion.div>

      {/* Card de Rank */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.05, duration:.4 }}
        className="rounded-2xl p-5 mb-4 border border-white/10 relative overflow-hidden"
        style={{ background:`linear-gradient(135deg,${rank.color}15,transparent 70%)` }}>
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background:rank.color }} />
        <div className="flex items-center justify-between mb-4 relative">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{rank.icon}</span>
              <div>
                <p className="text-white font-black text-lg leading-none">{rank.name}</p>
                <p className="text-white/30 text-[10px] font-medium uppercase tracking-widest">Rank atual</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {currentStreak > 0 && (
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">
                  🔥 {currentStreak} sem. seguidas
                </span>
              )}
              {weekCheckin && (
                <span className="text-[11px] font-bold px-2 py-1 rounded-full"
                  style={{ background:`${weekTier?.color}20`, color:weekTier?.color, border:`1px solid ${weekTier?.color}30` }}>
                  +{weekCheckin.lapidados_score ?? 0} pts sem. passada
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-5xl font-black" style={{ color:rank.color }}>{animPts}</p>
            <p className="text-white/30 text-xs font-medium">pts acumulados</p>
          </div>
        </div>
        {nextRank && (
          <div>
            <div className="flex justify-between text-[10px] font-medium mb-1.5">
              <span className="text-white/30 uppercase tracking-widest">Próximo rank</span>
              <span className="font-bold" style={{ color:nextRank.color }}>{nextRank.icon} {nextRank.name}</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background:rank.color }}
                initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ delay:.3, duration:.8, ease:"easeOut" }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-white/25">{totalPts} pts</span>
              <span className="text-white/25">{nextRank.min - totalPts} pts para {nextRank.name}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Check-in */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.1, duration:.4 }} className="mb-4">
        {weekCheckin ? (
          <div className="rounded-2xl p-4 border border-green-500/20 bg-green-500/5 flex items-center justify-between">
            <div>
              <p className="text-green-400 font-bold text-sm">✅ Check-in realizado!</p>
              <p className="text-white/40 text-xs mt-0.5">Semana {weekCheckin.week_number} · {weekCheckin.lapidados_score ?? 0}pts</p>
            </div>
            <span className="text-base font-black" style={{ color:weekTier?.color }}>{weekTier?.name}</span>
          </div>
        ) : (
          <Link href="/checkin">
            <motion.div whileTap={{ scale:.97 }} className="rounded-2xl p-5 relative overflow-hidden cursor-pointer"
              style={{ background:"linear-gradient(135deg,#E85D04,#C44D00)", boxShadow:"0 4px 24px rgba(232,93,4,.4)" }}>
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/5 rounded-full" />
              <div className="flex items-center justify-between relative">
                <div>
                  <p className="text-white font-black text-lg">🔥 MISSÃO SEMANAL</p>
                  <p className="text-white/60 text-xs mt-1">~2 min · Score ao final · Semana {currentWeek}</p>
                </div>
                <ChevronRight size={24} className="text-white/70" />
              </div>
            </motion.div>
          </Link>
        )}
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.15, duration:.4 }}
        className="grid grid-cols-3 gap-2 mb-3">
        {[
          { icon:"📋", label:"Check-ins",    value:checkinCount         },
          { icon:"🔥", label:"Pts acum.",    value:totalPts             },
          { icon:"⚡", label:"Melhor streak",value:`${bestStreak}sem`   },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <p className="text-lg mb-0.5">{s.icon}</p>
            <p className="text-white font-black text-sm">{s.value}</p>
            <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {(avgDiet || avgTraining || avgSleep) && (
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.18, duration:.4 }}
          className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon:"🥗", label:"Média dieta",  value:avgDiet     },
            { icon:"🏋️", label:"Média treino", value:avgTraining },
            { icon:"🌙", label:"Média sono",   value:avgSleep    },
          ].map((s) => s.value ? (
            <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg mb-0.5">{s.icon}</p>
              <p className="text-white font-black text-sm">{s.value}</p>
              <p className="text-white/30 text-[10px] mt-0.5">{s.label}</p>
            </div>
          ) : null)}
        </motion.div>
      )}

      {/* Dieta e Treino */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.2, duration:.4 }}
        className="grid grid-cols-2 gap-3 mb-5">
        {[
          { href:"/dieta",  label:"Minha Dieta",  sub:"Ver plano alimentar", icon:Utensils },
          { href:"/treino", label:"Meu Treino",   sub:"Ver exercícios",      icon:Dumbbell },
        ].map(({ href, label, sub, icon:Icon }) => (
          <Link key={href} href={href}>
            <motion.div whileTap={{ scale:.97 }}
              className="rounded-2xl p-4 border border-white/10 bg-white/5 flex flex-col gap-2 cursor-pointer hover:bg-white/8 transition-colors h-full">
              <Icon size={20} className="text-brand" />
              <p className="text-white font-bold text-sm">{label}</p>
              <p className="text-white/30 text-xs">{sub}</p>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {/* Jornada */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.25, duration:.4 }} className="mb-5">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">🗺️ Sua Jornada</p>
        <div className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-5 right-5 top-5 h-px bg-white/10" style={{ zIndex:0 }} />
            {RANKS.map((r) => {
              const unlocked  = totalPts >= r.min;
              const isCurrent = getRank(totalPts).min === r.min;
              return (
                <div key={r.name} className="flex flex-col items-center gap-1.5 relative z-10">
                  <motion.div
                    animate={isCurrent ? { scale:[1,1.08,1] } : {}}
                    transition={{ repeat:Infinity, duration:2.5 }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 transition-all"
                    style={{
                      background: unlocked ? `${r.color}20` : "rgba(255,255,255,.04)",
                      borderColor: isCurrent ? r.color : unlocked ? `${r.color}40` : "rgba(255,255,255,.1)",
                      boxShadow: isCurrent ? `0 0 16px ${r.glow}` : "none",
                    }}>
                    <span style={{ filter:unlocked ? "none" : "grayscale(1) opacity(.25)" }}>{r.icon}</span>
                  </motion.div>
                  <p className="text-[9px] font-bold text-center"
                    style={{ color:isCurrent ? r.color : unlocked ? "rgba(255,255,255,.4)" : "rgba(255,255,255,.15)" }}>
                    {r.name}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-white/20 text-[10px] text-center mt-3">Sem missão = sem evolução</p>
        </div>
      </motion.div>

      {/* Conquistas */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.3, duration:.4 }} className="mb-5">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">🏅 Conquistas</p>
        {Object.entries(
          ACHIEVEMENTS.reduce((acc, a) => { if (!acc[a.category]) acc[a.category] = []; acc[a.category].push(a); return acc; }, {} as Record<string, Achievement[]>)
        ).map(([cat, items]) => (
          <div key={cat} className="mb-4">
            <p className="text-white/20 text-[10px] font-semibold uppercase tracking-widest mb-2">{cat}</p>
            <div className="grid grid-cols-3 gap-2">
              {items.map((a) => {
                const unlocked = unlockedIds.has(a.id);
                return (
                  <motion.div key={a.id} whileTap={unlocked ? { scale:.95 } : {}}
                    className="rounded-xl p-3 flex flex-col items-center gap-1.5 border relative overflow-hidden"
                    style={{ background:unlocked ? `${rank.color}10` : "rgba(255,255,255,.03)", borderColor:unlocked ? `${rank.color}30` : "rgba(255,255,255,.07)" }}>
                    {unlocked && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand" />}
                    <span className="text-2xl" style={{ filter:unlocked ? "none" : "grayscale(1) opacity(.2)" }}>{a.icon}</span>
                    <p className="text-[10px] font-medium text-center leading-tight"
                      style={{ color:unlocked ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.2)" }}>{a.name}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Histórico */}
      {recentCheckins.length > 0 && (
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:.35, duration:.4 }}>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-3">📊 Histórico recente</p>
          <div className="flex flex-col gap-2">
            {recentCheckins.map((c) => {
              const t = getWeekTier(c.lapidados_score ?? 0);
              const date = new Date(c.created_at).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" });
              return (
                <div key={`${c.week_number}-${c.year}`}
                  className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white/60 text-sm font-medium">Sem {c.week_number}/{c.year}</p>
                    <p className="text-white/25 text-[10px]">{date}</p>
                  </div>
                  <span className="text-sm font-black" style={{ color:t.color }}>{c.lapidados_score ?? 0}pts</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
