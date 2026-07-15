"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

const MENSAGENS: Record<string, string> = {
  "link-invalido": "Esse link expirou ou já foi usado. Solicite um novo.",
};

export default function AuthErroPage() {
  const searchParams = useSearchParams();
  const motivo = searchParams.get("motivo");
  const mensagem = MENSAGENS[motivo ?? ""] ?? "Não foi possível concluir o login. Tente novamente.";

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface-card border border-surface-muted rounded-md p-6 shadow-card text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
          <AlertCircle className="text-red-500" size={22} />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-1.5">Algo deu errado</h2>
        <p className="text-sm text-ink-secondary mb-6">{mensagem}</p>

        <Link
          href="/auth/login"
          className="inline-flex w-full h-10 items-center justify-center bg-brand hover:bg-brand-dark
                     text-white font-medium text-sm rounded-sm transition-colors shadow-brand"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
