"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Utensils, Dumbbell, TrendingUp, MoreHorizontal } from "lucide-react";

const tabs = [
  { href:"/inicio",     label:"Início",   icon:Home           },
  { href:"/dieta",      label:"Dieta",    icon:Utensils       },
  { href:"/treino",     label:"Treino",   icon:Dumbbell       },
  { href:"/evolucao",   label:"Evolução", icon:TrendingUp     },
  { href:"/conquistas", label:"Mais",     icon:MoreHorizontal },
];

export default function PacienteTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2"
      style={{
        background: "rgba(10,10,10,.95)",
        borderTop: "1px solid rgba(255,255,255,.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
        height: 64,
        backdropFilter: "blur(12px)",
      }}>
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href}
            className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors">
            <Icon size={22} strokeWidth={active ? 2.5 : 1.6}
              color={active ? "#E85D04" : "rgba(255,255,255,.3)"} />
            <span className="text-[10px] font-semibold"
              style={{ color: active ? "#E85D04" : "rgba(255,255,255,.3)" }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
