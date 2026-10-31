import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  FileCheck,
  FileSearch,
  FileText,
  Folder,
  Hammer,
  Handshake,
  HardHat,
  LayoutDashboard,
  Package,
  Receipt,
  Ruler,
  Search,
  ShoppingCart,
  Upload,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getActiveNavigationGroupId,
  getEnvironmentForHref,
  getNavigationGroups,
  isNavigationItemActive,
  type NavigationEnvironment,
  type NavigationIconKey,
} from "@/lib/navigation-menu";
import { canAccessAny } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const OPEN_GROUPS_STORAGE_KEY = "obrasflow:sidebar-open-groups:v1";

const ICONS: Record<NavigationIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  "file-text": FileText,
  search: Search,
  "hard-hat": HardHat,
  calculator: Calculator,
  calendar: CalendarDays,
  "clipboard-check": ClipboardCheck,
  "clipboard-list": ClipboardList,
  ruler: Ruler,
  folder: Folder,
  hammer: Hammer,
  "file-check": FileCheck,
  "shopping-cart": ShoppingCart,
  "file-search": FileSearch,
  package: Package,
  wrench: Wrench,
  "dollar-sign": DollarSign,
  receipt: Receipt,
  "bar-chart": BarChart3,
  "user-check": UserCheck,
  building: Building2,
  upload: Upload,
  handshake: Handshake,
};

function readOpenGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const value = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function AppSidebar({
  roles,
  nome,
  className,
  onItemClick,
}: {
  roles: string[] | null;
  nome: string;
  email: string;
  className?: string;
  onItemClick?: () => void;
}) {
  const navigate = useNavigate();
  const href = useRouterState({ select: (state) => state.location.href });
  const [searchQuery, setSearchQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(readOpenGroups);

  const canUseImobiliaria =
    canAccessAny(roles, "imobiliaria") || canAccessAny(roles, "financeiro_imobiliaria");
  const canUseCivil = getNavigationGroups("civil").some((group) =>
    group.items.some((item) => item.key !== "dashboard" && canAccessAny(roles, item.key)),
  );
  const canSwitchEnvironment = canUseCivil && canUseImobiliaria;
  const routeEnvironment = getEnvironmentForHref(href);
  const environment: NavigationEnvironment =
    routeEnvironment === "imobiliaria" && canUseImobiliaria
      ? "imobiliaria"
      : routeEnvironment === "civil" && canUseCivil
        ? "civil"
        : canUseImobiliaria
          ? "imobiliaria"
          : "civil";

  const activeGroupId = getActiveNavigationGroupId(environment, href);
  const normalizedSearch = normalizeSearch(searchQuery);

  const filteredGroups = useMemo(() => {
    return getNavigationGroups(environment)
      .map((group) => {
        const allowedItems = group.items.filter((item) => canAccessAny(roles, item.key));
        const groupMatches = normalizeSearch(group.title).includes(normalizedSearch);
        const visibleItems = normalizedSearch
          ? allowedItems.filter(
              (item) => groupMatches || normalizeSearch(item.label).includes(normalizedSearch),
            )
          : allowedItems;

        return { ...group, items: visibleItems };
      })
      .filter((group) => group.items.length > 0);
  }, [environment, normalizedSearch, roles]);

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((current) => {
      if (current[activeGroupId]) return current;
      const next = { ...current, [activeGroupId]: true };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, [activeGroupId]);

  const setGroupOpen = (groupId: string, open: boolean) => {
    setOpenGroups((current) => {
      const next = { ...current, [groupId]: open };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const switchEnvironment = (next: NavigationEnvironment) => {
    setSearchQuery("");
    void navigate({
      to: (next === "imobiliaria" ? "/imobiliaria/dashboard" : "/dashboard") as never,
    });
    onItemClick?.();
  };

  const environmentLabel = environment === "imobiliaria" ? "Imobiliária" : "Construção Civil";

  return (
    <aside
      className={cn(
        "flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:sticky lg:top-0",
        className,
      )}
    >
      <div className="border-b border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!canSwitchEnvironment}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              aria-label="Selecionar ambiente"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                <Building2 className="size-5 text-accent-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold leading-tight">ERP Obras</span>
                <span className="block truncate text-[11px] text-sidebar-foreground/60">
                  {environmentLabel}
                </span>
              </span>
              {canSwitchEnvironment && <ChevronsUpDown className="size-4 opacity-60" />}
            </button>
          </DropdownMenuTrigger>
          {canSwitchEnvironment && (
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => switchEnvironment("civil")}>
                <HardHat className="mr-2 size-4" />
                Construção Civil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchEnvironment("imobiliaria")}>
                <Building2 className="mr-2 size-4" />
                Imobiliária
              </DropdownMenuItem>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>

      <div className="px-3 pt-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/45" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar módulo"
            aria-label="Buscar módulo"
            className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/45 pl-8 pr-2 text-xs text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/40 focus:border-sidebar-ring focus:ring-1 focus:ring-sidebar-ring"
          />
        </label>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Navegação principal">
        {filteredGroups.map((group) => {
          const open = normalizedSearch.length > 0 || openGroups[group.id] === true;

          return (
            <Collapsible
              key={group.id}
              open={open}
              onOpenChange={(nextOpen) => setGroupOpen(group.id, nextOpen)}
            >
              <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <span className="flex-1">{group.title}</span>
                {open ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const Icon = ICONS[item.icon];
                    const active = isNavigationItemActive(item.to, href);

                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to as never}
                          onClick={() => onItemClick?.()}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {filteredGroups.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-sidebar-foreground/55">
            Nenhum módulo encontrado.
          </div>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-sidebar-border p-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
            {nome.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{nome}</div>
          <div className="truncate text-xs capitalize text-sidebar-foreground/60">
            {roles?.[0] ?? "—"}
          </div>
        </div>
      </div>
    </aside>
  );
}
