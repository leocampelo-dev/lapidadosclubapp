"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera, Upload } from "lucide-react";
import Link from "next/link";

const sliders = [
  { key: "adherence", label: "Adesão à dieta", emoji: "🥗" },
  { key: "hunger", label: "Fome / saciedade", emoji: "😋" },
  { key: "energy", label: "Nível de energia", emoji: "⚡" },
  { key: "sleep", label: "Qualidade do sono", emoji: "😴" },
  { key: "training", label: "Desempenho no treino", emoji: "💪" },
] as const;

type SliderKey = (typeof sliders)[number]["key"];

export default function CheckinPage() {
  const router = useRouter();
  const supabase = createClient();

  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<SliderKey, number>>({
    adherence: 7,
    hunger: 7,
    energy: 7,
    sleep: 7,
    training: 7,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!patient) throw new Error("Paciente não encontrado");

      // Calcula número da semana
      const { data: lastCheckins } = await supabase
        .from("checkins")
        .select("week")
        .eq("patient_id", patient.id)
        .order("week", { ascending: false })
        .limit(1);

      const week = (lastCheckins?.[0]?.week ?? 0) + 1;

      // Insere o check-in
      const { data: checkin, error: checkinError } = await supabase
        .from("checkins")
        .insert({
          patient_id: patient.id,
          week,
          weight: weight ? parseFloat(weight) : null,
          adherence: scores.adherence,
          hunger: scores.hunger,
          energy: scores.energy,
          sleep: scores.sleep,
          training: scores.training,
          notes: notes || null,
        })
        .select()
        .single();

      if (checkinError) throw checkinError;

      // Upload de fotos no Storage
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `checkins/${patient.id}/${checkin.id}/${Date.now()}.${ext}`;
        await supabase.storage.from("checkin-photos").upload(path, photo);
      }

      // Adiciona pontos (50 base + 20 se adesão >= 8)
      const points = 50 + (scores.adherence >= 8 ? 20 : 0) + (photos.length > 0 ? 10 : 0);
      await supabase.from("points_ledger").insert({
        patient_id: patient.id,
        source: `checkin_semana_${week}`,
        points,
      });

      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar check-in");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-ink mb-2">Check-in enviado!</h1>
        <p className="text-ink-secondary text-sm mb-6">
          Seu nutricionista vai analisar e retornar em breve.
        </p>
        <Link
          href="/inicio"
          className="bg-brand text-white px-6 py-3 rounded-md font-medium text-sm shadow-brand"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-md mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/inicio" className="p-1.5 -ml-1.5 text-ink-secondary hover:text-ink">
          <ChevronLeft size={22} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-ink">Check-in semanal</h1>
          <p className="text-ink-secondary text-xs">Mostre sua evolução e ganhe pontos</p>
        </div>
      </div>

      {/* Peso */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up">
        <label className="block text-sm font-medium text-ink mb-2">
          Peso atual (kg) *
        </label>
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Ex: 78.5"
          className="w-full h-11 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-base
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {/* Sliders */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up delay-1">
        <p className="text-sm font-medium text-ink mb-4">Como foi sua semana?</p>
        <div className="flex flex-col gap-5">
          {sliders.map(({ key, label, emoji }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-ink flex items-center gap-1.5">
                  <span>{emoji}</span> {label}
                </label>
                <span className="text-sm font-bold text-brand w-6 text-right">
                  {scores[key]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={scores[key]}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="w-full h-2 bg-surface-subtle rounded-full appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
                           [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-brand"
              />
              <div className="flex justify-between text-[10px] text-ink-muted mt-0.5">
                <span>1</span><span>10</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fotos */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up delay-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink flex items-center gap-1.5">
            <Camera size={16} className="text-brand" />
            Fotos de evolução
          </p>
          <span className="text-xs text-brand font-medium">+10 pts</span>
        </div>

        <label className="flex flex-col items-center justify-center border-2 border-dashed border-surface-muted rounded-md p-6 cursor-pointer hover:border-brand/40 transition-colors">
          <Upload size={20} className="text-ink-muted mb-1.5" />
          <p className="text-sm text-ink-secondary">Toque para adicionar fotos</p>
          <p className="text-xs text-ink-muted mt-0.5">Frente, lado, costas</p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
        </label>

        {photos.length > 0 && (
          <p className="text-sm text-brand font-medium mt-2">
            {photos.length} foto{photos.length !== 1 ? "s" : ""} selecionada{photos.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Notas */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-6 animate-fade-up delay-3">
        <label className="block text-sm font-medium text-ink mb-2">
          Observações (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Como foi a semana? Algo diferente? Dificuldades?"
          rows={3}
          className="w-full px-3 py-2.5 rounded-sm border border-surface-muted bg-surface text-ink text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-sm mb-4">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !weight}
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-semibold text-sm rounded-md
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand"
      >
        {loading ? "Enviando..." : "Enviar check-in 🚀"}
      </button>
    </div>
  );
}
