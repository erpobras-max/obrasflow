import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Ruler,
  CheckCircle2,
  XCircle,
  Printer,
  Share2,
  Save,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  FileText,
  Camera,
} from "lucide-react";
import { MedicaoAnexos } from "./medicao-anexos";
import { MedicaoStatusBadge } from "./contrato-status-badge";
import {
  converterEntradaMedicao,
  calcularSaldoItem,
  calcularResumoMedicao,
} from "@/lib/contratos-empreiteiros";
import {
  salvarItensBoletimMedicao,
  aprovarMedicaoEmpreiteiroRPC,
  cancelarMedicaoEmpreiteiroRPC,
} from "@/lib/contratos-empreiteiros.functions";

interface MedicaoEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contrato: any;
  medicao: any;
  itensContrato: any[];
  onMedicaoSalva: () => void;
  onAbrirImpressao?: (medicaoId: string) => void;
}

interface LinhaMedicaoState {
  itemServicoId: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  etapa: string;
  quantidadeContratada: number;
  precoUnitarioCentavos: number;
  valorTotalContratadoCentavos: number;
  quantidadeAnterior: number;
  percentualAnterior: number;
  modoEntrada: "quantidade" | "percentual" | "valor";
  quantidadeAtual: number;
  percentualAtual: number;
  valorCentavosAtual: number;
  quantidadeAcumulada: number;
  saldoQuantidade: number;
  estouro: boolean;
}

interface AjusteState {
  tipo: "desconto" | "amortizacao_adiantamento" | "retencao_tecnica" | "tributo" | "outro";
  descricao: string;
  valorCentavos: number;
}

export function MedicaoEditorSheet({
  open,
  onOpenChange,
  contrato,
  medicao,
  itensContrato,
  onMedicaoSalva,
  onAbrirImpressao,
}: MedicaoEditorSheetProps) {
  const [linhas, setLinhas] = useState<LinhaMedicaoState[]>([]);
  const [ajustes, setAjustes] = useState<AjusteState[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [dialogAprovarOpen, setDialogAprovarOpen] = useState(false);
  const [dialogCancelarOpen, setDialogCancelarOpen] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [dialogAnexosOpen, setDialogAnexosOpen] = useState(false);

  // Inicializar estado ao carregar medição
  useEffect(() => {
    if (!open || !medicao) return;

    setPeriodoInicio(medicao.periodo_inicio || "");
    setPeriodoFim(medicao.periodo_fim || "");
    setDataVencimento(medicao.data_vencimento || "");
    setObservacoes(medicao.observacoes || "");

    const carregarLinhas = async () => {
      // 1. Buscar medições existentes desse boletim
      const { data: medTerceirizados } = await supabase
        .from("medicoes_terceirizados")
        .select("*")
        .eq("medicao_empreiteiro_id", medicao.id);

      const mapExistentes = new Map(
        (medTerceirizados || []).map((m: any) => [m.servico_id, m])
      );

      // 2. Buscar acumulado das medições anteriores aprovadas desse contrato
      const { data: medicoesAnteriores } = await supabase
        .from("medicoes_empreiteiros")
        .select("id")
        .eq("contrato_empreiteiro_id", contrato.id)
        .lt("numero", medicao.numero)
        .in("status", ["aprovada", "paga"]);

      const idsAnteriores = (medicoesAnteriores || []).map((m: any) => m.id);

      const mapQtdAnterior = new Map<string, number>();
      if (idsAnteriores.length > 0) {
        const { data: itensAnteriores } = await supabase
          .from("medicoes_terceirizados")
          .select("servico_id, quantidade_executada")
          .in("medicao_empreiteiro_id", idsAnteriores);

        (itensAnteriores || []).forEach((ia: any) => {
          const anterior = mapQtdAnterior.get(ia.servico_id) || 0;
          mapQtdAnterior.set(ia.servico_id, anterior + Number(ia.quantidade_executada || ia.quantidade || 0));
        });
      }

      // 3. Montar linhas com histórico
      const novasLinhas: LinhaMedicaoState[] = itensContrato.map((item: any) => {
        const qtdContratada = Number(item.quantidadeContratada || item.quantidade_total || item.quantidade || 0);
        const precoUnit = Number(item.precoUnitarioCentavos || 0);
        const qtdAnterior = mapQtdAnterior.get(item.id) || 0;
        const pctAnterior = qtdContratada > 0 ? (qtdAnterior / qtdContratada) * 100 : 0;

        const regExistente = mapExistentes.get(item.id);
        const qtdAtual = regExistente ? Number(regExistente.quantidade_executada || regExistente.quantidade || 0) : 0;
        const modo = (regExistente?.modo_entrada as any) || "quantidade";
        const valorCentavos = regExistente
          ? Number(regExistente.valor_centavos || Math.round(qtdAtual * precoUnit))
          : Math.round(qtdAtual * precoUnit);
        const pctAtual = qtdContratada > 0 ? (qtdAtual / qtdContratada) * 100 : 0;

        const saldo = calcularSaldoItem(qtdContratada, qtdAnterior, qtdAtual);

        return {
          itemServicoId: item.id,
          codigo: item.codigo || null,
          descricao: item.descricao,
          unidade: item.unidade,
          etapa: item.etapa || "Geral",
          quantidadeContratada: qtdContratada,
          precoUnitarioCentavos: precoUnit,
          valorTotalContratadoCentavos: Math.round(qtdContratada * precoUnit),
          quantidadeAnterior: qtdAnterior,
          percentualAnterior: Math.round(pctAnterior * 100) / 100,
          modoEntrada: modo,
          quantidadeAtual: qtdAtual,
          percentualAtual: Math.round(pctAtual * 100) / 100,
          valorCentavosAtual: valorCentavos,
          quantidadeAcumulada: saldo.quantidadeAcumulada,
          saldoQuantidade: saldo.saldoQuantidade,
          estouro: saldo.estouro,
        };
      });

      setLinhas(novasLinhas);

      // 4. Carregar ajustes da medição
      const { data: ajDb } = await supabase
        .from("medicao_empreiteiro_ajustes")
        .select("*")
        .eq("medicao_empreiteiro_id", medicao.id);

      if (ajDb && ajDb.length > 0) {
        setAjustes(
          ajDb.map((a: any) => ({
            tipo: a.tipo,
            descricao: a.descricao,
            valorCentavos: Number(a.valor_centavos || 0),
          }))
        );
      } else {
        // Inicializar com retenção padrão do contrato caso configurada
        const retencaoPadrao = Number(contrato.retencao_padrao_percentual || 0);
        if (retencaoPadrao > 0) {
          setAjustes([
            {
              tipo: "retencao_tecnica",
              descricao: `Retenção Técnica Contratual (${retencaoPadrao}%)`,
              valorCentavos: 0,
            },
          ]);
        } else {
          setAjustes([]);
        }
      }
    };

    carregarLinhas();
  }, [open, medicao, contrato, itensContrato]);

  // Recalcular linha ao digitar
  const atualizarLinhaInput = (
    index: number,
    tipoAlteracao: "quantidade" | "percentual" | "valor",
    valorDigitado: number
  ) => {
    setLinhas((prev) => {
      const clone = [...prev];
      const linha = clone[index];

      const conv = converterEntradaMedicao(
        tipoAlteracao,
        valorDigitado,
        linha.quantidadeContratada,
        linha.precoUnitarioCentavos
      );

      const saldo = calcularSaldoItem(
        linha.quantidadeContratada,
        linha.quantidadeAnterior,
        conv.quantidade
      );

      clone[index] = {
        ...linha,
        modoEntrada: tipoAlteracao,
        quantidadeAtual: conv.quantidade,
        percentualAtual: conv.percentual,
        valorCentavosAtual: conv.valorCentavos,
        quantidadeAcumulada: saldo.quantidadeAcumulada,
        saldoQuantidade: saldo.saldoQuantidade,
        estouro: saldo.estouro,
      };

      return clone;
    });
  };

  // Resumo financeiro do boletim
  const totalBrutoCentavos = linhas.reduce((acc, l) => acc + l.valorCentavosAtual, 0);

  // Se houver retenção percentual automática, recalcular base
  useEffect(() => {
    const retencaoPct = Number(contrato.retencao_padrao_percentual || 0);
    if (retencaoPct > 0) {
      setAjustes((prev) =>
        prev.map((aj) => {
          if (aj.tipo === "retencao_tecnica") {
            const valorRetencao = Math.round(totalBrutoCentavos * (retencaoPct / 100));
            return { ...aj, valorCentavos: valorRetencao };
          }
          return aj;
        })
      );
    }
  }, [totalBrutoCentavos, contrato.retencao_padrao_percentual]);

  const totalDeducoesCentavos = ajustes.reduce((acc, a) => acc + a.valorCentavos, 0);
  const totalLiquidoCentavos = Math.max(0, totalBrutoCentavos - totalDeducoesCentavos);

  const adicionarAjuste = (tipo: AjusteState["tipo"]) => {
    const nomes: Record<AjusteState["tipo"], string> = {
      desconto: "Desconto (EPI / Ferramentas / Retrabalho)",
      amortizacao_adiantamento: "Amortização de Adiantamento",
      retencao_tecnica: "Retenção Técnica de Garantia",
      tributo: "Retenção de Impostos (ISS / INSS)",
      outro: "Outro Ajuste",
    };
    setAjustes((prev) => [
      ...prev,
      {
        tipo,
        descricao: nomes[tipo],
        valorCentavos: 0,
      },
    ]);
  };

  const removerAjuste = (index: number) => {
    setAjustes((prev) => prev.filter((_, i) => i !== index));
  };

  const atualizarAjusteValor = (index: number, valorBRL: string) => {
    const limpo = valorBRL.replace(/\./g, "").replace(",", ".");
    const centavos = Math.round((parseFloat(limpo) || 0) * 100);
    setAjustes((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], valorCentavos: centavos };
      return clone;
    });
  };

  const handleSalvarRascunho = async () => {
    setSalvando(true);
    try {
      // 1. Atualizar datas
      await supabase
        .from("medicoes_empreiteiros")
        .update({
          periodo_inicio: periodoInicio || null,
          periodo_fim: periodoFim || null,
          data_vencimento: dataVencimento || null,
          observacoes: observacoes || null,
        })
        .eq("id", medicao.id);

      // 2. Salvar linhas e ajustes
      await salvarItensBoletimMedicao(
        medicao.id,
        contrato.id,
        linhas.map((l) => ({
          itemServicoId: l.itemServicoId,
          modoEntrada: l.modoEntrada,
          quantidadeAtual: l.quantidadeAtual,
          percentualAtual: l.percentualAtual,
          valorCentavos: l.valorCentavosAtual,
          quantidadeAnterior: l.quantidadeAnterior,
          quantidadeAcumulada: l.quantidadeAcumulada,
          saldoQuantidade: l.saldoQuantidade,
        })),
        ajustes
      );

      toast.success("Boletim de medição salvo com sucesso.");
      onMedicaoSalva();
    } catch (err: any) {
      toast.error(`Erro ao salvar medição: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarAprovacao = async () => {
    setAprovando(true);
    try {
      // Primeiro salvar dados atuais
      await handleSalvarRascunho();

      // Disparar RPC de aprovação
      await aprovarMedicaoEmpreiteiroRPC(medicao.id);
      toast.success(
        "Medição aprovada com sucesso! Conta a pagar gerada no módulo Financeiro."
      );
      setDialogAprovarOpen(false);
      onMedicaoSalva();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Falha ao aprovar medição: ${err.message}`);
    } finally {
      setAprovando(false);
    }
  };

  const handleConfirmarCancelamento = async () => {
    if (!motivoCancelamento.trim()) {
      toast.error("Informe a justificativa do cancelamento.");
      return;
    }
    setCancelando(true);
    try {
      await cancelarMedicaoEmpreiteiroRPC(medicao.id, motivoCancelamento.trim());
      toast.success("Medição cancelada e financeiro estornado.");
      setDialogCancelarOpen(false);
      onMedicaoSalva();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Falha ao cancelar: ${err.message}`);
    } finally {
      setCancelando(false);
    }
  };

  const isAprovadaOuPaga = medicao?.status === "aprovada" || medicao?.status === "paga";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Ruler className="h-5 w-5 text-blue-600" />
                <DialogTitle className="text-lg">
                  Boletim de Medição nº {String(medicao?.numero || 1).padStart(2, "0")} — {contrato?.numero}
                </DialogTitle>
                <MedicaoStatusBadge status={medicao?.status || "rascunho"} />
              </div>
              <DialogDescription className="text-xs mt-1">
                Obra: <strong>{contrato?.obras?.nome}</strong> • Empreiteiro:{" "}
                <strong>{contrato?.fornecedores?.nome_fantasia || contrato?.fornecedores?.razao_social || 'Prestador'}</strong>
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setDialogAnexosOpen(true)}
              >
                <Camera className="h-3.5 w-3.5 mr-1 text-blue-600" />
                Fotos & Link
              </Button>
              {onAbrirImpressao && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onAbrirImpressao(medicao.id)}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Imprimir / PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Dados gerais da medição */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2 bg-slate-50 p-3 rounded-md text-xs">
            <div>
              <Label className="text-[11px] font-medium text-slate-500">Período Início</Label>
              <Input
                type="date"
                disabled={isAprovadaOuPaga}
                value={periodoInicio}
                onChange={(e) => setPeriodoInicio(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium text-slate-500">Período Fim</Label>
              <Input
                type="date"
                disabled={isAprovadaOuPaga}
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium text-slate-500">Data Vencimento (Conta a Pagar)</Label>
              <Input
                type="date"
                disabled={isAprovadaOuPaga}
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-[11px] font-medium text-slate-500">Observações</Label>
              <Input
                disabled={isAprovadaOuPaga}
                placeholder="Obs do boletim..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="h-8 text-xs bg-white"
              />
            </div>
          </div>

          {/* Planilha de Medição Multi-Itens */}
          <div className="flex-1 overflow-hidden border rounded-md flex flex-col">
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="bg-slate-100 text-xs sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[200px]">Descrição do Serviço</TableHead>
                    <TableHead className="w-14 text-center">Un.</TableHead>
                    <TableHead className="w-24 text-right">Contratado</TableHead>
                    <TableHead className="w-24 text-right">Preço Unit.</TableHead>
                    <TableHead className="w-24 text-right bg-slate-200/60">Med. Anterior</TableHead>
                    <TableHead className="w-40 text-center bg-blue-50/70 border-x border-blue-200">
                      Medição Atual
                    </TableHead>
                    <TableHead className="w-28 text-right bg-blue-50/70 border-r border-blue-200">
                      Valor Medido
                    </TableHead>
                    <TableHead className="w-24 text-right bg-slate-200/60">Acumulado</TableHead>
                    <TableHead className="w-24 text-right">Saldo Físico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {linhas.map((linha, idx) => {
                    const preco = linha.precoUnitarioCentavos / 100;
                    const valorMedido = linha.valorCentavosAtual / 100;

                    return (
                      <TableRow
                        key={linha.itemServicoId}
                        className={linha.estouro ? "bg-rose-50/70" : undefined}
                      >
                        <TableCell className="text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-900">{linha.descricao}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {linha.codigo ? `${linha.codigo} • ` : ""}
                            {linha.etapa}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono">{linha.unidade}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(linha.quantidadeContratada || 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(preco || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right bg-slate-50/50">
                          <div>{Number(linha.quantidadeAnterior || 0).toLocaleString("pt-BR")}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {Number(linha.percentualAnterior || 0).toFixed(1)}%
                          </div>
                        </TableCell>

                        {/* Medição Atual Dinâmica */}
                        <TableCell className="bg-blue-50/30 border-x border-blue-100 p-1">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="any"
                              disabled={isAprovadaOuPaga}
                              value={linha.quantidadeAtual === 0 ? "" : linha.quantidadeAtual}
                              onChange={(e) =>
                                atualizarLinhaInput(idx, "quantidade", parseFloat(e.target.value) || 0)
                              }
                              placeholder="Qtd"
                              className="h-7 text-xs text-right font-semibold bg-white border-blue-300"
                            />
                            <div className="relative w-16">
                              <Input
                                type="number"
                                step="any"
                                disabled={isAprovadaOuPaga}
                                value={linha.percentualAtual === 0 ? "" : linha.percentualAtual}
                                onChange={(e) =>
                                  atualizarLinhaInput(idx, "percentual", parseFloat(e.target.value) || 0)
                                }
                                placeholder="%"
                                className="h-7 text-[11px] text-right bg-white pr-4"
                              />
                              <span className="absolute right-1 top-1.5 text-[10px] text-slate-400">
                                %
                              </span>
                            </div>
                          </div>
                          {linha.estouro && (
                            <div className="flex items-center gap-1 text-[10px] text-rose-600 mt-0.5">
                              <AlertTriangle className="h-3 w-3" />
                              Estourou saldo contratado!
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right font-semibold text-blue-700 bg-blue-50/30 border-r border-blue-100">
                          {Number(valorMedido || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>

                        <TableCell className="text-right bg-slate-50/50 font-medium">
                          <div>{Number(linha.quantidadeAcumulada || 0).toLocaleString("pt-BR")}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {linha.quantidadeContratada > 0
                              ? ((linha.quantidadeAcumulada / linha.quantidadeContratada) * 100).toFixed(1)
                              : 0}
                            %
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-medium text-slate-700">
                          {Number(linha.saldoQuantidade || 0).toLocaleString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Rodapé e Deduções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
            {/* Ajustes e Deduções */}
            <div className="border rounded-md p-3 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1 mb-2 border-b">
                  <span className="text-xs font-semibold text-slate-800">
                    Deduções, Retenções e Adiantamentos
                  </span>
                  {!isAprovadaOuPaga && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-blue-700"
                        onClick={() => adicionarAjuste("desconto")}
                      >
                        + Desconto
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-blue-700"
                        onClick={() => adicionarAjuste("amortizacao_adiantamento")}
                      >
                        + Adiantamento
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[11px] text-blue-700"
                        onClick={() => adicionarAjuste("retencao_tecnica")}
                      >
                        + Retenção
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {ajustes.length === 0 ? (
                    <div className="text-[11px] text-slate-400 py-2">
                      Nenhuma dedução aplicada. O valor medido bruto será integralmente liberado.
                    </div>
                  ) : (
                    ajustes.map((aj, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600 flex-1 truncate">{aj.descricao}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="any"
                            disabled={isAprovadaOuPaga}
                            value={aj.valorCentavos / 100}
                            onChange={(e) => atualizarAjusteValor(idx, e.target.value)}
                            className="h-6 w-24 text-right text-xs bg-white text-rose-600"
                          />
                          {!isAprovadaOuPaga && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                              onClick={() => removerAjuste(idx)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 mt-2 border-t text-xs text-rose-700 font-medium">
                <span>Total de Deduções:</span>
                <span>
                  -
                  {(totalDeducoesCentavos / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>

            {/* Resumo Financeiro Líquido */}
            <div className="border rounded-md p-4 bg-slate-900 text-white flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Valor Bruto Medido:</span>
                  <span className="text-white font-medium">
                    {(totalBrutoCentavos / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-rose-400">
                  <span>(-) Deduções / Retenções:</span>
                  <span>
                    -
                    {(totalDeducoesCentavos / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between items-baseline">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Valor Líquido a Pagar</div>
                    <div className="text-[10px] text-slate-400">
                      Será creditado no Contas a Pagar ao aprovar
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {(totalLiquidoCentavos / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                {!isAprovadaOuPaga ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={salvando}
                      onClick={handleSalvarRascunho}
                      className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                    >
                      {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Salvar Rascunho
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={totalLiquidoCentavos <= 0 || salvando || aprovando}
                      onClick={() => setDialogAprovarOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Aprovar Medição e Gerar Conta a Pagar
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={cancelando}
                    onClick={() => setDialogCancelarOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancelar Medição Aprovada
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Aprovação */}
      <AlertDialog open={dialogAprovarOpen} onOpenChange={setDialogAprovarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Boletim de Medição?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                Ao aprovar o boletim nº <strong>{medicao?.numero}</strong>:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  Será gerada <strong>1 conta a pagar</strong> no valor líquido de{" "}
                  <strong>
                    {(totalLiquidoCentavos / 100).toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>{" "}
                  para o prestador <strong>{contrato?.fornecedores?.nome_fantasia || contrato?.fornecedores?.razao_social || 'Prestador'}</strong>.
                </li>
                <li>
                  O avanço físico medido será acumulado no histórico do contrato de forma irreversível até eventual cancelamento.
                </li>
                {ajustes.some((a) => a.tipo === "retencao_tecnica" && a.valorCentavos > 0) && (
                  <li>
                    A retenção técnica será retida e disponibilizada no painel de retenções do contrato para liberação futura.
                  </li>
                )}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarAprovacao}
              disabled={aprovando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {aprovando ? "Aprovando..." : "Confirmar e Gerar Conta a Pagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Cancelamento */}
      <AlertDialog open={dialogCancelarOpen} onOpenChange={setDialogCancelarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Medição Aprovada?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-xs">
              <p>
                O cancelamento estornará a conta a pagar associada no Financeiro e restaurará os saldos a medir do contrato.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Motivo / Justificativa *</Label>
                <Input
                  placeholder="Ex: Erro no quantitativo medido pelo encarregado..."
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarCancelamento}
              disabled={cancelando}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {cancelando ? "Cancelando..." : "Confirmar Cancelamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Fotos e Link Compartilhável */}
      <MedicaoAnexos
        open={dialogAnexosOpen}
        onOpenChange={setDialogAnexosOpen}
        medicaoId={medicao?.id}
        numeroMedicao={medicao?.numero || 1}
      />
    </>
  );
}

