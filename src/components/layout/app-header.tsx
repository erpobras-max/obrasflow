import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  LogOut,
  ChevronRight,
  User,
  Menu,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  HardHat,
  Package,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client.custom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "./app-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/usuarios": "Usuários",
  "/perfil": "Meu perfil",
  "/comercial/clientes": "Clientes",
  "/comercial/oportunidades": "Oportunidades",
  "/comercial/propostas": "Propostas",
  "/comercial/contratos": "Contratos",
  "/comercial/licitacoes": "Licitações",
  "/obras": "Obras",
  "/diario": "Diário de Obra",
  "/medicoes": "Medições",
  "/documentos": "Documentos",
  "/financeiro": "Financeiro",
  "/imobiliaria/financeiro": "Financeiro Imobiliário",
  "/imobiliaria/dashboard": "Dashboard Imobiliário",
  "/imobiliaria/clientes": "Clientes da Imobiliária",
  "/imobiliaria/fiadores": "Fiadores",
  "/imobiliaria/imoveis": "Imóveis",
  "/imobiliaria/locacoes": "Locações",
  "/compras": "Compras",
  "/fiscal": "Fiscal",
  "/estoque": "Estoque",
  "/equipamentos": "Equipamentos",
  "/relatorios": "Relatórios",
  "/rh": "Recursos Humanos",
};

export function AppHeader() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const title = TITLES[path] ?? "Painel";
  const { user, perfil, roles } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["notifications-alerts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      
      // 1. Obras atrasadas
      const { data: obras } = await (supabase as any)
        .from("obras")
        .select("id, numero, nome, status, data_fim_prevista")
        .neq("status", "finalizada");
      
      const obrasAtrasadas = (obras ?? [])
        .filter((o: any) => o.data_fim_prevista && o.data_fim_prevista < today)
        .map((o: any) => ({
          id: `obra-${o.id}`,
          type: "obra",
          title: `Obra atrasada: ${o.nome}`,
          description: `Prazo previsto de entrega vencido em ${new Date(o.data_fim_prevista).toLocaleDateString("pt-BR")}`,
          link: `/obras`,
          severity: "high"
        }));

      // 2. Contas a pagar atrasadas
      const { data: contasPagar } = await (supabase as any)
        .from("contas_pagar")
        .select("id, descricao, valor_total, data_vencimento, status")
        .in("status", ["aberta", "atrasada"]);

      const pagarAtrasadas = (contasPagar ?? [])
        .filter((c: any) => c.data_vencimento < today)
        .map((c: any) => ({
          id: `pagar-${c.id}`,
          type: "pagar",
          title: `Conta a pagar vencida`,
          description: `${c.descricao} - R$ ${(c.valor_total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (Vencimento: ${new Date(c.data_vencimento).toLocaleDateString("pt-BR")})`,
          link: `/financeiro`,
          severity: "high"
        }));

      // 3. Contas a receber atrasadas
      const { data: contasReceber } = await (supabase as any)
        .from("contas_receber")
        .select("id, descricao, valor_total, data_vencimento, status")
        .in("status", ["aberta", "atrasada"]);

      const receberAtrasadas = (contasReceber ?? [])
        .filter((c: any) => c.data_vencimento < today)
        .map((c: any) => ({
          id: `receber-${c.id}`,
          type: "receber",
          title: `Conta a receber vencida`,
          description: `${c.descricao} - R$ ${(c.valor_total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (Vencimento: ${new Date(c.data_vencimento).toLocaleDateString("pt-BR")})`,
          link: `/financeiro`,
          severity: "medium"
        }));

      // 4. Estoque baixo
      const { data: estoque } = await (supabase as any)
        .from("estoque_obra")
        .select(`
          id,
          saldo,
          obra_id,
          obras(nome),
          material:materiais(id, codigo, descricao, unidade, estoque_min)
        `);

      const estoqueBaixo = (estoque ?? [])
        .filter((item: any) => item.material && Number(item.saldo) <= Number(item.material.estoque_min || 0))
        .map((item: any) => ({
          id: `estoque-${item.id}`,
          type: "estoque",
          title: `Estoque crítico: ${item.material.descricao}`,
          description: `Obra: ${item.obras?.nome || `Cód. Obra: ${item.obra_id}`} | Saldo: ${Number(item.saldo).toFixed(2)} ${item.material.unidade} (Mín: ${Number(item.material.estoque_min).toFixed(2)})`,
          link: `/estoque`,
          severity: "medium"
        }));

      return [
        ...obrasAtrasadas,
        ...pagarAtrasadas,
        ...receberAtrasadas,
        ...estoqueBaixo
      ];
    },
    enabled: !!roles,
    refetchInterval: 60000,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden size-9 shrink-0">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60 border-r-0 bg-sidebar text-sidebar-foreground">
            <AppSidebar
              roles={roles}
              nome={perfil?.nome ?? user?.email ?? "Usuário"}
              email={user?.email ?? ""}
              onItemClick={() => setMobileMenuOpen(false)}
              className="w-full h-full border-r-0"
            />
          </SheetContent>
        </Sheet>

        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>ERP Obras</span>
            <ChevronRight className="size-3" />
            <span>{title}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notificações" className="relative size-9">
              <Bell className="size-5" />
              {alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold text-sm">Alertas do Sistema</h3>
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] font-mono px-1.5 py-0.5">
                  {alerts.length}
                </Badge>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center p-6 text-xs text-muted-foreground gap-2">
                  <span className="animate-spin">⏳</span> Carregando alertas...
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="size-8 text-green-500 mb-2 opacity-80" />
                  <p className="font-medium text-foreground">Tudo em dia!</p>
                  <p className="mt-1 text-muted-foreground">Sem faturas atrasadas, obras pendentes ou estoque crítico.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {alerts.map((alert: any) => {
                    let Icon = Bell;
                    let iconColor = "text-muted-foreground bg-muted";
                    if (alert.type === "obra") {
                      Icon = HardHat;
                      iconColor = "text-amber-600 bg-amber-50 dark:bg-amber-950/20";
                    } else if (alert.type === "pagar") {
                      Icon = TrendingDown;
                      iconColor = "text-red-600 bg-red-50 dark:bg-red-950/20";
                    } else if (alert.type === "receber") {
                      Icon = TrendingUp;
                      iconColor = "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20";
                    } else if (alert.type === "estoque") {
                      Icon = Package;
                      iconColor = "text-orange-600 bg-orange-50 dark:bg-orange-950/20";
                    }

                    return (
                      <Link
                        key={alert.id}
                        to={alert.link}
                        className="flex gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className={cn("size-8 rounded-full flex items-center justify-center shrink-0", iconColor)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            {alert.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground leading-normal line-clamp-2">
                            {alert.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button asChild variant="ghost" size="icon" aria-label="Meu perfil" className="size-9">
          <Link to="/perfil"><User className="size-5" /></Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={handleLogout} className="size-9">
          <LogOut className="size-5" />
        </Button>
      </div>
    </header>
  );
}
