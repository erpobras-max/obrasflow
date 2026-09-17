export type AppRole =
  | "admin"
  | "diretor"
  | "financeiro_civil"
  | "financeiro_imobiliaria"
  | "compras"
  | "engenharia"
  | "almoxarifado"
  | "rh"
  | "cliente"
  | "funcionario"
  | "imobiliaria";

export type ModuleKey =
  | "dashboard"
  | "obras"
  | "comercial"
  | "orcamentos"
  | "diario"
  | "medicoes"
  | "cronograma"
  | "compras"
  | "estoque"
  | "financeiro"
  | "fiscal"
  | "documentos"
  | "equipamentos"
  | "relatorios"
  | "rh"
  | "imobiliaria"
  | "produtos"
  | "vendas"
  | "importacoes"
  | "ponto"
  | "usuarios";

const ALL: ModuleKey[] = [
  "dashboard","obras","comercial","orcamentos","diario","medicoes","cronograma","compras",
  "estoque","financeiro","fiscal","documentos","equipamentos","relatorios","rh","imobiliaria",
  "produtos","vendas","importacoes",
];

export const ROLE_MODULES: Record<string, string[]> = {
  admin: [...ALL, "usuarios", "ponto"],
  diretor: [...ALL, "ponto"],
  financeiro_civil: ["dashboard","financeiro","fiscal","estoque","compras","orcamentos","medicoes","relatorios","documentos","produtos","vendas","importacoes", "ponto"],
  financeiro_imobiliaria: ["dashboard","financeiro","fiscal","imobiliaria","relatorios","documentos", "ponto"],
  compras: ["dashboard","compras","estoque","orcamentos","documentos","produtos"],
  engenharia: ["dashboard","obras","comercial","orcamentos","diario","medicoes","cronograma","equipamentos","documentos","relatorios"],
  almoxarifado: ["dashboard","estoque","compras","equipamentos","documentos","produtos"],
  rh: ["dashboard","rh","documentos","relatorios","ponto"],
  cliente: ["dashboard","obras","documentos"],
  funcionario: ["ponto"],
  imobiliaria: ["dashboard","imobiliaria"],
};

export function canAccess(role: string | null | undefined, mod: string): boolean {
  if (!role || typeof role !== "string") return false;
  const allowed = ROLE_MODULES[role];
  return !!allowed && allowed.includes(mod);
}

export function canAccessAny(roles: string[] | null | undefined, mod: string): boolean {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return false;
  return roles.some(role => canAccess(role, mod));
}

export function canAccessModule(role: string | null | undefined, mod: string): boolean {
  return canAccess(role, mod);
}

export function getAccessibleModules(roles: string[] | null | undefined): string[] {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return [];
  const modules = new Set<string>();
  for (const role of roles) {
    const allowed = ROLE_MODULES[role];
    if (allowed) {
      allowed.forEach(mod => modules.add(mod));
    }
  }
  return Array.from(modules);
}