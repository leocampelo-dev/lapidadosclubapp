import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { ClipboardList, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient: patientFilter } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("checkins")
    .select("*, patients(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (patientFilter) {
    query = query.eq("patient_id", patientFilter);
  }

  const { data: checkins } = await query;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <ClipboardList size={20} className="text-brand" />
        <div>
          <h1 className="text-xl font-semibold text-ink">Check-ins</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {checkins?.length ?? 0} registros
            {patientFilter ? " deste paciente" : " no total"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {checkins?.map((c, i) => {
          const patient = c.patients as { name: string } | null;
          return (
            <div
              key={c.id}
              className={`bg-white border border-surface-muted rounded-md p-4 shadow-card animate-fade-up delay-${Math.min(i + 1, 4)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-ink">{patient?.name ?? "Paciente"}</p>
                    <span className="text-xs text-brand font-medium bg-brand-50 px-1.5 py-0.5 rounded-full">
                      Sem {c.week}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">{formatDate(c.created_at)}</p>

                  {/* Scores compactos */}
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {[
                      { label: "Peso", value: c.weight ? `${c.weight}kg` : null },
                      { label: "Dieta", value: c.adherence !== undefined ? `${c.adherence}/10` : null },
                      { label: "Energia", value: c.energy !== undefined ? `${c.energy}/10` : null },
                      { label: "Sono", value: c.sleep !== undefined ? `${c.sleep}/10` : null },
                    ]
                      .filter((s) => s.value)
                      .map((s) => (
                        <div key={s.label} className="text-center">
                          <p className="text-xs font-medium text-ink">{s.value}</p>
                          <p className="text-[10px] text-ink-muted">{s.label}</p>
                        </div>
                      ))}
                  </div>

                  {c.notes && (
                    <p className="text-xs text-ink-secondary mt-2 bg-surface-subtle px-2 py-1.5 rounded-sm italic">
                      &ldquo;{c.notes}&rdquo;
                    </p>
                  )}
                </div>

                <Link
                  href={`/pacientes/${c.patient_id}`}
                  className="shrink-0 p-1.5 text-ink-muted hover:text-brand transition-colors"
                >
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          );
        })}

        {(!checkins || checkins.length === 0) && (
          <div className="bg-white border border-surface-muted rounded-md p-8 text-center">
            <p className="text-ink-secondary text-sm">Nenhum check-in encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
