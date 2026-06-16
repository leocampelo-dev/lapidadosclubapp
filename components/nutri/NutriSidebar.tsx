"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Utensils,
  Dumbbell,
  DollarSign,
  BookOpen,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/checkins", label: "Check-ins", icon: ClipboardList },
  { href: "/dietas", label: "Dietas", icon: Utensils },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/membros", label: "Área de Membros", icon: BookOpen },
];

export default function NutriSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <aside className="w-56 flex flex-col bg-nutri-sidebar border-r border-nutri-border shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-nutri-border">
        <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center mr-2.5">
          <span className="text-white font-bold text-sm">L</span>
        </div>
        <span className="text-nutri-text font-semibold text-sm">Lapidados</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors",
                active
                  ? "bg-brand text-white font-medium"
                  : "text-nutri-muted hover:text-nutri-text hover:bg-white/5"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-nutri-border">
        <div className="flex items-center gap-2.5 px-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center">
            <span className="text-brand text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-nutri-text text-xs font-medium truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-nutri-muted hover:text-nutri-text text-sm rounded-sm hover:bg-white/5 transition-colors"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  );
}
