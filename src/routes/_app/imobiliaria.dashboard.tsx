import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Home,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Percent,
  Activity,
  Calendar,
  Building,
  ClipboardCheck,
  Plus,
  Trash2,
  Loader2,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/imobiliaria/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard Imobiliária — ERP" }] }),
  component: ImobiliariaDashboardPage,
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

const TIPO_LABELS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
};

const INDICE_LABELS: Record<string, string> = {
  ipca: "IPCA",
  igp_m: "IGP-M",
  inpc: "INPC",
};

const fmtBRL = (cents: number | null | undefined) => {
  const val = (cents ?? 0) / 100;
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtBRLRaw = (val: number | null | undefined) => {
  return (val ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function ImobiliariaDashboardPage() {
  const qc = useQueryClient();

  // Queries
  const { data: imoveis, isLoading: loadingImoveis } = useQuery({
    queryKey: ["imob_dashboard_imoveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis")
        .select("id, status, tipo, valor_locacao, valor_venda, proprietario_id")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: locacoes, isLoading: loadingLocacoes } = useQuery({
    queryKey: ["imob_dashboard_locacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locacoes")
        .select("id, valor_aluguel, taxa_administracao_percentual, status, data_fim")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: faturasReceber, isLoading: loadingReceber } = useQuery({
    queryKey: ["imob_dashboard_receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("id, valor_total, status, data_vencimento, valor_recebido")
        .eq("origem", "imobiliaria");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: faturasPagar, isLoading: loadingPagar } = useQuery({
    queryKey: ["imob_dashboard_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("id, valor_total, status, data_vencimento, valor_pago")
        .eq("origem", "imobiliaria");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Calculations
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const todayMonth = today.toISOString().slice(0, 7);

    // 1. Vacancy Rate
    const totalImoveis = imoveis?.length || 0;
    const imoveisDisponiveis = imoveis?.filter((i) => i.status === "disponivel").length || 0;
    const taxaVacancia = totalImoveis > 0 ? (imoveisDisponiveis / totalImoveis) * 100 : 0;

    // 2. Average Rental Yield
    let yieldMedio = 0;
    const imoveisAlugados = imoveis?.filter((i) => i.status === "alugado") || [];
    if (imoveisAlugados.length > 0) {
      let totalYield = 0;
      let countYield = 0;
      imoveisAlugados.forEach((im) => {
        if (im.valor_locacao && im.valor_venda && im.valor_venda > 0) {
          totalYield += (im.valor_locacao / im.valor_venda) * 100;
          countYield++;
        }
      });
      yieldMedio = countYield > 0 ? totalYield / countYield : 0.55;
    }

    // 3. Comissões Mensais
    let comissoesMensais = 0;
    const locacoesAtivas = locacoes?.filter((l) => l.status === "ativo") || [];
    locacoesAtivas.forEach((l) => {
      const taxaPercentual = l.taxa_administracao_percentual || 0;
      comissoesMensais += (l.valor_aluguel * taxaPercentual) / 100;
    });

    // 4. Inadimplência
    const faturasMes = faturasReceber?.filter((f) => f.data_vencimento.slice(0, 7) === todayMonth) || [];
    const totalMes = faturasMes.reduce((acc, f) => acc + f.valor_total, 0);
    const atrasadasMes = faturasMes
      .filter((f) => f.status === "atrasada" || (f.status === "aberta" && f.data_vencimento < todayStr))
      .reduce((acc, f) => acc + f.valor_total, 0);
    const taxaInadimplencia = totalMes > 0 ? (atrasadasMes / totalMes) * 100 : 0;

    // 5. Total Receitas (já recebido este mês)
    const receitasMes = faturasMes
      .filter((f) => f.status === "recebida")
      .reduce((acc, f) => acc + (f.valor_recebido || f.valor_total), 0);

    // 6. Total Repasses (já pago este mês)
    const faturasPagarMes = faturasPagar?.filter((f) => f.data_vencimento.slice(0, 7) === todayMonth) || [];
    const repassesMes = faturasPagarMes
      .filter((f) => f.status === "paga")
      .reduce((acc, f) => acc + (f.valor_pago || f.valor_total), 0);

    // 7. Receita Líquida do Mês (receitas - repasses)
    const receitaLiquidaMes = receitasMes - repassesMes;

    // 8. Imóveis sem proprietário vinculado
    const imoveisSemProprietario = imoveis?.filter((i) => !i.proprietario_id).length || 0;

    // 9. Contratos que vencerão em <= 30 dias
    const vencendo30 = locacoes?.filter((l) => {
      if (l.status !== "ativo" || !l.data_fim) return false;
      const end = new Date(l.data_fim + "T00:00:00");
      const diff = (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length || 0;

    // 10. Taxa de ocupação
    const taxaOcupacao = totalImoveis > 0 ? ((totalImoveis - imoveisDisponiveis) / totalImoveis) * 100 : 0;

    // 11. Recharts Categorias
    const catMap: Record<string, number> = {};
    imoveis?.forEach((im) => {
      catMap[im.tipo] = (catMap[im.tipo] || 0) + 1;
    });
    const chartCategorias = Object.keys(catMap).map((k) => ({
      name: TIPO_LABELS[k] || k,
      value: catMap[k],
    }));

    // 12. Recharts Fluxo (últimos 6 meses)
    const monthlyMap: Record<string, { month: string; receitas: number; repasses: number }> = {};
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      monthlyMap[key] = {
        month: `${months[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`,
        receitas: 0,
        repasses: 0,
      };
    }

    faturasReceber?.forEach((f) => {
      const key = f.data_vencimento.slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].receitas += f.valor_total / 100;
      }
    });

    faturasPagar?.forEach((f) => {
      const key = f.data_vencimento.slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].repasses += f.valor_total / 100;
      }
    });

    const chartFluxo = Object.keys(monthlyMap)
      .sort()
      .map((k) => monthlyMap[k]);

    return {
      totalImoveis,
      imoveisDisponiveis,
      taxaVacancia,
      taxaOcupacao,
      yieldMedio,
      comissoesMensais,
      taxaInadimplencia,
      receitasMes,
      repassesMes,
      receitaLiquidaMes,
      imoveisSemProprietario,
      vencendo30,
      chartCategorias,
      chartFluxo,
    };
  }, [imoveis, locacoes, faturasReceber, faturasPagar]);

  const isLoading = loadingImoveis || loadingLocacoes || loadingReceber || loadingPagar;

  // State para gestão de índices
  const [indiceDialogOpen, setIndiceDialogOpen] = useState(false);
  const [indiceForm, setIndiceForm] = useState({ indice_tipo: "ipca" as string, periodo_ano: new Date().getFullYear(), valor_indice: "" as string });

  const { data: indices } = useQuery({
    queryKey: ["imob_indices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_indices_reajuste")
        .select("*")
        .order("periodo_ano", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteIndiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("imob_indices_reajuste").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Índice removido");
      qc.invalidateQueries({ queryKey: ["imob_indices"] });
    },
    onError: (e: any) => toast.error("Erro ao remover índice: " + e.message),
  });

  const addIndiceMutation = useMutation({
    mutationFn: async (values: typeof indiceForm) => {
      const { error } = await supabase.from("imob_indices_reajuste").insert({
        indice_tipo: values.indice_tipo,
        periodo_ano: values.periodo_ano,
        valor_indice: parseFloat(values.valor_indice),
        variacao_percentual: parseFloat(values.valor_indice),
        fonte: "Manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Índice adicionado com sucesso");
      setIndiceDialogOpen(false);
      setIndiceForm({ indice_tipo: "ipca", periodo_ano: new Date().getFullYear(), valor_indice: "" });
      qc.invalidateQueries({ queryKey: ["imob_indices"] });
    },
    onError: (e: any) => toast.error("Erro ao adicionar índice: " + e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Imobiliário</h1>
        <p className="text-muted-foreground font-medium">
          Métricas de vacância, produtividade da carteira e liquidação financeira do aluguel.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Row — 6 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ocupação */}
            <Card className="shadow-sm border-green-100 bg-green-50/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Ocupação</CardTitle>
                <Activity className="size-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-green-600">
                  {stats.taxaOcupacao.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.totalImoveis - stats.imoveisDisponiveis} de {stats.totalImoveis} ocupados
                </div>
                <Progress value={stats.taxaOcupacao} className="h-1.5 mt-3 bg-green-50" />
              </CardContent>
            </Card>

            {/* Vacância */}
            <Card className="shadow-sm border-blue-100 bg-blue-50/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Vacância</CardTitle>
                <Activity className="size-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-blue-600">
                  {stats.taxaVacancia.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.imoveisDisponiveis} imóveis desocupados
                </div>
                <Progress value={stats.taxaVacancia} className="h-1.5 mt-3 bg-blue-50" />
              </CardContent>
            </Card>

            {/* Receita Líquida */}
            <Card className={cn("shadow-sm border", stats.receitaLiquidaMes >= 0 ? "border-green-100 bg-green-50/10" : "border-red-100 bg-red-50/10")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Receita Líquida (Mês)</CardTitle>
                <DollarSign className={cn("size-4", stats.receitaLiquidaMes >= 0 ? "text-green-600" : "text-destructive")} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold font-mono", stats.receitaLiquidaMes >= 0 ? "text-green-700" : "text-destructive")}>
                  {fmtBRL(stats.receitaLiquidaMes)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Recebido: {fmtBRL(stats.receitasMes)} · Repassado: {fmtBRL(stats.repassesMes)}
                </div>
              </CardContent>
            </Card>

            {/* Contratos Vencendo */}
            <Card className={cn("shadow-sm border", stats.vencendo30 > 0 ? "border-amber-200 bg-amber-50/20" : "shadow-sm")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Vencendo 30 dias</CardTitle>
                <Calendar className={cn("size-4", stats.vencendo30 > 0 ? "text-amber-600" : "text-muted-foreground")} />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold font-mono", stats.vencendo30 > 0 ? "text-amber-600" : "text-muted-foreground")}>
                  {stats.vencendo30}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Contrato(s) próximo(s) do vencimento
                </div>
              </CardContent>
            </Card>

            {/* Yield Médio */}
            <Card className="shadow-sm border-indigo-100 bg-indigo-50/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Rental Yield Médio</CardTitle>
                <Percent className="size-4 text-indigo-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono text-indigo-600">
                  {stats.yieldMedio.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Retorno médio mensal dos imóveis
                </div>
                <Progress value={stats.yieldMedio * 10} className="h-1.5 mt-3 bg-indigo-50" />
              </CardContent>
            </Card>

            {/* Inadimplência */}
            <Card className="shadow-sm border-red-100 bg-red-50/10">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Inadimplência (Mês)</CardTitle>
                <AlertTriangle className="size-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold font-mono", stats.taxaInadimplencia > 10 ? "text-destructive" : "text-amber-600")}>
                  {stats.taxaInadimplencia.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Aluguéis atrasados vs total do mês
                </div>
                <Progress value={stats.taxaInadimplencia} className="h-1.5 mt-3 bg-red-100/30" />
              </CardContent>
            </Card>
          </div>

          {/* Alertas de atenção */}
          {(stats.imoveisSemProprietario > 0 || stats.vencendo30 > 0) && (
            <div className="space-y-2">
              {stats.imoveisSemProprietario > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg border-amber-200 bg-amber-50/40 text-amber-800 text-sm">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{stats.imoveisSemProprietario} imóvel(eis) sem proprietário vinculado. Verifique a aba Imóveis.</span>
                </div>
              )}
              {stats.vencendo30 > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg border-blue-200 bg-blue-50/40 text-blue-800 text-sm">
                  <Calendar className="size-4 shrink-0" />
                  <span>{stats.vencendo30} contrato(s) vencendo nos próximos 30 dias. Confira na aba Locações.</span>
                </div>
              )}
            </div>
          )}

          {/* Gestão de Índices de Reajuste */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Percent className="size-4 text-indigo-600" /> Índices de Reajuste
                </CardTitle>
                <CardDescription>Últimos valores registrados dos índices IPCA, IGP-M e INPC.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setIndiceDialogOpen(true)} className="gap-2">
                <Plus className="size-3.5" />
                Adicionar Índice
              </Button>
            </CardHeader>
            <CardContent>
              {indices?.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Nenhum índice cadastrado. Adicione o IPCA, IGP-M ou INPC.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left font-medium text-muted-foreground pb-2">Índice</th>
                        <th className="text-right font-medium text-muted-foreground pb-2">Período</th>
                        <th className="text-right font-medium text-muted-foreground pb-2">Valor (%)</th>
                        <th className="text-right font-medium text-muted-foreground pb-2">Fonte</th>
                        <th className="w-[60px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {indices?.map((ind: any) => (
                        <tr key={ind.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2">
                            <Badge variant="outline" className="font-semibold">
                              {INDICE_LABELS[ind.indice_tipo] ?? ind.indice_tipo}
                            </Badge>
                          </td>
                          <td className="text-right py-2">{ind.periodo_ano}</td>
                          <td className="text-right py-2 font-semibold">
                            {ind.variacao_percentual != null
                              ? `${ind.variacao_percentual}%`
                              : fmtBRLRaw(ind.valor_indice * 100)}
                          </td>
                          <td className="text-right py-2 text-muted-foreground text-xs">
                            {ind.fonte}
                          </td>
                          <td className="text-right py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive hover:text-destructive"
                              onClick={() => deleteIndiceMutation.mutate(ind.id)}
                              disabled={deleteIndiceMutation.isPending}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Fluxo de Caixa Imobiliário */}
            <Card className="md:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-blue-600" /> Fluxo de Cobranças vs Repasses
                </CardTitle>
                <CardDescription>Comparativo dos aluguéis recebidos de inquilinos e repassados aos proprietários.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartFluxo}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="month" fontSize={11} stroke="#888" tickLine={false} />
                      <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <Tooltip formatter={(value: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)} />
                      <Legend />
                      <Bar dataKey="receitas" name="Aluguel Inquilinos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="repasses" name="Repasse Proprietários" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Categorias de Imóveis */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building className="size-4 text-blue-600" /> Categoria dos Imóveis
                </CardTitle>
                <CardDescription>Distribuição dos imóveis cadastrados na carteira.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.chartCategorias.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-xs text-muted-foreground">Nenhum imóvel cadastrado.</div>
                ) : (
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.chartCategorias}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.chartCategorias.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Dialog para adicionar índice */}
      <Dialog open={indiceDialogOpen} onOpenChange={setIndiceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Índice de Reajuste</DialogTitle>
            <DialogDescription>
              Registre o valor atual do índice para uso nos reajustes de aluguéis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Índice</label>
              <Select
                value={indiceForm.indice_tipo}
                onValueChange={(v) => setIndiceForm((f) => ({ ...f, indice_tipo: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipca">IPCA</SelectItem>
                  <SelectItem value="igp_m">IGP-M</SelectItem>
                  <SelectItem value="inpc">INPC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano/Período</label>
              <Input
                type="number"
                value={indiceForm.periodo_ano}
                onChange={(e) => setIndiceForm((f) => ({ ...f, periodo_ano: parseInt(e.target.value) || 0 }))}
                placeholder="2025"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Valor (variação %)</label>
              <Input
                type="number"
                step="0.01"
                value={indiceForm.valor_indice}
                onChange={(e) => setIndiceForm((f) => ({ ...f, valor_indice: e.target.value }))}
                placeholder="4.50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addIndiceMutation.mutate(indiceForm)}
              disabled={addIndiceMutation.isPending}
            >
              {addIndiceMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}