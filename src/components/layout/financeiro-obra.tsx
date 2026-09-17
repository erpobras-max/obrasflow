import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DollarSign, TrendingUp, TrendingDown, Percent, CreditCard, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { supabase } from "@/integrations/supabase/client.custom";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FinanceiroObraProps {
  obraId: string;
}

interface ContaReceber {
  valor_total: number;
  valor_recebido: number | null;
  status: string;
}

interface ContaPagar {
  valor_total: number;
  valor_pago: number | null;
  status: string;
}

const fmtBRL = (v: number | null | undefined) => {
  const val = (v ?? 0) / 100;
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export function FinanceiroObra({ obraId }: FinanceiroObraProps) {
  const { data: contasReceber, isLoading: loadingCR } = useQuery({
    queryKey: ["financeiro-obra-receber", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contas_receber")
        .select("valor_total, valor_recebido, status")
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as ContaReceber[];
    },
  });

  const { data: contasPagar, isLoading: loadingCP } = useQuery({
    queryKey: ["financeiro-obra-pagar", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contas_pagar")
        .select("valor_total, valor_pago, status")
        .eq("obra_id", obraId);
      if (error) throw error;
      return (data ?? []) as ContaPagar[];
    },
  });

  const stats = useMemo(() => {
    let receitaPrev = 0;
    let receitaReal = 0;
    let custoPrev = 0;
    let custoReal = 0;

    (contasReceber ?? []).forEach((cr) => {
      if (cr.status === "cancelada") return;
      receitaPrev += cr.valor_total;
      if (cr.status === "recebida") {
        receitaReal += cr.valor_recebido ?? cr.valor_total;
      }
    });

    (contasPagar ?? []).forEach((cp) => {
      if (cp.status === "cancelada") return;
      custoPrev += cp.valor_total;
      if (cp.status === "paga") {
        custoReal += cp.valor_pago ?? cp.valor_total;
      }
    });

    const lucroProjetado = receitaPrev - custoPrev;
    const lucroRealizado = receitaReal - custoReal;

    const margemProjetada = receitaPrev > 0 ? (lucroProjetado / receitaPrev) * 100 : 0;
    const margemRealizada = receitaReal > 0 ? (lucroRealizado / receitaReal) * 100 : 0;

    const percentRecebido = receitaPrev > 0 ? (receitaReal / receitaPrev) * 100 : 0;
    const percentPago = custoPrev > 0 ? (custoReal / custoPrev) * 100 : 0;

    return {
      receitaPrev,
      receitaReal,
      custoPrev,
      custoReal,
      lucroProjetado,
      lucroRealizado,
      margemProjetada,
      margemRealizada,
      percentRecebido,
      percentPago,
    };
  }, [contasReceber, contasPagar]);

  const chartData = [
    {
      name: "Receita",
      Previsto: stats.receitaPrev / 100,
      Realizado: stats.receitaReal / 100,
    },
    {
      name: "Custo",
      Previsto: stats.custoPrev / 100,
      Realizado: stats.custoReal / 100,
    },
  ];

  if (loadingCR || loadingCP) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-50/20 to-emerald-50/10 border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              Faturamento da Obra <TrendingUp className="size-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-2xl font-bold font-mono text-green-700">
                {fmtBRL(stats.receitaReal)}
              </div>
              <div className="text-xs text-muted-foreground">
                de {fmtBRL(stats.receitaPrev)} previstos
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Progresso de Recebimento</span>
                <span>{stats.percentRecebido.toFixed(0)}%</span>
              </div>
              <Progress value={stats.percentRecebido} className="h-1.5 bg-green-100 [&>div]:bg-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50/20 to-orange-50/10 border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              Custos Totais <TrendingDown className="size-4 text-red-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-2xl font-bold font-mono text-red-700">
                {fmtBRL(stats.custoReal)}
              </div>
              <div className="text-xs text-muted-foreground">
                de {fmtBRL(stats.custoPrev)} previstos
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span>Progresso de Pagamento</span>
                <span>{stats.percentPago.toFixed(0)}%</span>
              </div>
              <Progress value={stats.percentPago} className="h-1.5 bg-red-100 [&>div]:bg-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "bg-gradient-to-br border-blue-100",
          stats.lucroProjetado >= 0 ? "from-blue-50/20 to-sky-50/10" : "from-amber-50/20 to-orange-50/10"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
              Margem de Lucro <Percent className="size-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className={cn(
                "text-2xl font-bold font-mono",
                stats.lucroRealizado >= 0 ? "text-blue-700" : "text-amber-700"
              )}>
                {stats.margemRealizada.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Margem projetada: {stats.margemProjetada.toFixed(1)}%
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 border rounded bg-white/40">
                <div className="text-[10px] text-muted-foreground uppercase">Resultado Real</div>
                <div className="text-xs font-semibold font-mono">{fmtBRL(stats.lucroRealizado)}</div>
              </div>
              <div className="p-2 border rounded bg-white/40">
                <div className="text-[10px] text-muted-foreground uppercase">Resultado Prev</div>
                <div className="text-xs font-semibold font-mono">{fmtBRL(stats.lucroProjetado)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="size-4 text-primary" /> Balanço Receita vs Custo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip
                  formatter={(value: any) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value)
                  }
                />
                <Bar dataKey="Previsto" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realizado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="size-4 text-primary" /> Detalhamento do Fluxo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground">Indicador</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Previsto</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">Realizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-3 font-medium">Receita da Obra</td>
                    <td className="p-3 text-right font-mono">{fmtBRL(stats.receitaPrev)}</td>
                    <td className="p-3 text-right font-mono text-green-700">{fmtBRL(stats.receitaReal)}</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Custos da Obra</td>
                    <td className="p-3 text-right font-mono">{fmtBRL(stats.custoPrev)}</td>
                    <td className="p-3 text-right font-mono text-red-700">{fmtBRL(stats.custoReal)}</td>
                  </tr>
                  <tr className="bg-muted/10 font-semibold">
                    <td className="p-3">Resultado Líquido</td>
                    <td className="p-3 text-right font-mono">{fmtBRL(stats.lucroProjetado)}</td>
                    <td className={cn(
                      "p-3 text-right font-mono",
                      stats.lucroRealizado >= 0 ? "text-green-700" : "text-red-700"
                    )}>
                      {fmtBRL(stats.lucroRealizado)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
