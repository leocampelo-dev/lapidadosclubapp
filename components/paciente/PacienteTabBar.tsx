"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Utensils, Dumbbell, TrendingUp, MoreHorizontal } from "lucide-react";

const tabs = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/dieta", label: "Dieta", icon: Utensils },
  { href: "/treino", label: "Treino", icon: Dumbbell },
  { href: "/evolucao", label: "Evolução", icon: TrendingUp },
  { href: "/conquistas", label: "Mais", icon: MoreHorizontal },
];

export default function PacienteTabBar() {
  const pathname = usePathname();

  return (
    <nav className="tab-bar">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-sm transition-colors",
              active ? "text-brand" : "text-ink-muted"
            )}
          >
            <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
            <span className={cn("text-[10px] font-medium", active ? "text-brand" : "text-ink-muted")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
