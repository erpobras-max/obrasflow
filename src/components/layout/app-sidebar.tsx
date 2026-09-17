import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, HardHat, Briefcase, FileText, ClipboardList,
  ShoppingCart, Package, DollarSign, Receipt, Folder,
  Wrench, BarChart3, Users, Building2, Ruler, UserCheck, Search,
  Calculator, Upload, CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { canAccessAny, type ModuleKey, type AppRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  to: string;
}

interface SidebarGroup {
  title?: string;
  items: SidebarItem[];
}

const NAVIGATION_GROUPS: SidebarGroup[] = [
  {
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
    ],
  },
  {
    title: "Comercial",
    items: [
      { key: "comercial", label: "Clientes", icon: Users, to: "/comercial/clientes" },
      { key: "comercial", label: "Oportunidades", icon: Briefcase, to: "/comercial/oportunidades" },
      { key: "comercial", label: "Propostas", icon: FileText, to: "/comercial/propostas" },
      { key: "comercial", label: "Contratos", icon: FileText, to: "/comercial/contratos" },
      { key: "comercial", label: "Pedidos de Venda", icon: FileText, to: "/vendas/pedidos" },
      { key: "comercial", label: "Licitações", icon: Search, to: "/comercial/licitacoes" },
    ],
  },
  {
    title: "Obras",
    items: [
      { key: "obras", label: "Obras", icon: HardHat, to: "/obras" },
      { key: "orcamentos", label: "Orçamentos", icon: Calculator, to: "/orcamentos" },
      { key: "diario", label: "Diário de Obra", icon: ClipboardList, to: "/diario" },
      { key: "medicoes", label: "Medições", icon: Ruler, to: "/medicoes" },
      { key: "cronograma", label: "Cronograma", icon: CalendarDays, to: "/cronograma" },
      { key: "documentos", label: "Documentos", icon: Folder, to: "/documentos" },
    ],
  },
  {
    title: "Suprimentos",
    items: [
      { key: "compras", label: "Compras", icon: ShoppingCart, to: "/compras" },
      { key: "estoque", label: "Estoque", icon: Package, to: "/estoque" },
      { key: "equipamentos", label: "Equipamentos", icon: Wrench, to: "/equipamentos" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { key: "financeiro", label: "Financeiro", icon: DollarSign, to: "/financeiro" },
      { key: "fiscal", label: "Fiscal", icon: Receipt, to: "/fiscal" },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { key: "relatorios", label: "Relatórios", icon: BarChart3, to: "/relatorios" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { key: "rh", label: "RH", icon: UserCheck, to: "/rh" },
      { key: "rh", label: "Empresa", icon: Building2, to: "/empresa" },
      { key: "usuarios", label: "Usuários", icon: Users, to: "/usuarios" },
      { key: "importacoes", label: "Importações", icon: Upload, to: "/importacoes" },
    ],
  },
  {
    title: "Imobiliária",
    items: [
      { key: "imobiliaria", label: "Dashboard (Imob.)", icon: LayoutDashboard, to: "/imobiliaria/dashboard" },
      { key: "imobiliaria", label: "Clientes (Imob.)", icon: Users, to: "/imobiliaria/clientes" },
      { key: "imobiliaria", label: "Fiadores", icon: UserCheck, to: "/imobiliaria/fiadores" },
      { key: "imobiliaria", label: "Imóveis", icon: Building2, to: "/imobiliaria/imoveis" },
      { key: "imobiliaria", label: "Locações", icon: ClipboardList, to: "/imobiliaria/locacoes" },
    ],
  },
];

export function AppSidebar({
  roles,
  nome,
  email,
  className,
  onItemClick,
}: {
  roles: string[] | null;
  nome: string;
  email: string;
  className?: string;
  onItemClick?: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Filter groups and items inside them based on user role access
  const filteredGroups = NAVIGATION_GROUPS.map(group => {
    const allowedItems = group.items.filter(item => canAccessAny(roles, item.key));
    return {
      ...group,
      items: allowedItems
    };
  }).filter(group => group.items.length > 0);

  return (
    <aside className={cn("w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0", className)}>
      <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="size-9 rounded-lg bg-accent flex items-center justify-center">
          <Building2 className="size-5 text-accent-foreground" />
        </div>
        <div>
          <div className="font-bold leading-tight">ERP Obras</div>
          <div className="text-[11px] text-sidebar-foreground/60">Construção Civil</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {filteredGroups.map((group, gIdx) => (
          <div key={group.title || `group-${gIdx}`} className="space-y-1">
            {group.title && (
              <div className="text-[10px] font-bold tracking-wider text-sidebar-foreground/40 px-3 uppercase select-none">
                {group.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.to === "/dashboard"
                  ? path === "/dashboard"
                  : path === item.to || path.startsWith(item.to + "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => onItemClick?.()}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-accent text-accent-foreground text-xs">
            {nome.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{nome}</div>
          <div className="text-xs text-sidebar-foreground/60 truncate capitalize">{roles?.[0] ?? "—"}</div>
        </div>
      </div>
    </aside>
  );
}

