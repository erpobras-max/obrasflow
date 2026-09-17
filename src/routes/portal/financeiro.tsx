import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Loader2, DollarSign, Calendar, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { STATUS_RECEBER_BADGE, STATUS_RECEBER_LABEL, type StatusReceber } from "@/lib/financeiro.schema";

export const Route = createFileRoute("/portal/financeiro")({
  component: PortalFinanceiro,
});

interface ContaReceberRow {
  id: string;
  descricao: string;
  valor_total: number; // centavos
  data_vencimento: string;
  data_recebimento: string | null;
  valor_recebido: number | null; // centavos
  status: StatusReceber;
}

const fmtBRL = (v: number | null | undefined) => {
  const val = (v ?? 0) / 100;
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

function PortalFinanceiro() {
  const { obraId } = usePortalContext();

  // Fetch financial transactions for this obra (only accounts receivable, which represent what the client pays)
  const { data: contasReceber, isLoading, error } = useQuery({
    queryKey: ["portal-obra-financeiro", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contas_receber")
        .select("id, descricao, valor_total, data_vencimento, data_recebimento, valor_recebido, status")
        .eq("obra_id", obraId as string)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ContaReceberRow[];
    },
  });

  // Calculate totals
  const stats = useMemo(() => {
    const list = contasReceber ?? [];
    let totalContratado = 0;
    let pago = 0;
    let atrasado = 0;
    let pendente = 0;

    list.forEach((l) => {
      if (l.status === "cancelada") return;
      
      totalContratado += l.valor_total;
      
      if (l.status === "recebida") {
        pago += l.valor_recebido ?? l.valor_total;
      } else if (l.status === "atrasada") {
        atrasado += l.valor_total;
      } else if (l.status === "aberta") {
        pendente += l.valor_total;
      }
    });

    return {
      totalContratado,
      pago,
      atrasado,
      pendente,
      saldoDevedor: totalContratado - pago,
    };
  }, [contasReceber]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-destructive">Erro ao carregar dados financeiros</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Não conseguimos obter as informações de faturamento desta obra.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Contratado</span>
            <TrendingUp className="size-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-slate-800">{fmtBRL(stats.totalContratado)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Soma das parcelas acordadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Pago</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-emerald-600">{fmtBRL(stats.pago)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {stats.totalContratado > 0 
                ? `${((stats.pago / stats.totalContratado) * 100).toFixed(0)}% quitado` 
                : "0% quitado"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border shadow-sm">
          <CardHeader className="pb-1.5 flex flex-row items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Saldo Devedor</span>
            <DollarSign className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-blue-600">{fmtBRL(stats.saldoDevedor)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Valor restante a faturar</p>
          </CardContent>
        </Card>
      </div>

      {/* Warning if there are late payments */}
      {stats.atrasado > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide">Parcelas em Atraso Identificadas</h4>
            <p className="text-xs mt-0.5 text-amber-800/90">
              Identificamos <span className="font-bold">{fmtBRL(stats.atrasado)}</span> em parcelas pendentes de pagamento. Por favor, regularize junto ao setor financeiro.
            </p>
          </div>
        </div>
      )}

      {/* Installments Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Cronograma de Faturamento</h2>
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-500">Parcela / Descrição</TableHead>
                <TableHead className="text-xs font-bold text-slate-500">Vencimento</TableHead>
                <TableHead className="text-xs font-bold text-slate-500">Pagamento</TableHead>
                <TableHead className="text-xs font-bold text-slate-500">Status</TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-500">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasReceber && contasReceber.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                    <DollarSign className="size-8 mx-auto mb-2 opacity-30" />
                    Nenhum lançamento financeiro registrado para esta obra.
                  </TableCell>
                </TableRow>
              ) : (
                contasReceber?.map((l) => (
                  <TableRow key={l.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-slate-800 text-xs sm:text-sm">{l.descricao}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {format(parseISO(l.data_vencimento), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {l.data_recebimento ? format(parseISO(l.data_recebimento), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] py-0.5 px-2 border", STATUS_RECEBER_BADGE[l.status])}>
                        {STATUS_RECEBER_LABEL[l.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-xs sm:text-sm text-slate-700">
                      {fmtBRL(l.valor_total)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
