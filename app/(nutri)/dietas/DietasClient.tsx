"use client";

import { useState } from "react";
import { Search, ChevronRight, Utensils } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Diet {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

interface Patient {
  id: string;
  name: string;
  phone?: string;
  status?: string;
  diet: Diet | null;
  isInactive: boolean;
}

export default function DietasClient({ patients }: { patients: Patient[] }) {
  const [search, setSearch] = useState("");

  const filtered = patients
    .filter((p) => !p.isInactive)
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(!!a.diet) - Number(!!b.diet)); // sem dieta primeiro

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-ink">Dietas</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          Monte e acompanhe os planos alimentares dos seus pacientes
        </p>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente..."
          className="w-full h-9 pl-9 pr-3 rounded-sm border border-surface-muted bg-white text-ink text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      <div className="bg-white border border-surface-muted rounded-md shadow-card overflow-hidden divide-y divide-surface-muted">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/dietas/${p.id}`}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-subtle/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <span className="text-brand text-sm font-semibold">{p.name.charAt(0)}</span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{p.name}</p>
              <p className="text-xs text-ink-muted">{p.phone}</p>
            </div>

            <span className={cn(
              "text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 flex items-center gap-1",
              p.diet ? "bg-green-100 text-green-700" : "bg-surface-muted text-ink-muted"
            )}>
              <Utensils size={10} />
              {p.diet ? "DIETA ATIVA" : "SEM DIETA"}
            </span>

            <ChevronRight size={16} className="text-ink-muted shrink-0" />
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-ink-secondary text-sm">
              {search ? "Nenhum paciente encontrado." : "Nenhum paciente ativo cadastrado ainda."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
