import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import {
  parseOfx,
  sugerirConciliacaoParaTransacao,
  type OfxExtrato,
  type OfxTransacao,
  type SugestaoConciliacao,
} from "@/lib/financeiro-ofx";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ConciliacaoOfxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contasBancarias: Array<{ id: string; nome: string; banco?: string }>;
  contasReceber: any[];
  contasPagar: any[];
  onSuccess: () => void;
}

export function ConciliacaoOfxDialog({
  open,
  onOpenChange,
  contasBancarias,
  contasReceber,
  contasPagar,
  onSuccess,
}: ConciliacaoOfxDialogProps) {
  const [contaBancariaId, setContaBancariaId] = useState<string>("");
  const [extrato, setExtrato] = useState<OfxExtrato | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [processando, setProcessando] = useState(false);
  const [conciliadosLocal, setConciliadosLocal] = useState<Set<string>>(new Set());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNomeArquivo(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseOfx(text);
        if (!parsed.transacoes || parsed.transacoes.length === 0) {
          toast.error("Nenhuma transação encontrada no arquivo OFX");
          return;
        }
        setExtrato(parsed);
        setConciliadosLocal(new Set());
        toast.success(`${parsed.transacoes.length} transações importadas do extrato`);
      } catch (err: any) {
        toast.error("Erro ao ler arquivo OFX: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Prepara lista combinada de contas para sugestão de match
  const contasParaMatch = useMemo(() => {
    const lista: Array<{
      id: string;
      tipo: "receber" | "pagar";
      descricao: string;
      valorCentavos: number;
      dataVencimento: string;
      documento?: string | null;
      status: string;
    }> = [];

    (contasReceber || []).forEach((cr) => {
      if (cr.status !== "cancelada") {
        lista.push({
          id: cr.id,
          tipo: "receber",
          descricao: cr.descricao,
          valorCentavos: cr.valor_total + (cr.valor_aditivo || 0),
          dataVencimento: cr.data_vencimento,
          documento: cr.numero_documento,
          status: cr.status,
        });
      }
    });

    (contasPagar || []).forEach((cp) => {
      if (cp.status !== "cancelada") {
        lista.push({
          id: cp.id,
          tipo: "pagar",
          descricao: cp.descricao,
          valorCentavos: cp.valor_total,
          dataVencimento: cp.data_vencimento,
          documento: cp.numero_documento,
          status: cp.status,
        });
      }
    });

    return lista;
  }, [contasReceber, contasPagar]);

  // Mapa de sugestões para cada transação
  const sugestoesMap = useMemo(() => {
    const map = new Map<string, SugestaoConciliacao | null>();
    if (!extrato) return map;

    extrato.transacoes.forEach((t) => {
      const match = sugerirConciliacaoParaTransacao(t, contasParaMatch);
      map.set(t.id, match);
    });

    return map;
  }, [extrato, contasParaMatch]);

  const handleConciliar = async (t: OfxTransacao, sugestao: SugestaoConciliacao) => {
    setProcessando(true);
    try {
      if (sugestao.tipo === "receber") {
        const { error } = await (supabase as any)
          .from("contas_receber")
          .update({
            status: "recebida",
            data_recebimento: t.data,
            valor_recebido: t.valorCentavos,
            conta_bancaria_id: contaBancariaId || null,
            conciliado: true,
          })
          .eq("id", sugestao.contaId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("contas_pagar")
          .update({
            status: "paga",
            data_pagamento: t.data,
            valor_pago: t.valorCentavos,
            conta_bancaria_id: contaBancariaId || null,
            conciliado: true,
          })
          .eq("id", sugestao.contaId);
        if (error) throw error;
      }

      setConciliadosLocal((prev) => new Set([...prev, t.id]));
      toast.success("Lançamento conciliado e compensado com sucesso!");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Erro ao conciliar");
    } finally {
      setProcessando(false);
    }
  };

  const handleCriarLancamentoDireto = async (t: OfxTransacao) => {
    setProcessando(true);
    try {
      if (t.tipo === "credito") {
        const { error } = await (supabase as any).from("contas_receber").insert({
          descricao: t.descricao || "Receita conciliada via OFX",
          valor_total: t.valorCentavos,
          data_vencimento: t.data,
          status: "recebida",
          data_recebimento: t.data,
          valor_recebido: t.valorCentavos,
          conta_bancaria_id: contaBancariaId || null,
          numero_documento: t.documento || null,
          observacoes: `Criado automaticamente por importação OFX (FITID: ${t.fitid})`,
          conciliado: true,
          origem: "erp",
        });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("contas_pagar").insert({
          descricao: t.descricao || "Despesa bancária conciliada via OFX",
          valor_total: t.valorCentavos,
          data_vencimento: t.data,
          status: "paga",
          data_pagamento: t.data,
          valor_pago: t.valorCentavos,
          conta_bancaria_id: contaBancariaId || null,
          numero_documento: t.documento || null,
          observacoes: `Criado automaticamente por importação OFX (FITID: ${t.fitid})`,
          conciliado: true,
          origem: "erp",
        });
        if (error) throw error;
      }

      setConciliadosLocal((prev) => new Set([...prev, t.id]));
      toast.success("Lançamento rápido criado e conciliado!");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar lançamento direto");
    } finally {
      setProcessando(false);
    }
  };

  const formatBRL = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Conciliação Bancária com Extrato OFX
          </DialogTitle>
          <DialogDescription>
            Importe o extrato `.ofx` fornecido pelo internet banking para conferir lançamentos e conciliar automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Upload & Bank Account Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/20">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Conta Bancária Associada</label>
            <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue placeholder="Selecione a conta do extrato..." />
              </SelectTrigger>
              <SelectContent>
                {contasBancarias.map((cb) => (
                  <SelectItem key={cb.id} value={cb.id}>
                    {cb.nome} {cb.banco ? `(${cb.banco})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Arquivo de Extrato (.ofx)</label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer">
                <div className="h-9 border border-input rounded-md bg-background px-3 flex items-center justify-between text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                  <span className="truncate">{nomeArquivo || "Clique para escolher o arquivo .ofx..."}</span>
                  <Upload className="size-4 shrink-0 text-primary" />
                </div>
                <input
                  type="file"
                  accept=".ofx,.OFX"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Resumo do Extrato se carregado */}
        {extrato && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border bg-card text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Banco / Conta</span>
              <span className="font-semibold">{extrato.bancoId || "Bco"} - {extrato.conta || "Conta"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Período</span>
              <span className="font-semibold">{extrato.dataInicio || "—"} até {extrato.dataFim || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Total Transações</span>
              <span className="font-semibold">{extrato.transacoes.length} lançamentos</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Saldo Final Informado</span>
              <span className="font-semibold font-mono text-primary">
                {extrato.saldoFinalCentavos !== undefined ? formatBRL(extrato.saldoFinalCentavos) : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Tabela de Transações OFX */}
        {extrato && extrato.transacoes.length > 0 ? (
          <div className="rounded-md border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead>Extrato Bancário</TableHead>
                  <TableHead className="text-right w-28">Valor</TableHead>
                  <TableHead>Correspondência Sugerida</TableHead>
                  <TableHead className="text-right w-36">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extrato.transacoes.map((t) => {
                  const jaConciliado = conciliadosLocal.has(t.id);
                  const sugestao = sugestoesMap.get(t.id);

                  return (
                    <TableRow key={t.id} className={jaConciliado ? "bg-green-50/40" : undefined}>
                      <TableCell className="text-xs font-mono">{t.data}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium flex items-center gap-1.5">
                          {t.tipo === "credito" ? (
                            <ArrowDownRight className="size-3.5 text-green-600 shrink-0" />
                          ) : (
                            <ArrowUpRight className="size-3.5 text-red-600 shrink-0" />
                          )}
                          <span className="truncate max-w-[240px]">{t.descricao}</span>
                        </div>
                        {t.documento && (
                          <div className="text-[10px] text-muted-foreground font-mono">Doc: {t.documento}</div>
                        )}
                      </TableCell>
                      <TableCell className={cn("text-right text-xs font-mono font-bold", t.tipo === "credito" ? "text-green-700" : "text-red-700")}>
                        {t.tipo === "credito" ? "+" : "-"}{formatBRL(t.valorCentavos)}
                      </TableCell>
                      <TableCell>
                        {jaConciliado ? (
                          <Badge variant="outline" className="text-[10px] bg-green-100 text-green-800 border-green-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="size-3" /> Conciliado
                          </Badge>
                        ) : sugestao ? (
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium truncate max-w-[220px]">
                              {sugestao.descricao}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] py-0 px-1 font-normal",
                                  sugestao.score === "exato"
                                    ? "bg-green-100 text-green-800"
                                    : sugestao.score === "alto"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-amber-100 text-amber-800"
                                )}
                              >
                                {sugestao.score === "exato" ? "Match Exato" : sugestao.score === "alto" ? "Match Alto" : "Match Sugerido"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-mono">Venc: {sugestao.dataVencimento}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <HelpCircle className="size-3" /> Sem lançamento correspondente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {jaConciliado ? (
                          <span className="text-xs text-green-700 font-semibold">✓ Concluído</span>
                        ) : sugestao ? (
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                            disabled={processando}
                            onClick={() => handleConciliar(t, sugestao)}
                          >
                            <CheckCircle2 className="size-3.5" /> Baixar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            disabled={processando}
                            onClick={() => handleCriarLancamentoDireto(t)}
                          >
                            <Plus className="size-3.5" /> Criar Lançamento
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
            <FileText className="size-10 mx-auto mb-2 opacity-30 text-primary" />
            <p className="text-sm font-medium">Nenhum arquivo OFX carregado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Selecione sua conta bancária acima e escolha o arquivo `.ofx` para iniciar a conciliação.
            </p>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

