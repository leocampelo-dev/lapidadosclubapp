import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// Retorna a data da segunda-feira de uma semana ISO
export function mondayOfIsoWeek(week: number, year: number): Date {
  const jan4 = new Date(year, 0, 4); // 4 de jan sempre está na semana 1
  const dayOfWeek = jan4.getDay() || 7; // 1=seg...7=dom
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday;
}

// Ex: "Semana 25 · 16/06/2026"
export function weekLabel(week: number, year: number): string {
  const monday = mondayOfIsoWeek(week, year);
  const dateStr = monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Sem ${week}/${year} · ${dateStr}`;
}

// Ex: "Respondido em 18/06/2026 às 14:32"
export function checkinDateLabel(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
export function patWeekLabel(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const week = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1;
  return `Semana ${week}`;
}
