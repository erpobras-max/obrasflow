import type { AppRole } from "@/lib/permissions";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  diretor: "Diretor",
  financeiro_civil: "Financeiro Civil",
  financeiro_imobiliaria: "Financeiro Imobiliária",
  compras: "Compras",
  engenharia: "Engenharia",
  almoxarifado: "Almoxarifado",
  rh: "RH",
  cliente: "Cliente",
  funcionario: "Funcionário (Ponto)",
  imobiliaria: "Imobiliária",
};

// Tailwind classes for role badge colors (distinct per role)
export const ROLE_BADGE_CLASS: Record<AppRole, string> = {
  admin: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  diretor: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300",
  financeiro_civil: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300",
  financeiro_imobiliaria: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  compras: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  engenharia: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  almoxarifado: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300",
  rh: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300",
  cliente: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  funcionario: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
  imobiliaria: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300",
};

export const ROLE_OPTIONS: AppRole[] = [
  "admin","diretor","financeiro_civil","financeiro_imobiliaria","compras",
  "engenharia","almoxarifado","rh","cliente","funcionario","imobiliaria",
];