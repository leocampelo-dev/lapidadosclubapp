"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, X, Edit2, Trash2, LogOut, User, CreditCard, Settings, Upload, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  sessions: number;
  price?: number;
}

// Schema real da tabela profile
interface Profile {
  user_id?: string;
  full_name?: string;
  instagram?: string;
  whatsapp?: string;
  gemini_api_key?: string;
  groq_api_key?: string;
  avatar_data?: string; // base64 da imagem
}

type Tab = "planos" | "perfil" | "sistema";

export default function ConfiguracoesPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("planos");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [userId, setUserId] = useState<string>("");

  // Crop de imagem — abordagem com object-fit/object-position
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropX, setCropX] = useState(50); // 0-100%
  const [cropY, setCropY] = useState(50); // 0-100%
  const [cropZoom, setCropZoom] = useState(100); // 100-200%
  const dragRef = useRef<{ startX: number; startY: number; startCropX: number; startCropY: number } | null>(null);
  // Modal de plano
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", months: "1", sessions: "1", price: "", durationMode: "meses" });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [plansRes, profileRes] = await Promise.all([
        supabase.from("plans").select("*").eq("user_id", user.id).order("duration_days"),
        supabase.from("profile").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setPlans(plansRes.data ?? []);
      if (profileRes.data) setProfile(profileRes.data);
    }
    load();
  }, []);

  const computedDays = planForm.durationMode === "meses" ? Number(planForm.months) * 30 : Number(planForm.months);

  async function savePlan() {
    setLoading(true);
    const payload = {
      name: planForm.name,
      duration_days: computedDays,
      sessions: Number(planForm.sessions),
      price: planForm.price ? Number(planForm.price) : null,
      user_id: userId,
    };
    if (editingPlan) {
      const { data, error } = await supabase.from("plans").update(payload).eq("id", editingPlan.id).select().single();
      if (data && !error) setPlans((p) => p.map((pl) => pl.id === data.id ? data : pl));
      else console.error("Erro ao editar plano:", error);
    } else {
      const { data, error } = await supabase.from("plans").insert(payload).select().single();
      if (data && !error) setPlans((p) => [...p, data]);
      else console.error("Erro ao criar plano:", error);
    }
    setPlanModal(false);
    setEditingPlan(null);
    setPlanForm({ name: "", months: "1", sessions: "1", price: "", durationMode: "meses" });
    setLoading(false);
  }

  async function deletePlan(id: string) {
    if (!confirm("Deletar este plano?")) return;
    await supabase.from("plans").delete().eq("id", id);
    setPlans((p) => p.filter((pl) => pl.id !== id));
  }

  function openEditPlan(plan: Plan) {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      months: String(plan.duration_days / 30),
      sessions: String(plan.sessions),
      price: plan.price ? String(plan.price) : "",
      durationMode: "meses",
    });
    setPlanModal(true);
  }

  async function saveProfile() {
    setLoading(true);
    setSaveError("");
    const { error } = await supabase.from("profile").upsert({
      user_id: userId,
      full_name: profile.full_name ?? "",
      instagram: profile.instagram ?? "",
      whatsapp: profile.whatsapp ?? "",
      gemini_api_key: profile.gemini_api_key ?? "",
      groq_api_key: profile.groq_api_key ?? "",
      avatar_data: profile.avatar_data ?? null,
    }, { onConflict: "user_id" });

    if (error) {
      console.error("Erro ao salvar perfil:", error);
      setSaveError("Erro ao salvar. Veja o console (F12) para detalhes.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setLoading(false);
  }

  function handleFileSelect(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropX(50); setCropY(50); setCropZoom(100);
    };
    reader.readAsDataURL(file);
  }

  async function confirmCrop() {
    if (!cropImage) return;
    const img = new Image();
    img.src = cropImage;
    await new Promise((res) => { img.onload = res; });

    const canvas = document.createElement("canvas");
    const OUT = 300;
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;

    // A imagem é exibida com zoom (scale) e posição (cropX, cropY).
    // Precisamos reproduzir exatamente o que o preview mostra.
    const scale = cropZoom / 100;
    const dispW = img.width  * scale;
    const dispH = img.height * scale;
    // offset da imagem no container (o container é quadrado = OUT px)
    const offsetX = (cropX / 100) * (OUT - dispW);
    const offsetY = (cropY / 100) * (OUT - dispH);

    ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, dispW, dispH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setProfile((p) => ({ ...p, avatar_data: dataUrl }));
    setCropImage(null);
  }

  function onDragStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, startCropX: cropX, startCropY: cropY };
  }

  function onDragMove(e: React.MouseEvent | React.TouchEvent) {
    if (!dragRef.current) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    // 240px = tamanho do container de preview
    const newX = Math.max(0, Math.min(100, dragRef.current.startCropX + (dx / 240) * 100));
    const newY = Math.max(0, Math.min(100, dragRef.current.startCropY + (dy / 240) * 100));
    setCropX(newX); setCropY(newY);
  }

  function onDragEnd() { dragRef.current = null; }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "planos", label: "Planos", icon: CreditCard },
    { key: "perfil", label: "Meu Perfil", icon: User },
    { key: "sistema", label: "Sistema", icon: Settings },
  ];

  const planAbbrev = (plan: Plan) => {
    const m = Math.round(plan.duration_days / 30);
    return m >= 12 ? "12" : m >= 6 ? "6M" : m >= 3 ? "3M" : "AV";
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-ink mb-1">Configurações</h1>
      <p className="text-ink-secondary text-sm mb-6">Planos, perfil e informações do sistema</p>

      <div className="flex gap-5 flex-col md:flex-row">
        <div className="w-full md:w-44 shrink-0">
          <div className="bg-white border border-surface-muted rounded-md overflow-hidden shadow-card flex md:flex-col">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2.5 px-4 py-3 text-sm transition-colors border-b md:border-b border-surface-muted last:border-0 ${
                  tab === key ? "bg-brand/5 text-brand font-medium" : "text-ink hover:bg-surface-subtle"
                }`}>
                <Icon size={15} />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {/* PLANOS */}
          {tab === "planos" && (
            <div className="bg-white border border-surface-muted rounded-md shadow-card">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted">
                <div>
                  <h2 className="text-sm font-semibold text-ink">Planos de atendimento</h2>
                  <p className="text-xs text-ink-muted mt-0.5">Edite, remova ou crie planos.</p>
                </div>
                <button onClick={() => { setEditingPlan(null); setPlanForm({ name: "", months: "1", sessions: "1", price: "", durationMode: "meses" }); setPlanModal(true); }}
                  className="flex items-center gap-1.5 h-8 px-3 bg-brand hover:bg-brand-dark text-white text-xs font-medium rounded-sm shadow-brand transition-colors shrink-0">
                  <Plus size={13} /> Novo plano
                </button>
              </div>
              <div className="divide-y divide-surface-muted">
                {plans.length === 0 && <p className="text-sm text-ink-muted text-center py-8">Nenhum plano cadastrado.</p>}
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{planAbbrev(plan)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{plan.name}</p>
                      <p className="text-xs text-ink-muted">
                        {plan.sessions} consulta{plan.sessions !== 1 ? "s" : ""} · {Math.round(plan.duration_days / 30)} mês(es) ({plan.duration_days} dias)
                        {plan.price ? ` · R$ ${Number(plan.price).toFixed(2)}` : ""}
                      </p>
                    </div>
                    <button onClick={() => openEditPlan(plan)} className="text-ink-muted hover:text-ink p-1.5 transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => deletePlan(plan.id)} className="text-ink-muted hover:text-red-500 p-1.5 transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PERFIL */}
          {tab === "perfil" && (
            <div className="bg-white border border-surface-muted rounded-md shadow-card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">Meu Perfil</h2>

              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-surface-muted">
                <div className="relative">
                  {profile.avatar_data ? (
                    <img src={profile.avatar_data} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-brand/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center">
                      <span className="text-brand text-2xl font-bold">{profile.full_name?.charAt(0)?.toUpperCase() || "N"}</span>
                    </div>
                  )}
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand rounded-full flex items-center justify-center shadow-brand">
                    <Upload size={11} className="text-white" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{profile.full_name || "Sem nome"}</p>
                  <p className="text-xs text-ink-muted mt-0.5">Clique no ícone para trocar a foto</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Field label="Nome de exibição" value={profile.full_name ?? ""} onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))} placeholder="Ex: Dr. Leonardo" />
                <Field label="WhatsApp" value={profile.whatsapp ?? ""} onChange={(v) => setProfile((p) => ({ ...p, whatsapp: v }))} placeholder="(82) 99999-9999" />
                <Field label="Instagram" value={profile.instagram ?? ""} onChange={(v) => setProfile((p) => ({ ...p, instagram: v }))} placeholder="@seu.perfil" />

                <div className="pt-3 border-t border-surface-muted">
                  <p className="text-xs font-semibold text-ink mb-3 flex items-center gap-1.5">
                    🤖 IA para análise de Check-ins
                  </p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Gemini API Key <span className="text-ink-muted font-normal">(Google AI Studio)</span>
                      </label>
                      <input
                        type="password"
                        value={profile.gemini_api_key ?? ""}
                        onChange={(e) => setProfile((p) => ({ ...p, gemini_api_key: e.target.value }))}
                        placeholder="AIza..."
                        className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-secondary mb-1">
                        Groq API Key <span className="text-ink-muted font-normal">(14.400 análises/dia grátis)</span>
                      </label>
                      <input
                        type="password"
                        value={profile.groq_api_key ?? ""}
                        onChange={(e) => setProfile((p) => ({ ...p, groq_api_key: e.target.value }))}
                        placeholder="gsk_..."
                        className="w-full h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <p className="text-[11px] text-ink-muted mt-1">
                        Recomendado: grátis, rápido. Obtenha em{" "}
                        <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-brand hover:underline">
                          console.groq.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {saveError && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-sm mt-3">{saveError}</p>}

              <button onClick={saveProfile} disabled={loading}
                className="mt-4 flex items-center gap-2 h-9 px-5 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-sm shadow-brand transition-colors disabled:opacity-50">
                {saved ? <><Check size={14} /> Salvo!</> : loading ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>
          )}

          {/* SISTEMA */}
          {tab === "sistema" && (
            <div className="flex flex-col gap-4">
              <div className="bg-white border border-surface-muted rounded-md shadow-card p-5">
                <h2 className="text-sm font-semibold text-ink mb-1">Sobre o sistema</h2>
                <p className="text-xs text-ink-muted mb-4">Lapidados Club OS · Versão 1.0.0</p>
                <div className="flex flex-col gap-2 text-sm text-ink-secondary">
                  <p>📦 Stack: Next.js + Supabase + Tailwind</p>
                  <p>☁️ Deploy: Vercel</p>
                  <p>🔒 Dados isolados por nutricionista via RLS</p>
                </div>
              </div>
              <div className="bg-white border border-surface-muted rounded-md shadow-card p-5">
                <h2 className="text-sm font-semibold text-ink mb-1">Sessão</h2>
                <p className="text-xs text-ink-muted mb-4">Você será redirecionado para a tela de login.</p>
                <button onClick={handleLogout}
                  className="flex items-center gap-2 h-9 px-4 border border-surface-muted text-ink hover:bg-surface-subtle text-sm font-medium rounded-sm transition-colors">
                  <LogOut size={14} /> Sair da conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de plano */}
      {planModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted">
              <h3 className="text-sm font-semibold text-ink">{editingPlan ? "Editar plano" : "Novo plano"}</h3>
              <button onClick={() => setPlanModal(false)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <Field label="Nome do plano *" value={planForm.name} onChange={(v) => setPlanForm((f) => ({ ...f, name: v }))} placeholder="Ex: 4 Meses, Intensivo, Anual..." />
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Duração</label>
                <div className="flex gap-2 mb-2">
                  {["meses", "dias"].map((mode) => (
                    <button key={mode} onClick={() => setPlanForm((f) => ({ ...f, durationMode: mode }))}
                      className={`h-8 px-3 text-xs rounded-sm font-medium transition-colors ${planForm.durationMode === mode ? "bg-brand text-white" : "border border-surface-muted text-ink hover:bg-surface-subtle"}`}>
                      por {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={planForm.months} onChange={(e) => setPlanForm((f) => ({ ...f, months: e.target.value }))}
                    className="w-24 h-9 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  <span className="text-sm text-ink-muted">{planForm.durationMode === "meses" ? `mês(es) = ${computedDays} dias` : "dias"}</span>
                </div>
              </div>
              <Field label="Nº de consultas *" value={planForm.sessions} onChange={(v) => setPlanForm((f) => ({ ...f, sessions: v }))} type="number" placeholder="1" />
              <Field label="Preço (R$) — opcional" value={planForm.price} onChange={(v) => setPlanForm((f) => ({ ...f, price: v }))} type="number" placeholder="Ex: 450,00" />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setPlanModal(false)} className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">Cancelar</button>
              <button onClick={savePlan} disabled={loading || !planForm.name}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar plano"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crop de foto */}
      {cropImage && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-muted">
              <h3 className="text-sm font-semibold text-ink">Ajustar foto</h3>
              <button onClick={() => setCropImage(null)} className="text-ink-muted hover:text-ink"><X size={16} /></button>
            </div>
            <div className="p-5">
              <p className="text-xs text-ink-muted mb-3">Arraste para reposicionar · use o slider para zoom</p>

              {/* Preview circular — 240x240px fixo */}
              <div
                onMouseDown={onDragStart}
                onMouseMove={onDragMove}
                onMouseUp={onDragEnd}
                onMouseLeave={onDragEnd}
                onTouchStart={onDragStart}
                onTouchMove={onDragMove}
                onTouchEnd={onDragEnd}
                className="relative mx-auto rounded-full overflow-hidden border-2 border-brand cursor-move bg-surface-subtle select-none"
                style={{ width: 240, height: 240 }}
              >
                <img
                  src={cropImage}
                  alt="Preview"
                  draggable={false}
                  className="absolute pointer-events-none"
                  style={{
                    width: `${cropZoom}%`,
                    height: `${cropZoom}%`,
                    objectFit: "cover",
                    left: `${cropX * (1 - cropZoom / 100)}%`,
                    top:  `${cropY  * (1 - cropZoom / 100)}%`,
                    transform: "none",
                  }}
                />
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-xs text-ink-muted w-8">Zoom</span>
                <input
                  type="range" min={100} max={300} step={1}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-surface-muted
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                             [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-xs text-ink-muted w-10 text-right">{cropZoom}%</span>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setCropImage(null)}
                className="flex-1 h-9 border border-surface-muted rounded-sm text-sm text-ink hover:bg-surface-subtle">
                Cancelar
              </button>
              <button onClick={confirmCrop}
                className="flex-1 h-9 bg-brand hover:bg-brand-dark text-white rounded-sm text-sm font-medium shadow-brand">
                Usar foto
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
