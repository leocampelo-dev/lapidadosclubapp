import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign } from "lucide-react";

export default async function FinanceiroPage() {
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("financial")
    .select("*, patients(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  const totalReceitas = records
    ?.filter((r) => r.type === "receita" && r.status === "pago")
    .reduce((acc, r) => acc + (r.amount ?? 0), 0) ?? 0;

  const totalPendente = records
    ?.filter((r) => r.status === "pendente")
    .reduce((acc, r) => acc + (r.amount ?? 0), 0) ?? 0;

  const statusColors: Record<string, string> = {
    pago: "text-green-600 bg-green-50",
    pendente: "text-amber-600 bg-amber-50",
    cancelado: "text-ink-muted bg-surface-subtle",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <DollarSign size={20} className="text-brand" />
        <h1 className="text-xl font-semibold text-ink">Financeiro</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card">
          <p className="text-xs text-ink-muted mb-1">Receita recebida</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceitas)}</p>
        </div>
        <div className="bg-white border border-surface-muted rounded-md p-4 shadow-card">
          <p className="text-xs text-ink-muted mb-1">A receber</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-muted">
          <h2 className="text-sm font-semibold text-ink">Lançamentos</h2>
        </div>
        <div className="flex flex-col divide-y divide-surface-muted">
          {records?.map((r) => {
            const patient = r.patients as { name: string } | null;
            return (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{r.description}</p>
                  <p className="text-xs text-ink-muted">
                    {patient?.name} · {r.due_date ? formatDate(r.due_date) : formatDate(r.created_at)}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[r.status] ?? ""}`}>
                  {r.status}
                </span>
                <p className={`text-sm font-semibold ${r.type === "receita" ? "text-green-600" : "text-red-500"}`}>
                  {r.type === "receita" ? "+" : "-"}{formatCurrency(r.amount ?? 0)}
                </p>
              </div>
            );
          })}
          {(!records || records.length === 0) && (
            <div className="p-8 text-center">
              <p className="text-ink-muted text-sm">Nenhum lançamento financeiro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
