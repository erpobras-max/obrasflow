import type { ModuleKey } from "@/lib/permissions";

export type NavigationEnvironment = "civil" | "imobiliaria";

export type NavigationIconKey =
  | "dashboard"
  | "users"
  | "file-text"
  | "search"
  | "hard-hat"
  | "calculator"
  | "calendar"
  | "clipboard-check"
  | "clipboard-list"
  | "ruler"
  | "folder"
  | "hammer"
  | "file-check"
  | "shopping-cart"
  | "file-search"
  | "package"
  | "wrench"
  | "dollar-sign"
  | "receipt"
  | "bar-chart"
  | "user-check"
  | "building"
  | "upload"
  | "handshake";

export interface NavigationItem {
  key: ModuleKey;
  label: string;
  icon: NavigationIconKey;
  to: string;
}

export interface NavigationGroup {
  id: string;
  title: string;
  items: NavigationItem[];
}

const CIVIL_GROUPS: NavigationGroup[] = [
  {
    id: "visao-geral",
    title: "Visão geral",
    items: [{ key: "dashboard", label: "Dashboard", icon: "dashboard", to: "/dashboard" }],
  },
  {
    id: "comercial",
    title: "Comercial",
    items: [
      { key: "comercial", label: "Clientes", icon: "users", to: "/comercial/clientes" },
      { key: "comercial", label: "Propostas", icon: "file-text", to: "/comercial/propostas" },
      { key: "comercial", label: "Contratos", icon: "file-text", to: "/comercial/contratos" },
      { key: "comercial", label: "Pedidos de venda", icon: "file-text", to: "/vendas/pedidos" },
      { key: "comercial", label: "Licitações", icon: "search", to: "/comercial/licitacoes" },
    ],
  },
  {
    id: "planejamento-obras",
    title: "Planejamento e obras",
    items: [
      { key: "obras", label: "Obras", icon: "hard-hat", to: "/obras" },
      { key: "orcamentos", label: "Orçamentos", icon: "calculator", to: "/orcamentos" },
      { key: "cronograma", label: "Cronograma", icon: "calendar", to: "/cronograma" },
      {
        key: "ordens_servico",
        label: "Ordens de serviço",
        icon: "clipboard-check",
        to: "/ordens-servico",
      },
      { key: "diario", label: "Diário de obra", icon: "clipboard-list", to: "/diario" },
      { key: "medicoes", label: "Medições da obra", icon: "ruler", to: "/medicoes" },
      { key: "documentos", label: "Documentos", icon: "folder", to: "/documentos" },
    ],
  },
  {
    id: "empreiteiros",
    title: "Empreiteiros",
    items: [
      { key: "prestadores", label: "Cadastro e serviços", icon: "hammer", to: "/prestadores" },
      {
        key: "prestadores",
        label: "Contratos e medições",
        icon: "file-check",
        to: "/contratos-empreiteiros",
      },
    ],
  },
  {
    id: "suprimentos",
    title: "Suprimentos",
    items: [
      { key: "compras", label: "Central de compras", icon: "shopping-cart", to: "/compras" },
      { key: "compras", label: "Cotações", icon: "file-search", to: "/cotacoes" },
      {
        key: "compras",
        label: "Pedidos de compra",
        icon: "shopping-cart",
        to: "/compras?tab=pedidos",
      },
      { key: "estoque", label: "Estoque", icon: "package", to: "/estoque" },
      { key: "equipamentos", label: "Equipamentos", icon: "wrench", to: "/equipamentos" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    items: [
      { key: "financeiro", label: "Financeiro", icon: "dollar-sign", to: "/financeiro" },
      { key: "fiscal", label: "Fiscal", icon: "receipt", to: "/fiscal" },
    ],
  },
  {
    id: "gestao",
    title: "Gestão",
    items: [
      { key: "relatorios", label: "Relatórios", icon: "bar-chart", to: "/relatorios" },
      { key: "rh", label: "RH", icon: "user-check", to: "/rh" },
      { key: "rh", label: "Empresa", icon: "building", to: "/empresa" },
      { key: "usuarios", label: "Usuários", icon: "users", to: "/usuarios" },
      { key: "importacoes", label: "Importações", icon: "upload", to: "/importacoes" },
    ],
  },
];

const IMOBILIARIA_GROUPS: NavigationGroup[] = [
  {
    id: "visao-geral-imobiliaria",
    title: "Visão geral",
    items: [
      { key: "imobiliaria", label: "Dashboard", icon: "dashboard", to: "/imobiliaria/dashboard" },
    ],
  },
  {
    id: "cadastros-imobiliarios",
    title: "Cadastros",
    items: [
      { key: "imobiliaria", label: "Clientes", icon: "users", to: "/imobiliaria/clientes" },
      { key: "imobiliaria", label: "Fiadores", icon: "user-check", to: "/imobiliaria/fiadores" },
      { key: "imobiliaria", label: "Imóveis", icon: "building", to: "/imobiliaria/imoveis" },
      {
        key: "imobiliaria",
        label: "Salas e reservas",
        icon: "calendar",
        to: "/imobiliaria/espacos",
      },
    ],
  },
  {
    id: "operacao-imobiliaria",
    title: "Operação imobiliária",
    items: [
      {
        key: "imobiliaria",
        label: "Locações",
        icon: "clipboard-list",
        to: "/imobiliaria/locacoes",
      },
      {
        key: "imobiliaria",
        label: "Vendas de imóveis",
        icon: "handshake",
        to: "/imobiliaria/vendas",
      },
    ],
  },
  {
    id: "financeiro-imobiliario",
    title: "Financeiro",
    items: [
      {
        key: "financeiro_imobiliaria",
        label: "Financeiro imobiliário",
        icon: "dollar-sign",
        to: "/imobiliaria/financeiro",
      },
    ],
  },
];

export function getNavigationGroups(environment: NavigationEnvironment): NavigationGroup[] {
  return environment === "imobiliaria" ? IMOBILIARIA_GROUPS : CIVIL_GROUPS;
}

export function getEnvironmentForHref(href: string): NavigationEnvironment {
  const pathname = new URL(href, "https://obrasflow.local").pathname;
  return pathname.startsWith("/imobiliaria") ? "imobiliaria" : "civil";
}

export function isNavigationItemActive(itemTo: string, currentHref: string): boolean {
  const destination = new URL(itemTo, "https://obrasflow.local");
  const current = new URL(currentHref, "https://obrasflow.local");
  const samePath =
    current.pathname === destination.pathname ||
    current.pathname.startsWith(`${destination.pathname}/`);

  if (!samePath) return false;

  if (destination.search) {
    return Array.from(destination.searchParams.entries()).every(
      ([key, value]) => current.searchParams.get(key) === value,
    );
  }

  if (destination.pathname === "/compras" && current.searchParams.has("tab")) return false;

  return true;
}

export function getActiveNavigationGroupId(
  environment: NavigationEnvironment,
  currentHref: string,
): string | null {
  const groups = getNavigationGroups(environment);
  return (
    groups.find((group) => group.items.some((item) => isNavigationItemActive(item.to, currentHref)))
      ?.id ?? null
  );
}
