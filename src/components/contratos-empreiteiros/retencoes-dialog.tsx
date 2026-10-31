import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, Loader2, ArrowUpRight } from "lucide-react";
import { liberarRetencaoEmpreiteiroRPC } from "@/lib/contratos-empreiteiros.functions";

interface RetencoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retencoes: Array<{
    id: string;
    valor_retido_centavos: number;
    saldo_retido_centavos: number;
    status: string;
    created_at: string;
    medicoes_empreiteiros?: { numero: number; periodo_fim: string };
  }>;
  onRetencaoLiberada: () => void;
}

export function RetencoesDialog({
  open,
  onOpenChange,
  retencoes,
  onRetencaoLiberada,
}: RetencoesDialogProps) {
  const [retencaoSelecionada, setRetencaoSelecionada] = useState<any | null>(null);
  const [valorLiberarBRL, setValorLiberarBRL] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  const totalRetidoCentavos = retencoes.reduce((acc, r) => acc + Number(r.saldo_retido_centavos || 0), 0);

  const handleAbrirLiberacao = (retencao: any) => {
    setRetencaoSelecionada(retencao);
    const saldo = Number(retencao.saldo_retido_centavos || 0) / 100;
    setValorLiberarBRL(saldo.toFixed(2).replace(".", ","));
    setDataVencimento(new Date().toISOString().split("T")[0]);
    setObservacoes("");
  };

  const handleConfirmarLiberacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retencaoSelecionada) return;

    if (!dataVencimento) {
      toast.error("Informe a data de vencimento da conta a pagar gerada.");
      return;
    }

    const valorLimpo = valorLiberarBRL.replace(/\./g, "").replace(",", ".");
    const valorCentavos = Math.round((parseFloat(valorLimpo) || 0) * 100);

    if (valorCentavos <= 0) {
      toast.error("O valor a liberar deve ser maior que zero.");
      return;
    }

    if (valorCentavos > Number(retencaoSelecionada.saldo_retido_centavos)) {
      toast.error("O valor a liberar não pode exceder o saldo retido.");
      return;
    }

    setSalvando(true);
    try {
      await liberarRetencaoEmpreiteiroRPC(
        retencaoSelecionada.id,
        valorCentavos,
        dataVencimento,
        observacoes
      );
      toast.success("Retenção técnica liberada e conta a pagar gerada com sucesso!");
      setRetencaoSelecionada(null);
      onRetencaoLiberada();
    } catch (err: any) {
      toast.error(`Falha ao liberar retenção: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Controle de Retenções Técnicas
          </DialogTitle>
          <DialogDescription>
            Acompanhe o saldo retido em cada medição e realize a liberação programada no financeiro após a conclusão ou garantia.
          </DialogDescription>
        </DialogHeader>

        {retencaoSelecionada ? (
          <form onSubmit={handleConfirmarLiberacao} className="space-y-4 py-2 border rounded-md p-4 bg-slate-50">
            <div className="font-semibold text-sm text-slate-800">
              Liberar Retenção — Medição nº {retencaoSelecionada.medicoes_empreiteiros?.numero ?? "-"}
            </div>
            <div className="text-xs text-slate-600">
              Saldo disponível para liberação:{" "}
              <strong>
                {(Number(retencaoSelecionada.saldo_retido_centavos) / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </strong>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valor a Liberar (R$) *</Label>
                <Input
                  value={valorLiberarBRL}
                  onChange={(e) => setValorLiberarBRL(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Observações / Motivo da Liberação</Label>
              <Input
                placeholder="Ex: Liberação após termo de entrega definitiva da obra"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRetencaoSelecionada(null)}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Liberação e Gerar Pagamento"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-md">
              <span>
                Total de Retenções em Aberto:{" "}
                <strong>
                  {(totalRetidoCentavos / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </span>
              <span>{retencoes.length} registro(s)</span>
            </div>

            <div className="flex-1 border rounded-md overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-20">Medição</TableHead>
                    <TableHead className="text-right">Valor Retido</TableHead>
                    <TableHead className="text-right">Saldo Retido</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                    <TableHead className="w-28 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retencoes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-500">
                        Nenhuma retenção técnica aplicada neste contrato até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    retencoes.map((r) => {
                      const retido = Number(r.valor_retido_centavos || 0) / 100;
                      const saldo = Number(r.saldo_retido_centavos || 0) / 100;
                      const temSaldo = saldo > 0 && r.status !== "cancelada";

                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-xs">
                            BM-{r.medicoes_empreiteiros?.numero ?? "01"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {retido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-slate-900">
                            {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                r.status === "retida"
                                  ? "border-amber-500 text-amber-700 bg-amber-50 text-[10px]"
                                  : r.status === "liberada_total"
                                  ? "border-emerald-500 text-emerald-700 bg-emerald-50 text-[10px]"
                                  : "border-blue-500 text-blue-700 bg-blue-50 text-[10px]"
                              }
                            >
                              {r.status === "retida"
                                ? "Retida"
                                : r.status === "liberada_total"
                                ? "Liberada"
                                : "Parcial"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {temSaldo && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => handleAbrirLiberacao(r)}
                              >
                                Liberar <ArrowUpRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

