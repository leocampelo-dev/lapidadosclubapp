"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, ClipboardList, Activity, Utensils,
  Dumbbell, DollarSign, BookOpen, Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/pacientes",    label: "Pacientes",       icon: Users },
  { href: "/atendimentos", label: "Atendimentos",    icon: ClipboardList },
  { href: "/checkins", label: "Check-ins", icon: Activity },
  { href: "/dietas",       label: "Dietas",          icon: Utensils },
  { href: "/treinos",      label: "Treinos",         icon: Dumbbell },
  { href: "/financeiro",   label: "Financeiro",      icon: DollarSign },
  { href: "/membros",      label: "Área de Membros", icon: BookOpen },
];

export default function NutriSidebar({ userName: initialName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profile").select("full_name, avatar_data").eq("user_id", user.id).maybeSingle();
      if (data?.full_name) setUserName(data.full_name);
      if (data?.avatar_data) setAvatarUrl(data.avatar_data);
    }
    loadProfile();
  }, []);

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
            <Link key={href} href={href}
              className={cn("flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors",
                active ? "bg-brand text-white font-medium" : "text-nutri-muted hover:text-nutri-text hover:bg-white/5")}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-nutri-border">
        <Link href="/configuracoes"
          className={cn("flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm transition-colors mb-1",
            pathname.startsWith("/configuracoes") ? "bg-brand text-white font-medium" : "text-nutri-muted hover:text-nutri-text hover:bg-white/5")}>
          <Settings size={15} />
          Configurações
        </Link>
        <div className="flex items-center gap-2.5 px-2 mt-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
              <span className="text-brand text-xs font-semibold">{userName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <span className="text-nutri-text text-xs font-medium truncate">{userName}</span>
        </div>
      </div>
    </aside>
  );
}
