import { useState, useMemo } from "react";
import {
  calcularFluxoCaixa,
  FluxoCaixaItemConta,
  GranularidadeFluxo,
  FluxoCaixaPeriodo,
} from "@/lib/fluxo-caixa";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Landmark,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FluxoCaixaAvancadoProps {
  contasReceber: any[];
  contasPagar: any[];
  contasBancarias: any[];
  obras: any[];
}

function fmtBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function FluxoCaixaAvancado({
  contasReceber,
  contasPagar,
  contasBancarias,
  obras,
}: FluxoCaixaAvancadoProps) {
  // Filtros
  const [granularidade, setGranularidade] = useState<GranularidadeFluxo>("diario");
  const [diasDiario, setDiasDiario] = useState<number>(30);
  const [filtroObraId, setFiltroObraId] = useState<string>("todas");
  const [filtroContaBancariaId, setFiltroContaBancariaId] = useState<string>("todas");

  // Modal para detalhar lançamentos de um período
  const [periodoDetalhe, setPeriodoDetalhe] = useState<FluxoCaixaPeriodo | null>(null);

  // Mapear todas as contas em formato padronizado
  const itensContas: FluxoCaixaItemConta[] = useMemo(() => {
    const lista: FluxoCaixaItemConta[] = [];

    (contasReceber || []).forEach((cr) => {
      lista.push({
        id: cr.id,
        tipo: "receber",
        descricao: cr.descricao,
        obra_id: cr.obra_id,
        obra_nome: cr.obras?.nome,
        conta_bancaria_id: cr.conta_bancaria_id,
        valor_total_centavos: cr.valor_total || 0,
        valor_liquidado_centavos: cr.valor_recebido,
        data_vencimento: cr.data_vencimento,
        data_liquidacao: cr.data_recebimento,
        status: cr.status,
        etapa_nome: cr.etapa_nome,
      });
    });

    (contasPagar || []).forEach((cp) => {
      lista.push({
        id: cp.id,
        tipo: "pagar",
        descricao: cp.descricao,
        obra_id: cp.obra_id,
        obra_nome: cp.obras?.nome,
        conta_bancaria_id: cp.conta_bancaria_id,
        valor_total_centavos: cp.valor_total || 0,
        valor_liquidado_centavos: cp.valor_pago,
        data_vencimento: cp.data_vencimento,
        data_liquidacao: cp.data_pagamento,
        status: cp.status,
        etapa_nome: cp.etapa_nome,
      });
    });

    return lista;
  }, [contasReceber, contasPagar]);

  // Saldo inicial total das contas bancárias
  const saldoInicialCentavos = useMemo(() => {
    if (filtroContaBancariaId !== "todas") {
      const conta = (contasBancarias || []).find((c) => c.id === filtroContaBancariaId);
      return conta ? conta.saldo_atual_centavos || 0 : 0;
    }
    return (contasBancarias || []).reduce(
      (acc, c) => acc + (c.saldo_atual_centavos || 0),
      0
    );
  }, [contasBancarias, filtroContaBancariaId]);

  // Execução do cálculo do fluxo de caixa
  const resumo = useMemo(() => {
    return calcularFluxoCaixa(itensContas, saldoInicialCentavos, {
      granularidade,
      obraId: filtroObraId,
      contaBancariaId: filtroContaBancariaId,
      diasProjecao: diasDiario,
      semanasProjecao: 8,
      mesesAnteriores: 2,
      mesesPosteriores: 4,
    });
  }, [
    itensContas,
    saldoInicialCentavos,
    granularidade,
    filtroObraId,
    filtroContaBancariaId,
    diasDiario,
  ]);

  // Dados para o Recharts (convertidos em Reais)
  const chartData = useMemo(() => {
    return resumo.periodos.map((p) => ({
      name: p.label,
      entradas: (p.totalEntradasCentavos || 0) / 100,
      saidas: (p.totalSaidasCentavos || 0) / 100,
      saldoAcumulado: (p.saldoFinalCentavos || 0) / 100,
      saldoNegativo: p.saldoNegativo,
    }));
  }, [resumo.periodos]);

  const temAlertaNegativo = resumo.menorSaldoProjetadoCentavos < 0;

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Controles */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Seletor de Período / Visão */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">
                Visualização:
              </span>
              <Button
                size="sm"
                variant={granularidade === "diario" && diasDiario === 30 ? "default" : "outline"}
                onClick={() => {
                  setGranularidade("diario");
                  setDiasDiario(30);
                }}
              >
                Diário (30 dias)
              </Button>
              <Button
                size="sm"
                variant={granularidade === "diario" && diasDiario === 60 ? "default" : "outline"}
                onClick={() => {
                  setGranularidade("diario");
                  setDiasDiario(60);
                }}
              >
                Diário (60 dias)
              </Button>
              <Button
                size="sm"
                variant={granularidade === "semanal" ? "default" : "outline"}
                onClick={() => setGranularidade("semanal")}
              >
                Semanal (8 sem.)
              </Button>
              <Button
                size="sm"
                variant={granularidade === "mensal" ? "default" : "outline"}
                onClick={() => setGranularidade("mensal")}
              >
                Mensal (Histórico + Projeção)
              </Button>
            </div>

            {/* Filtros de Obra e Conta Bancária */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro por Obra */}
              <div className="flex items-center gap-1.5 min-w-[200px]">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <Select value={filtroObraId} onValueChange={setFiltroObraId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas as obras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Obras</SelectItem>
                    {(obras || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Conta Bancária */}
              <div className="flex items-center gap-1.5 min-w-[200px]">
                <Landmark className="size-4 text-muted-foreground shrink-0" />
                <Select
                  value={filtroContaBancariaId}
                  onValueChange={setFiltroContaBancariaId}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas as contas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Contas Bancárias</SelectItem>
                    {(contasBancarias || []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_conta} ({c.banco})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Saldo Inicial */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold uppercase flex items-center gap-1.5 text-blue-700">
              <Wallet className="size-3.5" /> Saldo Inicial (Caixa/Bancos)
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono">
              {fmtBRL(resumo.saldoInicialCentavos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-[11px] text-muted-foreground">
            Disponível no início do período
          </CardContent>
        </Card>

        {/* Entradas */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold uppercase flex items-center gap-1.5 text-emerald-700">
              <TrendingUp className="size-3.5" /> Entradas Previstas
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-emerald-700">
              {fmtBRL(resumo.totalEntradasCentavos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-[11px] text-muted-foreground">
            Recebíveis no período
          </CardContent>
        </Card>

        {/* Saídas */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold uppercase flex items-center gap-1.5 text-rose-700">
              <TrendingDown className="size-3.5" /> Saídas Previstas
            </CardDescription>
            <CardTitle className="text-xl font-bold font-mono text-rose-700">
              {fmtBRL(resumo.totalSaidasCentavos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-[11px] text-muted-foreground">
            Pagamentos no período
          </CardContent>
        </Card>

        {/* Resultado Operacional */}
        <Card
          className={cn(
            "border-l-4",
            resumo.resultadoPeriodoCentavos >= 0
              ? "border-l-teal-500"
              : "border-l-amber-500"
          )}
        >
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold uppercase flex items-center gap-1.5">
              Net Operacional
            </CardDescription>
            <CardTitle
              className={cn(
                "text-xl font-bold font-mono",
                resumo.resultadoPeriodoCentavos >= 0
                  ? "text-teal-700"
                  : "text-amber-700"
              )}
            >
              {fmtBRL(resumo.resultadoPeriodoCentavos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-[11px] text-muted-foreground">
            Entradas (-) Saídas
          </CardContent>
        </Card>

        {/* Saldo Final Projetado & Alerta */}
        <Card
          className={cn(
            "border-l-4",
            temAlertaNegativo
              ? "border-l-red-600 bg-red-50/30"
              : "border-l-primary bg-primary/5"
          )}
        >
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs font-semibold uppercase flex items-center gap-1.5">
              {temAlertaNegativo ? (
                <span className="text-red-700 flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> Atenção de Caixa
                </span>
              ) : (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Saldo Final Projetado
                </span>
              )}
            </CardDescription>
            <CardTitle
              className={cn(
                "text-xl font-bold font-mono",
                resumo.saldoFinalProjetadoCentavos >= 0
                  ? "text-primary"
                  : "text-red-700"
              )}
            >
              {fmtBRL(resumo.saldoFinalProjetadoCentavos)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-[11px]">
            {temAlertaNegativo ? (
              <span className="text-red-700 font-semibold">
                Menor saldo: {fmtBRL(resumo.menorSaldoProjetadoCentavos)} ({resumo.dataMenorSaldo})
              </span>
            ) : (
              <span className="text-muted-foreground">Posição projetada ao término</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Visual de Evolução do Saldo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Trajetória do Fluxo de Caixa ({granularidade === "diario" ? "Diário" : granularidade === "semanal" ? "Semanal" : "Mensal"})
          </CardTitle>
          <CardDescription className="text-xs">
            Evolução das entradas, saídas e projeção da curva de saldo acumulado em caixa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  interval={granularidade === "diario" ? 2 : 0}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#888888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip
                  formatter={(value: any) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(value))
                  }
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="entradas"
                  name="Entradas"
                  fill="#22c55e"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="saidas"
                  name="Saídas"
                  fill="#ef4444"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="saldoAcumulado"
                  name="Saldo Projetado (Acumulado)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada com Saldo Acumulado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Demonstrativo Analítico do Fluxo de Caixa
          </CardTitle>
          <CardDescription className="text-xs">
            Posição inicial, movimentações previstas e saldo final por intervalo de tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Período / Data</TableHead>
                  <TableHead className="text-right">Saldo Inicial</TableHead>
                  <TableHead className="text-right text-emerald-700">Entradas</TableHead>
                  <TableHead className="text-right text-rose-700">Saídas</TableHead>
                  <TableHead className="text-right">Net Operacional</TableHead>
                  <TableHead className="text-right font-bold">Saldo Final Projetado</TableHead>
                  <TableHead className="text-center w-24">Lançamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.periodos.map((p) => {
                  return (
                    <TableRow
                      key={p.chave}
                      className={cn(
                        p.saldoNegativo ? "bg-red-50/40 hover:bg-red-50/60" : ""
                      )}
                    >
                      <TableCell className="font-medium text-xs">
                        {p.label}
                        {p.saldoNegativo && (
                          <Badge
                            variant="destructive"
                            className="ml-2 text-[10px] py-0 px-1"
                          >
                            Déficit
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtBRL(p.saldoInicialCentavos)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700">
                        {fmtBRL(p.totalEntradasCentavos)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-700">
                        {fmtBRL(p.totalSaidasCentavos)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs font-semibold",
                          p.resultadoCentavos >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        )}
                      >
                        {fmtBRL(p.resultadoCentavos)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-xs font-bold",
                          p.saldoFinalCentavos >= 0
                            ? "text-slate-900"
                            : "text-red-700 font-extrabold"
                        )}
                      >
                        {fmtBRL(p.saldoFinalCentavos)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.itens.length > 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-primary gap-1"
                            onClick={() => setPeriodoDetalhe(p)}
                          >
                            <Eye className="size-3.5" />
                            <span>{p.itens.length}</span>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal para visualizar as contas do período clicado */}
      <Dialog
        open={Boolean(periodoDetalhe)}
        onOpenChange={(op) => !op && setPeriodoDetalhe(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-6">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              Lançamentos Previstos — {periodoDetalhe?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pt-2">
            {(periodoDetalhe?.itens || []).map((it) => {
              const ehReceber = it.tipo === "receber";
              return (
                <div
                  key={it.id}
                  className="p-3 border rounded-md flex items-center justify-between gap-3 text-xs bg-card"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={ehReceber ? "default" : "destructive"}
                        className={cn(
                          "text-[10px] py-0 px-1.5",
                          ehReceber
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-rose-600 hover:bg-rose-700"
                        )}
                      >
                        {ehReceber ? "Recebível" : "Pagamento"}
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {it.descricao}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-[11px] flex gap-2">
                      {it.obra_nome && <span>Obra: {it.obra_nome}</span>}
                      {it.etapa_nome && <span>• Etapa: {it.etapa_nome}</span>}
                      <span>• Venc: {it.data_vencimento}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={cn(
                        "font-mono font-bold text-sm block",
                        ehReceber ? "text-emerald-700" : "text-rose-700"
                      )}
                    >
                      {ehReceber ? "+" : "-"}
                      {fmtBRL(it.valor_total_centavos)}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {it.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
