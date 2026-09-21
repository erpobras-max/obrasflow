import * as XLSX from "xlsx";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HardHat,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Package,
  Calendar,
  Layers,
  Percent,
  Bell,
  Download,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ERP Obras" }] }),
  component: DashboardPage,
});

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#64748b"];
const STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em Andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const fmtBRL = (v: number | null | undefined) => {
  const val = (v ?? 0) / 100;
  if (isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function DashboardPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();

  // Realtime subscription to automatically trigger reload on any change
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "obras" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-realtime-data"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contas_receber" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-realtime-data"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contas_pagar" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-realtime-data"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Unified Query for Dashboard data
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-realtime-data"],
    staleTime: 1000 * 60 * 5, // 5 min cache (performance)
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // 1. Fetch from database views (casting to any to bypass generated type limitations)
      const { data: opStats } = await (supabase as any).from("vw_dashboard_operacional").select("*").maybeSingle();
      const { data: finStats } = await (supabase as any).from("vw_dashboard_financeiro").select("*").maybeSingle();

      // 2. Fetch Obras for Pizza chart and list
      const { data: obras } = await (supabase as any)
        .from("obras")
        .select("id, numero, nome, status, progresso, data_fim_prevista, cliente_id, clientes(nome), contratos(id,titulo,status), propostas(id,titulo,status)")
        .order("created_at", { ascending: false });

      // 3. Fetch Next 7 Days Vencimentos
      const { data: crNext } = await (supabase as any)
        .from("contas_receber")
        .select("id, descricao, valor_total, data_vencimento")
        .or("origem.is.null,origem.neq.imobiliaria")
        .gte("data_vencimento", todayStr)
        .lte("data_vencimento", next7DaysStr)
        .neq("status", "cancelada");

      const { data: cpNext } = await (supabase as any)
        .from("contas_pagar")
        .select("id, descricao, valor_total, data_vencimento")
        .or("origem.is.null,origem.neq.imobiliaria")
        .gte("data_vencimento", todayStr)
        .lte("data_vencimento", next7DaysStr)
        .neq("status", "cancelada");

      // 4. Fetch Stock Alerts count
      const { data: stockItems } = await (supabase as any)
        .from("estoque_obra")
        .select("id, saldo, material:materiais(estoque_min)");

      // 5. Fetch total unpaid overdue
      const { data: crOverdue } = await (supabase as any)
        .from("contas_receber")
        .select("valor_total")
        .or("origem.is.null,origem.neq.imobiliaria")
        .eq("status", "atrasada");

      const { data: cpOverdue } = await (supabase as any)
        .from("contas_pagar")
        .select("valor_total")
        .or("origem.is.null,origem.neq.imobiliaria")
        .eq("status", "atrasada");

      // Calculations
      const stockAlertCount = (stockItems ?? []).filter(
        (item: any) => Number(item.saldo) <= Number(item.material?.estoque_min ?? 0)
      ).length;

      const totalReceberOverdue = (crOverdue ?? []).reduce((sum: number, item: any) => sum + item.valor_total, 0);
      const totalPagarOverdue = (cpOverdue ?? []).reduce((sum: number, item: any) => sum + item.valor_total, 0);

      const mixedVencimentos = [
        ...(crNext ?? []).map((cr: any) => ({ ...cr, type: "CR" })),
        ...(cpNext ?? []).map((cp: any) => ({ ...cp, type: "CP" })),
      ].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

      // 6. Fetch past 6 months accounts
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      const startOfPeriodStr = sixMonthsAgo.toISOString().slice(0, 7) + "-01";

      const { data: crCashFlow } = await (supabase as any)
        .from("contas_receber")
        .select("valor_total, data_recebimento, status")
        .or("origem.is.null,origem.neq.imobiliaria")
        .eq("status", "recebida")
        .gte("data_recebimento", startOfPeriodStr);

      const { data: cpCashFlow } = await (supabase as any)
        .from("contas_pagar")
        .select("valor_total, data_pagamento, status")
        .or("origem.is.null,origem.neq.imobiliaria")
        .eq("status", "paga")
        .gte("data_pagamento", startOfPeriodStr);

      // Group by month
      interface MonthItem {
        key: string;
        label: string;
        entradas: number;
        saidas: number;
      }
      const monthsList: MonthItem[] = [];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        monthsList.push({
          key: d.toISOString().slice(0, 7),
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          entradas: 0,
          saidas: 0
        });
      }

      (crCashFlow ?? []).forEach((item: any) => {
        if (!item.data_recebimento) return;
        const mKey = item.data_recebimento.slice(0, 7);
        const match = monthsList.find((m) => m.key === mKey);
        if (match) {
          match.entradas += Number(item.valor_total || 0) / 100;
        }
      });

      (cpCashFlow ?? []).forEach((item: any) => {
        if (!item.data_pagamento) return;
        const mKey = item.data_pagamento.slice(0, 7);
        const match = monthsList.find((m) => m.key === mKey);
        if (match) {
          match.saidas += Number(item.valor_total || 0) / 100;
        }
      });

      // 7. Group costs by work (Centro de Custo)
      const { data: cpCosts } = await (supabase as any)
        .from("contas_pagar")
        .select("valor_total, obra_id, obras(nome)")
        .eq("status", "paga");

      const workCostsMap: Record<string, { nome: string; valor: number }> = {};
      (cpCosts ?? []).forEach((item: any) => {
        const obraName = item.obras?.nome || "Geral / Sem Obra";
        const key = item.obra_id || "geral";
        if (!workCostsMap[key]) {
          workCostsMap[key] = { nome: obraName, valor: 0 };
        }
        workCostsMap[key].valor += Number(item.valor_total || 0) / 100;
      });

      const costsByWork = Object.values(workCostsMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 6);

      // Alertas: obras com prazo há 3 dias ou menos
      const { data: alertasObras } = await supabase.from("obras").select("id, nome, data_fim_prevista").lte("data_fim_prevista", todayStr).limit(5);

      return {
        opStats: opStats ?? { obras_ativas: 0, obras_concluidas: 0, obras_atrasadas: 0, percentual_medio: 0 },
        finStats: finStats ?? { receita_prevista_mes: 0, receita_realizada_mes: 0, total_inadimplente: 0, qtd_inadimplente: 0 },
        obras: (obras ?? []) as any[],
        stockAlertCount,
        totalReceberOverdue,
        totalPagarOverdue,
        alertas: alertasObras?.data ?? [],
        overdueCount: (crOverdue ?? []).length + (cpOverdue ?? []).length,
        mixedVencimentos,
        cashFlow: monthsList,
        costsByWork,
      };
    },
  });

  const pizzaData = useMemo(() => {
    if (!data?.obras) return [];
    const counts: Record<string, number> = {};
    data.obras.forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.keys(counts).map((k) => ({ name: STATUS_LABELS[k] || k, value: counts[k] }));
  }, [data?.obras]);

  const activeObras = useMemo(() => {
    if (!data?.obras) return [];
    return data.obras.filter((o) => o.status === "em_andamento").slice(0, 8);
  }, [data?.obras]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-80 md:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const hasAlerts = (data?.stockAlertCount ?? 0) > 0 || (data?.opStats.obras_atrasadas ?? 0) > 0 || (data?.overdueCount ?? 0) > 0;
  const alertas = (data?.alertas ?? []) as any[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {alertas.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-2 font-semibold text-amber-800"><Bell className="size-5" /> Alertas de atraso</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {alertas.map((a: any) => <li key={a.id}>• <b>{a.nome}</b> — fim previsto {a.data_fim_prevista ? new Date(a.data_fim_prevista+"T00:00").toLocaleDateString("pt-BR") : "—"}</li>)}
          </ul>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          const ws = XLSX.utils.json_to_sheet([
            ["Indicador","Valor"],
            ["Obras em andamento", data?.opStats?.obras_atrasadas ?? 0],
            ["Receber atrasado", data?.opStats?.receber_atrasado ?? 0],
            ["Pagar atrasado", data?.opStats?.pagar_atrasado ?? 0],
            ["Estoque baixo", data?.stockAlertCount ?? 0],
            ["Alertas", (data?.alertas ?? []).length],
          ]);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Dashboard");
          XLSX.writeFile(wb, `dashboard-${new Date().toISOString().slice(0,10)}.xlsx`);
        }}><Download className="size-4" /> Exportar</Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Olá, {perfil?.nome ?? "Usuário"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Painel geral e controle operacional das suas obras.
        </p>
      </div>

      {/* Unified Alert Banner */}
      {hasAlerts && (
        <Card className="border-red-100 bg-red-50/20 backdrop-blur-sm">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
              <AlertTriangle className="size-5 shrink-0" />
              <span>Atenção: Alertas ativos requerem sua revisão!</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {data && data.stockAlertCount > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-white shadow-sm">
                  <Package className="size-4 text-amber-500" />
                  <span>
                    Estoque baixo: <strong>{data.stockAlertCount}</strong> produtos abaixo do mínimo.
                  </span>
                </div>
              )}
              {data && data.opStats.obras_atrasadas > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-white shadow-sm">
                  <HardHat className="size-4 text-destructive" />
                  <span>
                    Atrasos: <strong>{data.opStats.obras_atrasadas}</strong> obras com prazo estourado.
                  </span>
                </div>
              )}
              {data && data.overdueCount > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-white shadow-sm">
                  <DollarSign className="size-4 text-destructive" />
                  <span>
                    Financeiro: <strong>{data.overdueCount}</strong> contas vencidas (Total:{" "}
                    {fmtBRL(data.totalReceberOverdue + data.totalPagarOverdue)}).
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operacional KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardKpi
          label="Obras em Andamento"
          value={String(data?.opStats.obras_ativas ?? 0)}
          icon={HardHat}
          className="text-blue-600 border-blue-100 bg-blue-50/10"
        />
        <CardKpi
          label="Concluídas (Carteira)"
          value={String(data?.opStats.obras_concluidas ?? 0)}
          icon={Layers}
          className="text-green-600 border-green-100 bg-green-50/10"
        />
        <CardKpi
          label="Obras em Atraso"
          value={String(data?.opStats.obras_atrasadas ?? 0)}
          icon={AlertTriangle}
          className={cn(
            "border-red-100 bg-red-50/10",
            (data?.opStats.obras_atrasadas ?? 0) > 0 ? "text-destructive font-bold animate-pulse" : "text-slate-600"
          )}
        />
        <div className="rounded-xl border p-4 shadow-sm bg-gradient-to-br from-indigo-50/10 to-purple-50/10 border-indigo-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avanço Médio
            </span>
            <Percent className="size-4 text-indigo-500" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono text-indigo-700">
              {data?.opStats.percentual_medio ?? 0}%
            </span>
            <Progress value={data?.opStats.percentual_medio ?? 0} className="h-2 bg-indigo-100 [&>div]:bg-indigo-600" />
          </div>
        </div>
      </div>

      {/* Financeiro KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardKpi
          label="Faturamento Previsto (Mês)"
          value={fmtBRL(data?.finStats.receita_prevista_mes)}
          icon={DollarSign}
          className="text-green-600 border-green-100 bg-green-50/5"
        />
        <div className="rounded-xl border p-4 shadow-sm bg-gradient-to-br from-emerald-50/10 to-teal-50/5 border-emerald-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Faturamento Realizado (Mês)
            </span>
            <TrendingUp className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700">
            {fmtBRL(data?.finStats.receita_realizada_mes)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {data?.finStats.receita_prevista_mes && data.finStats.receita_prevista_mes > 0
              ? `${((data.finStats.receita_realizada_mes / data.finStats.receita_prevista_mes) * 100).toFixed(0)}% do esperado`
              : "0% do esperado"}
          </p>
        </div>
        <CardKpi
          label="Inadimplência (Vencido)"
          value={fmtBRL(data?.finStats.total_inadimplente)}
          icon={AlertTriangle}
          className={cn(
            "border-amber-100 bg-amber-50/5",
            (data?.finStats.total_inadimplente ?? 0) > 0 ? "text-amber-700" : "text-muted-foreground"
          )}
        />
      </div>

      {/* Advanced Financial Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fluxo de Caixa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Fluxo de Caixa (Últimos 6 Meses)</CardTitle>
            <p className="text-xs text-muted-foreground">Comparativo mensal de Entradas vs Saídas pagas.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {!data?.cashFlow || data.cashFlow.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Nenhuma movimentação realizada no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cashFlow} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} tickMargin={8} style={{ fontSize: 10 }} />
                  <YAxis
                    tickLine={false}
                    tickMargin={8}
                    style={{ fontSize: 10 }}
                    tickFormatter={(v) => `R$ ${v.toLocaleString("pt-BR", { compactDisplay: "short", notation: "compact" })}`}
                  />
                  <Tooltip
                    formatter={(v: any) => [
                      `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ]}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11 }} />
                  <Bar name="Entradas (Receitas)" dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar name="Saídas (Despesas)" dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Custos por Obra */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribuição de Custos por Obra</CardTitle>
            <p className="text-xs text-muted-foreground">Maiores despesas pagas acumuladas por centro de custo.</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {!data?.costsByWork || data.costsByWork.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sem despesas pagas registradas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.costsByWork}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    tickMargin={8}
                    style={{ fontSize: 10 }}
                    tickFormatter={(v) => `R$ ${v.toLocaleString("pt-BR", { compactDisplay: "short", notation: "compact" })}`}
                  />
                  <YAxis dataKey="nome" type="category" tickLine={false} tickMargin={8} style={{ fontSize: 10 }} width={80} />
                  <Tooltip
                    formatter={(v: any) => [
                      `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    ]}
                  />
                  <Bar name="Custo Total" dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Obras List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Obras em Andamento</CardTitle>
            <Link to="/obras" className="text-xs text-primary font-medium hover:underline flex items-center">
              Ver todas <ChevronRight className="size-3.5 ml-0.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
                    <th className="p-3 text-left">Obra</th>
                    <th className="p-3 text-left">Cliente</th>
                    <th className="p-3 text-left">Progresso</th>
                    <th className="p-3 text-left">Término Previsto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeObras.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                        Nenhuma obra ativa em andamento.
                      </td>
                    </tr>
                  ) : (
                    activeObras.map((o) => (
                      <tr key={o.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 font-semibold text-slate-800">{o.nome}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {o.clientes?.nome || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 max-w-[150px]">
                            <span className="text-xs font-mono font-medium">{o.progresso}%</span>
                            <Progress value={o.progresso} className="h-1.5" />
                          </div>
                        </td>
                        <td className="p-3 text-xs text-slate-600">
                          {o.data_fim_prevista
                            ? new Date(o.data_fim_prevista + "T00:00").toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recharts Pie Chart status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center">
            {pizzaData.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nenhuma obra cadastrada</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pizzaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pizzaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Layout - Upcoming vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" /> Contas e Vencimentos dos Próximos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs font-medium text-muted-foreground uppercase">
                    <th className="p-3 text-left w-20">Fluxo</th>
                    <th className="p-3 text-left">Título</th>
                    <th className="p-3 text-left">Vencimento</th>
                    <th className="p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.mixedVencimentos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground text-xs">
                        Nenhum vencimento previsto para os próximos 7 dias.
                      </td>
                    </tr>
                  ) : (
                    data?.mixedVencimentos.map((v: any, index) => (
                      <tr key={v.id + index} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3">
                          {v.type === "CR" ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 gap-1 text-[10px]">
                              <ArrowDown className="size-3" /> Receber
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 gap-1 text-[10px]">
                              <ArrowUp className="size-3" /> Pagar
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-800">{v.descricao}</td>
                        <td className="p-3 text-xs text-slate-600">
                          {new Date(v.data_vencimento + "T00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td
                          className={cn(
                            "p-3 text-right font-mono font-semibold",
                            v.type === "CR" ? "text-green-700" : "text-red-700"
                          )}
                        >
                          {fmtBRL(v.valor_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CardKpi({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon: any;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 shadow-sm border", className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <Icon className="size-4 opacity-70" />
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
    </Card>
  );
}
