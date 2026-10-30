import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Trash2,
  Calculator,
  FileSpreadsheet,
  Loader2,
  HardHat,
  Pencil,
} from "lucide-react";
import { ImportarOrcamentoDialog } from "./importar-orcamento-dialog";
import { ImportarExcelDialog } from "./importar-excel-dialog";
import {
  criarContratoComItens,
  atualizarContratoEmpreiteiro,
  extrairUnidadeItem,
} from "@/lib/contratos-empreiteiros.functions";
import type { ContratoItem } from "@/lib/contratos-empreiteiros.schema";

interface ContratoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContratoCriado?: (contratoId: string) => void;
  onContratoSalvo?: (contratoId: string) => void;
  contratoParaEditar?: any | null;
}

export function ContratoEditorDialog({
  open,
  onOpenChange,
  onContratoCriado,
  onContratoSalvo,
  contratoParaEditar,
}: ContratoEditorDialogProps) {
  const isEditing = Boolean(contratoParaEditar?.id);

  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [tipo, setTipo] = useState<"preco_unitario" | "empreitada_global">("preco_unitario");
  const [status, setStatus] = useState<"rascunho" | "em_aprovacao" | "ativo" | "concluido" | "cancelado">("ativo");
  const [objeto, setObjeto] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFimPrevista, setDataFimPrevista] = useState("");
  const [retencaoPadraoPercentual, setRetencaoPadraoPercentual] = useState("0");
  const [adiantamentoPrevistoBRL, setAdiantamentoPrevistoBRL] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [itens, setItens] = useState<ContratoItem[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [openImportarOrcamento, setOpenImportarOrcamento] = useState(false);
  const [openImportarExcel, setOpenImportarExcel] = useState(false);

  useEffect(() => {
    if (open) {
      if (contratoParaEditar) {
        setObraId(contratoParaEditar.obra_id || "");
        setFornecedorId(contratoParaEditar.fornecedor_id || "");
        setTipo(contratoParaEditar.tipo || "preco_unitario");
        setStatus(contratoParaEditar.status || "ativo");
        setObjeto(contratoParaEditar.objeto || "");
        setDataInicio(contratoParaEditar.data_inicio || "");
        setDataFimPrevista(contratoParaEditar.data_fim_prevista || "");
        setRetencaoPadraoPercentual(String(contratoParaEditar.retencao_padrao_percentual || "0"));
        setAdiantamentoPrevistoBRL(
          contratoParaEditar.adiantamento_previsto_centavos
            ? (Number(contratoParaEditar.adiantamento_previsto_centavos) / 100).toFixed(2).replace(".", ",")
            : ""
        );
        setObservacoes(contratoParaEditar.observacoes || "");

        if (contratoParaEditar.itens && contratoParaEditar.itens.length > 0) {
          setItens(
            contratoParaEditar.itens.map((it: any, idx: number) => ({
              id: it.id,
              codigo: it.codigo || null,
              descricao: it.descricao,
              unidade: it.unidade || "un",
              etapa: it.etapa || "Geral",
              quantidadeContratada: Number(it.quantidadeContratada || it.quantidade || 1),
              precoUnitarioCentavos: Number(it.precoUnitarioCentavos || it.preco_unitario_centavos || 0),
              origemTipo: it.origemTipo || "manual",
              ordem: it.ordem ?? idx,
            }))
          );
        } else if (contratoParaEditar.id) {
          supabase
            .from("servicos_terceirizados")
            .select("*")
            .eq("contrato_empreiteiro_id", contratoParaEditar.id)
            .order("ordem", { ascending: true })
            .then(({ data: servicos }) => {
              if (servicos) {
                setItens(
                  servicos.map((s: any, idx: number) => ({
                    id: s.id,
                    codigo: s.codigo || null,
                    descricao: s.descricao,
                    unidade: extrairUnidadeItem(s),
                    etapa: s.etapa || "Geral",
                    quantidadeContratada: Number(s.quantidade || 1),
                    precoUnitarioCentavos: Number(s.preco_unitario_centavos || s.valor_unitario || 0),
                    origemTipo: "manual",
                    ordem: s.ordem ?? idx,
                  }))
                );
              }
            });
        }
      } else {
        setObraId("");
        setFornecedorId("");
        setTipo("preco_unitario");
        setStatus("ativo");
        setObjeto("");
        setDataInicio("");
        setDataFimPrevista("");
        setRetencaoPadraoPercentual("0");
        setAdiantamentoPrevistoBRL("");
        setObservacoes("");
        setItens([]);
      }
    }
  }, [open, contratoParaEditar]);

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-para-contratos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar empreiteiros / terceirizados
  const { data: prestadores = [] } = useQuery({
    queryKey: ["fornecedores-terceirizados-contratos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, razao_social, nome_fantasia, especialidade")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        nome: f.nome_fantasia || f.razao_social,
        especialidade: f.especialidade,
      }));
    },
  });

  const adicionarItemManual = () => {
    setItens((prev) => [
      ...prev,
      {
        codigo: null,
        descricao: "",
        unidade: "un",
        etapa: "Geral",
        quantidadeContratada: 1,
        precoUnitarioCentavos: 0,
        origemTipo: "manual",
        ordem: prev.length,
      },
    ]);
  };

  const atualizarItem = (index: number, campo: keyof ContratoItem, valor: any) => {
    setItens((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [campo]: valor };
      return clone;
    });
  };

  const removerItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItensImportados = (novosItens: ContratoItem[]) => {
    setItens((prev) => [...prev, ...novosItens]);
    toast.success(`${novosItens.length} item(ns) adicionados ao contrato!`);
  };

  const valorTotalContrato = itens.reduce((acc, it) => {
    return acc + (it.quantidadeContratada * it.precoUnitarioCentavos) / 100;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraId) {
      toast.error("Selecione a obra do contrato.");
      return;
    }
    if (!fornecedorId) {
      toast.error("Selecione o empreiteiro / prestador.");
      return;
    }
    if (!objeto.trim()) {
      toast.error("Informe o objeto do contrato.");
      return;
    }
    if (itens.length === 0) {
      toast.error("Adicione ao menos um item ou serviço ao contrato.");
      return;
    }

    const itemInvalido = itens.find(
      (it) => !it.descricao.trim() || it.quantidadeContratada <= 0
    );
    if (itemInvalido) {
      toast.error("Verifique os itens: todos devem ter descrição e quantidade maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      const adiantamentoLimpo = adiantamentoPrevistoBRL.replace(/\./g, "").replace(",", ".");
      const adiantamentoCentavos = Math.round((parseFloat(adiantamentoLimpo) || 0) * 100);
      const retencaoPct = parseFloat(retencaoPadraoPercentual.replace(",", ".")) || 0;

      if (isEditing && contratoParaEditar?.id) {
        await atualizarContratoEmpreiteiro({
          id: contratoParaEditar.id,
          obraId,
          fornecedorId,
          tipo,
          status,
          objeto: objeto.trim(),
          dataInicio: dataInicio || null,
          dataFimPrevista: dataFimPrevista || null,
          retencaoPadraoPercentual: retencaoPct,
          adiantamentoPrevistoCentavos: adiantamentoCentavos,
          observacoes: observacoes.trim() || null,
          itens,
        });

        toast.success(`Contrato nº ${contratoParaEditar.numero || ""} atualizado com sucesso!`);
        onContratoSalvo?.(contratoParaEditar.id);
        onOpenChange(false);
      } else {
        const novoContrato = await criarContratoComItens({
          obraId,
          fornecedorId,
          tipo,
          objeto: objeto.trim(),
          dataInicio: dataInicio || null,
          dataFimPrevista: dataFimPrevista || null,
          retencaoPadraoPercentual: retencaoPct,
          adiantamentoPrevistoCentavos: adiantamentoCentavos,
          observacoes: observacoes.trim() || null,
          itens,
        });

        toast.success(`Contrato nº ${novoContrato.numero} criado com sucesso!`);
        onContratoCriado?.(novoContrato.id);
        onContratoSalvo?.(novoContrato.id);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(`Falha ao salvar contrato: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              {isEditing ? (
                <>
                  <Pencil className="h-5 w-5 text-indigo-600" />
                  Editar Contrato {contratoParaEditar?.numero ? `nº ${contratoParaEditar.numero}` : ""}
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5 text-blue-600" />
                  Novo Contrato de Empreiteiro
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Atualize os dados cadastrais, prazos, retenções ou a planilha de itens e escopo deste contrato."
                : "Cadastre o contrato de prestação de serviços com itens negociados, valores e regras de retenção técnica."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className={`grid grid-cols-1 ${isEditing ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Obra *</Label>
                <Select value={obraId} onValueChange={setObraId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Empreiteiro / Prestador *</Label>
                <Select value={fornecedorId} onValueChange={setFornecedorId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o prestador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {prestadores.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} {p.especialidade ? `(${p.especialidade})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Modalidade Contratual</Label>
                <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preco_unitario">Preço Unitário (Medição por avanço)</SelectItem>
                    <SelectItem value="empreitada_global">Empreitada Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Status do Contrato</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="em_aprovacao">Em Aprovação</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Objeto do Contrato *</Label>
              <Input
                placeholder="Ex: Execução de alvenaria estrutural, contrapiso e reboco dos blocos A e B"
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data Término Prevista</Label>
                <Input
                  type="date"
                  value={dataFimPrevista}
                  onChange={(e) => setDataFimPrevista(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Retenção Técnica Padrão (%)</Label>
                <Input
                  placeholder="Ex: 5"
                  value={retencaoPadraoPercentual}
                  onChange={(e) => setRetencaoPadraoPercentual(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Adiantamento Previsto (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={adiantamentoPrevistoBRL}
                  onChange={(e) => setAdiantamentoPrevistoBRL(e.target.value)}
                />
              </div>
            </div>

            {/* Escopo / Itens do Contrato */}
            <div className="flex-1 flex flex-col min-h-0 border rounded-md p-3 bg-slate-50/50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b">
                <div className="flex items-center gap-2">
                  <HardHat className="h-4 w-4 text-slate-700" />
                  <span className="text-xs font-semibold text-slate-800">
                    Itens e Preços Negociados ({itens.length})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-white"
                    onClick={() => {
                      if (!obraId) {
                        toast.error("Selecione a obra antes de importar do orçamento.");
                        return;
                      }
                      setOpenImportarOrcamento(true);
                    }}
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1 text-blue-600" />
                    Do Orçamento
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs bg-white"
                    onClick={() => setOpenImportarExcel(true)}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Do Excel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs bg-slate-800 text-white hover:bg-slate-900"
                    onClick={adicionarItemManual}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Item Manual
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                {itens.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Nenhum item adicionado ainda. Importe itens do orçamento, de uma planilha Excel ou adicione manualmente acima.
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-slate-100/70">
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Descrição do Serviço</TableHead>
                        <TableHead className="w-20">Etapa</TableHead>
                        <TableHead className="w-16 text-center">Unid.</TableHead>
                        <TableHead className="w-24 text-right">Qtd.</TableHead>
                        <TableHead className="w-28 text-right">Preço Unit. (R$)</TableHead>
                        <TableHead className="w-28 text-right">Total (R$)</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, idx) => {
                        const totalItem = (item.quantidadeContratada * item.precoUnitarioCentavos) / 100;
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                            <TableCell>
                              <Input
                                value={item.descricao}
                                onChange={(e) => atualizarItem(idx, "descricao", e.target.value)}
                                placeholder="Descrição do serviço..."
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.etapa || ""}
                                onChange={(e) => atualizarItem(idx, "etapa", e.target.value)}
                                placeholder="Geral"
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.unidade}
                                onChange={(e) => atualizarItem(idx, "unidade", e.target.value)}
                                className="h-7 text-xs text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="any"
                                value={item.quantidadeContratada}
                                onChange={(e) =>
                                  atualizarItem(idx, "quantidadeContratada", parseFloat(e.target.value) || 0)
                                }
                                className="h-7 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="any"
                                value={item.precoUnitarioCentavos / 100}
                                onChange={(e) =>
                                  atualizarItem(
                                    idx,
                                    "precoUnitarioCentavos",
                                    Math.round((parseFloat(e.target.value) || 0) * 100)
                                  )
                                }
                                className="h-7 text-xs text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium text-slate-800">
                              {totalItem.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-rose-500 hover:text-rose-700"
                                onClick={() => removerItem(idx)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>

              <div className="flex justify-between items-center pt-2 mt-2 border-t text-xs font-semibold text-slate-800">
                <span>Valor Total Contratado:</span>
                <span className="text-sm text-blue-700">
                  {valorTotalContrato.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditing ? "Salvando Alterações..." : "Criando Contrato..."}
                  </>
                ) : isEditing ? (
                  "Salvar Alterações"
                ) : (
                  "Salvar e Ativar Contrato"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportarOrcamentoDialog
        open={openImportarOrcamento}
        onOpenChange={setOpenImportarOrcamento}
        obraId={obraId}
        onImportar={handleItensImportados}
      />

      <ImportarExcelDialog
        open={openImportarExcel}
        onOpenChange={setOpenImportarExcel}
        onImportar={handleItensImportados}
      />
    </>
  );
}
