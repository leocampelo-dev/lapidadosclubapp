import { ChevronRight } from "lucide-react";

export default function DietaPage() {
  return (
    <div className="px-4 pt-10 max-w-md mx-auto">
      <div className="mb-6">
        <p className="text-ink-secondary text-sm">Hoje</p>
        <h1 className="text-2xl font-semibold text-ink mt-0.5">Minha Dieta</h1>
      </div>

      {/* Macros resumo */}
      <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card mb-4 animate-fade-up">
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">Macros do dia</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Kcal", value: "—", color: "text-brand" },
            { label: "Proteína", value: "—g", color: "text-blue-500" },
            { label: "Carboidrato", value: "—g", color: "text-amber-500" },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-ink-muted mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card animate-fade-up delay-1">
        <p className="text-sm text-ink-muted text-center">
          Seu nutricionista ainda não montou sua dieta. <br />
          Ela aparecerá aqui quando estiver pronta.
        </p>
      </div>
    </div>
  );
}
