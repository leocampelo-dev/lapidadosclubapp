"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Mode = "login" | "esqueci-senha";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    // Busca role e redireciona
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

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/nova-senha`,
    });

    setLoading(false);

    if (error) {
      setError("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }

    setInfo("Se esse e-mail estiver cadastrado, você vai receber um link para redefinir a senha.");
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-brand mb-4">
          <span className="text-white font-bold text-2xl">L</span>
        </div>
        <h1 className="text-2xl font-semibold text-ink">Lapidados Club App</h1>
        <p className="text-ink-secondary text-sm mt-1">Nutrição esportiva de alto desempenho</p>
      </div>

      {/* Card de login */}
      <div className="w-full max-w-sm bg-surface-card border border-surface-muted rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink mb-5">
          {mode === "login" ? "Entrar" : "Redefinir senha"}
        </h2>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-10 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                           placeholder:text-ink-disabled transition-shadow"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink-secondary">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => { setMode("esqueci-senha"); setError(""); setInfo(""); }}
                  className="text-xs text-brand hover:text-brand-dark font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
            <p className="text-sm text-ink-secondary -mt-2">
              Digite seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-10 px-3 rounded-sm border border-surface-muted bg-surface text-ink text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent
                           placeholder:text-ink-disabled transition-shadow"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-sm">{error}</p>
            )}
            {info && (
              <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-sm">{info}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-brand hover:bg-brand-dark text-white font-medium text-sm rounded-sm
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand"
            >
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>

            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setInfo(""); }}
              className="text-xs text-ink-secondary hover:text-ink font-medium text-center"
            >
              Voltar para o login
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-ink-muted mt-6">
        Lapidados Club © {new Date().getFullYear()}
      </p>
    </div>
  );
}
