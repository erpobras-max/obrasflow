import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatBRL = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatBRLInput = (value: any): string => {
  if (value === undefined || value === null || value === "") return "";
  
  let valStr = "";
  if (typeof value === "number") {
    valStr = value.toFixed(2);
  } else {
    valStr = String(value);
  }
  
  const cleanValue = valStr.replace(/\D/g, "");
  if (!cleanValue) return "";
  
  const centavos = parseInt(cleanValue, 10);
  const numericValue = centavos / 100;
  
  return numericValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
