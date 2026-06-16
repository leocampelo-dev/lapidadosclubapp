import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { Users, ClipboardCheck, DollarSign, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Busca dados resumidos
  const [patientsRes, checkinsRes, financialRes] = await Promise.all([
    supabase.from("patients").select("id, status", { count: "exact" }),
    supabase
      .from("checkins")
      .select("id", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("financial")
      .select("amount, type, status")
      .eq("type", "receita")
      .eq("status", "pago"),
  ]);

  const totalPatients = patientsRes.count ?? 0;
  const activePatients = patientsRes.data?.filter((p) => p.status === "ativo").length ?? 0;
  const checkinsThisWeek = checkinsRes.count ?? 0;
  const totalRevenue = financialRes.data?.reduce((acc, r) => acc + (r.amount ?? 0), 0) ?? 0;

  const stats = [
    {
      label: "Pacientes ativos",
      value: `${activePatients}/${totalPatients}`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Check-ins esta semana",
      value: String(checkinsThisWeek),
      icon: ClipboardCheck,
      color: "text-brand",
      bg: "bg-brand-50",
    },
    {
      label: "Receita total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Taxa de adesão",
      value: "—",
      icon: TrendingUp,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`bg-white border border-surface-muted rounded-md p-4 shadow-card animate-fade-up delay-${i + 1}`}
          >
            <div className={`inline-flex p-2 rounded-sm ${stat.bg} mb-3`}>
              <stat.icon size={16} className={stat.color} />
            </div>
            <p className="text-2xl font-semibold text-ink">{stat.value}</p>
            <p className="text-xs text-ink-secondary mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Placeholder de check-ins recentes */}
      <div className="bg-white border border-surface-muted rounded-md p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink mb-4">Check-ins recentes</h2>
        <p className="text-sm text-ink-muted">
          Os check-ins dos pacientes aparecerão aqui com análise da IA.
        </p>
      </div>
    </div>
  );
}
