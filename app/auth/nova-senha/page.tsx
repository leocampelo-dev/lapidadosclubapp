"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function NovaSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Link expirado, já usado, ou acesso direto sem vir do e-mail.
        router.replace("/auth/erro?motivo=link-invalido");
        return;
      }
      setCheckingSession(false);
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Não foi possível salvar a senha. Tente novamente.");
      return;
    }

    // Busca role e redireciona pra área correta
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = roleData?.role ?? "paciente";
    router.push(role === "nutri" ? "/dashboard" : "/inicio");
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <p className="text-sm text-ink-secondary">Verificando link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-brand mb-4">
          <span className="text-white font-bold text-2xl">L</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink">Lapidados Club App</h1>
      </div>

      <div className="w-full max-w-sm bg-surface-card border border-surface-muted rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink mb-1.5">Defina sua senha</h2>
        <p className="text-sm text-ink-secondary mb-5">
          Crie uma senha de acesso para sua conta.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">
              Nova senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full h-10 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                         placeholder:text-ink-disabled transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-secondary mb-1.5">
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full h-10 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                         placeholder:text-ink-disabled transition-shadow"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-brand hover:bg-brand-dark text-white font-medium text-sm rounded-sm
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand"
          >
            {loading ? "Salvando..." : "Salvar e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
