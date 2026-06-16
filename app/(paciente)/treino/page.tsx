export default function TreinoPage() {
  return (
    <div className="px-4 pt-10 max-w-md mx-auto">
      <div className="mb-6">
        <p className="text-ink-secondary text-sm">Hoje</p>
        <h1 className="text-2xl font-semibold text-ink mt-0.5">Meu Treino</h1>
      </div>

      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card animate-fade-up">
        <p className="text-sm text-ink-muted text-center">
          Seu nutricionista ainda não montou seu treino. <br />
          Ele aparecerá aqui quando estiver pronto.
        </p>
      </div>
    </div>
  );
}
