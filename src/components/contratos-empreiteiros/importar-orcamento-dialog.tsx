import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calculator, Search, Building2, Layers } from "lucide-react";
import { mapearAtividadesParaItensContrato } from "@/lib/contratos-empreiteiros-importacao";
import type { ContratoItem } from "@/lib/contratos-empreiteiros.schema";

interface ImportarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId?: string;
  onImportar: (itens: ContratoItem[]) => void;
}

interface ItemImportacao {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  etapaNome: string;
  obraNome?: string;
  orcamentoId?: string;
  preco_unitario_centavos: number;
  custoTotalCentavos: number;
  bdiPercentual?: number;
  origemTipo: string;
}

export function ImportarOrcamentoDialog({
  open,
  onOpenChange,
  obraId,
  onImportar,
}: ImportarOrcamentoDialogProps) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");
  const [selectedObraId, setSelectedObraId] = useState<string>(obraId || "todas");

  // Atualiza a obra selecionada ao abrir ou mudar prop
  useEffect(() => {
    if (obraId) {
      setSelectedObraId(obraId);
    } else {
      setSelectedObraId("todas");
    }
  }, [obraId, open]);

  // Lista de todas as obras cadastradas
  const { data: listaObras = [] } = useQuery<{ id: string; nome: string; numero: string | null }[]>({
    queryKey: ["obras-lista-importar-orcamento"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, nome, numero")
        .order("nome");
      if (error) return [];
      return data ?? [];
    },
  });

  const obrasMap = useMemo(() => {
    return new Map(listaObras.map((o) => [o.id, o.nome]));
  }, [listaObras]);

  // Buscar itens do orçamento ou propostas/escopo da obra
  const { data: itensOrcamento = [], isLoading } = useQuery<ItemImportacao[]>({
    queryKey: ["orcamento-analitico-itens-importacao", selectedObraId],
    enabled: open,
    queryFn: async () => {
      const itensResultado: ItemImportacao[] = [];

      // 1. Tentar buscar orçamentos cadastrados
      let orcamentosQuery = supabase
        .from("orcamentos")
        .select("id, obra_id, bdi_geral")
        .order("created_at", { ascending: false });

      if (selectedObraId && selectedObraId !== "todas") {
        orcamentosQuery = orcamentosQuery.eq("obra_id", selectedObraId);
      }

      const { data: orcamentos, error: errOrc } = await orcamentosQuery;
      if (errOrc) {
        console.warn("Aviso ao buscar orçamentos:", errOrc);
      }

      const orcamentoIds = (orcamentos || []).map((o) => o.id);
      const orcamentoObraMap = new Map((orcamentos || []).map((o) => [o.id, o.obra_id]));
      const bdiPadrao = Number(orcamentos?.[0]?.bdi_geral || 25);

      if (orcamentoIds.length > 0) {
        // 1a. Buscar etapas e atividades do orçamento analítico
        try {
          const { data: etapas } = await supabase
            .from("orcamento_etapas")
            .select("id, orcamento_id, nome, ordem, codigo")
            .in("orcamento_id", orcamentoIds)
            .order("ordem");

          if (etapas && etapas.length > 0) {
            const etapaMap = new Map(etapas.map((et) => [et.id, et.nome]));
            const etapaOrcamentoMap = new Map(etapas.map((et) => [et.id, et.orcamento_id]));
            const etapaIds = etapas.map((e) => e.id);

            const { data: atividades } = await supabase
              .from("orcamento_atividades")
              .select("id, etapa_id, codigo, descricao, unidade, quantidade, bdi_percentual")
              .in("etapa_id", etapaIds)
              .order("ordem");

            if (atividades && atividades.length > 0) {
              const ativIds = atividades.map((a) => a.id);
              const { data: insumos } = await supabase
                .from("orcamento_atividade_insumos")
                .select("atividade_id, preco_unitario_centavos, coeficiente")
                .in("atividade_id", ativIds);

              const insumosMap = new Map<string, number>();
              (insumos || []).forEach((ins) => {
                const prev = insumosMap.get(ins.atividade_id) || 0;
                const custo = Math.round(Number(ins.coeficiente || 1) * Number(ins.preco_unitario_centavos || 0));
                insumosMap.set(ins.atividade_id, prev + custo);
              });

              atividades.forEach((atv: any) => {
                const qtd = Number(atv.quantidade || 1);
                const bdi = Number(atv.bdi_percentual != null ? atv.bdi_percentual : bdiPadrao);
                const custoUnit = insumosMap.get(atv.id) || 0;
                const precoUnit = Math.round(custoUnit * (1 + bdi / 100));
                const orcId = etapaOrcamentoMap.get(atv.etapa_id) || orcamentoIds[0];
                const obId = orcamentoObraMap.get(orcId) || "";

                itensResultado.push({
                  id: atv.id,
                  codigo: atv.codigo || null,
                  descricao: atv.descricao,
                  unidade: atv.unidade || "un",
                  quantidade: qtd,
                  etapaNome: etapaMap.get(atv.etapa_id) || "Geral",
                  obraNome: obrasMap.get(obId) || (selectedObraId !== "todas" ? obrasMap.get(selectedObraId) : undefined),
                  orcamentoId: orcId,
                  custoTotalCentavos: Math.round(precoUnit * qtd),
                  preco_unitario_centavos: precoUnit,
                  bdiPercentual: bdi,
                  origemTipo: "orcamento_analitico",
                });
              });
            }
          }
        } catch (errAnalitico) {
          console.warn("Aviso ao buscar etapas analíticas:", errAnalitico);
        }

        // 1b. Se não tem atividades analíticas ou como complemento, buscar de orcamento_itens
        if (itensResultado.length === 0) {
          try {
            const { data: orcamentoItens } = await supabase
              .from("orcamento_itens")
              .select("id, orcamento_id, codigo, descricao, unidade, quantidade, valor_unitario, valor_total, etapa")
              .in("orcamento_id", orcamentoIds)
              .order("etapa", { ascending: true })
              .order("created_at", { ascending: true });

            if (orcamentoItens && orcamentoItens.length > 0) {
              orcamentoItens.forEach((it: any) => {
                const qtd = Number(it.quantidade || 1);
                const precoUnit = Number(it.valor_unitario || 0);
                const custoTot = Number(it.valor_total || Math.round(qtd * precoUnit));
                const obId = orcamentoObraMap.get(it.orcamento_id) || "";

                itensResultado.push({
                  id: it.id,
                  codigo: it.codigo || null,
                  descricao: it.descricao,
                  unidade: it.unidade || "un",
                  quantidade: qtd,
                  etapaNome: it.etapa || "Geral",
                  obraNome: obrasMap.get(obId) || (selectedObraId !== "todas" ? obrasMap.get(selectedObraId) : undefined),
                  orcamentoId: it.orcamento_id,
                  preco_unitario_centavos: precoUnit,
                  custoTotalCentavos: custoTot,
                  bdiPercentual: 0,
                  origemTipo: "orcamento_legado",
                });
              });
            }
          } catch (errLegado) {
            console.warn("Aviso ao buscar itens de orcamento_itens:", errLegado);
          }
        }
      }

      if (itensResultado.length > 0) {
        return itensResultado;
      }

      // 2. Tentar buscar escopo da obra via RPC escopo_obra (se uma obra específica estiver selecionada)
      if (selectedObraId && selectedObraId !== "todas") {
        try {
          const { data: escopoRpc } = await (supabase as any).rpc("escopo_obra", { p_obra_id: selectedObraId });
          if (escopoRpc && escopoRpc.length > 0) {
            return escopoRpc.map((e: any) => {
              const qtd = Number(e.quantidade || 1);
              const precoUnit = Math.round(Number(e.valor_unitario || 0) * 100);
              return {
                id: e.proposta_item_id || String(Math.random()),
                codigo: e.item_codigo || e.subitem_codigo || null,
                descricao: e.descricao || e.item_nome || "Item de Escopo",
                unidade: e.unidade || "un",
                quantidade: qtd,
                etapaNome: e.etapa_nome || "Geral",
                obraNome: obrasMap.get(selectedObraId),
                preco_unitario_centavos: precoUnit,
                custoTotalCentavos: Math.round(qtd * precoUnit),
                bdiPercentual: 0,
                origemTipo: "escopo_obra",
              };
            });
          }
        } catch (errRpc) {
          console.warn("RPC escopo_obra indisponível ou falhou:", errRpc);
        }

        // 3. Tentar buscar propostas comerciais vinculadas à obra
        try {
          const { data: obraRow } = await supabase
            .from("obras")
            .select("proposta_id")
            .eq("id", selectedObraId)
            .maybeSingle();

          let propostaId = obraRow?.proposta_id;
          if (!propostaId) {
            const { data: props } = await (supabase as any)
              .from("propostas")
              .select("id")
              .eq("obra_id", selectedObraId)
              .order("created_at", { ascending: false })
              .limit(1);
            propostaId = props?.[0]?.id;
          }

          if (propostaId) {
            const { data: pItens } = await (supabase as any)
              .from("propostas_itens")
              .select("id, item_codigo, descricao, unidade, quantidade, valor_unitario, valor_total, etapa_nome")
              .eq("proposta_id", propostaId)
              .order("ordem");

            if (pItens && pItens.length > 0) {
              return pItens.map((pi: any) => {
                const qtd = Number(pi.quantidade || 1);
                const precoUnit = Math.round(Number(pi.valor_unitario || 0) * 100);
                const total = Number(pi.valor_total || (qtd * Number(pi.valor_unitario || 0)));
                return {
                  id: pi.id,
                  codigo: pi.item_codigo || null,
                  descricao: pi.descricao,
                  unidade: pi.unidade || "un",
                  quantidade: qtd,
                  etapaNome: pi.etapa_nome || "Geral",
                  obraNome: obrasMap.get(selectedObraId),
                  preco_unitario_centavos: precoUnit,
                  custoTotalCentavos: Math.round(total * 100),
                  bdiPercentual: 0,
                  origemTipo: "escopo_obra",
                };
              });
            }
          }
        } catch (errProp) {
          console.warn("Aviso ao buscar itens de proposta:", errProp);
        }

        // 4. Fallback final: cronograma da obra
        try {
          const { data: cronograma } = await (supabase as any)
            .from("obra_cronograma")
            .select("id, nome, ordem")
            .eq("obra_id", selectedObraId)
            .order("ordem");

          if (cronograma && cronograma.length > 0) {
            return cronograma.map((c: any, idx: number) => ({
              id: c.id,
              codigo: `${idx + 1}`,
              descricao: c.nome,
              unidade: "un",
              quantidade: 1,
              etapaNome: "Cronograma",
              obraNome: obrasMap.get(selectedObraId),
              preco_unitario_centavos: 0,
              custoTotalCentavos: 0,
              bdiPercentual: 0,
              origemTipo: "orcamento_legado",
            }));
          }
        } catch (errCrono) {
          console.warn("Aviso ao buscar cronograma:", errCrono);
        }
      }

      return itensResultado;
    },
  });

  const itensFiltrados = useMemo(() => {
    if (!busca.trim()) return itensOrcamento;
    const termo = busca.toLowerCase();
    return itensOrcamento.filter(
      (it) =>
        it.descricao.toLowerCase().includes(termo) ||
        (it.codigo && it.codigo.toLowerCase().includes(termo)) ||
        (it.etapaNome && it.etapaNome.toLowerCase().includes(termo)) ||
        (it.obraNome && it.obraNome.toLowerCase().includes(termo))
    );
  }, [itensOrcamento, busca]);

  const toggleTodos = () => {
    const itensAlvo = itensFiltrados;
    const todosAlvoMarcados = itensAlvo.length > 0 && itensAlvo.every((it) => selecionados[it.id]);
    if (todosAlvoMarcados) {
      setSelecionados((prev) => {
        const next = { ...prev };
        itensAlvo.forEach((it) => delete next[it.id]);
        return next;
      });
    } else {
      setSelecionados((prev) => {
        const next = { ...prev };
        itensAlvo.forEach((it) => {
          next[it.id] = true;
        });
        return next;
      });
    }
  };

  const handleConfirmar = () => {
    const escolhidos = itensOrcamento.filter((it) => selecionados[it.id]);
    const itensConvertidos = mapearAtividadesParaItensContrato(escolhidos);
    onImportar(itensConvertidos);
    setSelecionados({});
    setBusca("");
    onOpenChange(false);
  };

  const totalSelecionado = Object.values(selecionados).filter(Boolean).length;
  const valorTotalSelecionadoCentavos = useMemo(() => {
    return itensOrcamento
      .filter((it) => selecionados[it.id])
      .reduce(
        (acc, it) => acc + Math.round((it.preco_unitario_centavos || 0) * (it.quantidade || 1)),
        0
      );
  }, [itensOrcamento, selecionados]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Importar Itens do Orçamento da Obra
              </DialogTitle>
              <DialogDescription>
                Selecione os itens do orçamento da obra ou da proposta comercial para compor o escopo do contrato com o empreiteiro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Filtro de Obra */}
        <div className="flex flex-col sm:flex-row items-center gap-3 p-2 bg-slate-50 border rounded-md">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
            <span>Obra de Origem:</span>
          </div>
          <div className="w-full sm:w-80">
            <Select value={selectedObraId} onValueChange={setSelectedObraId}>
              <SelectTrigger className="h-8 text-xs bg-white">
                <SelectValue placeholder="Selecione a obra..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Obras (Orçamentos Globais)</SelectItem>
                {listaObras.map((ob) => (
                  <SelectItem key={ob.id} value={ob.id}>
                    {ob.nome} {ob.numero ? `(${ob.numero})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-sm">Buscando itens no orçamento e escopo da obra...</span>
          </div>
        ) : itensOrcamento.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 space-y-2">
            <p>Nenhum item de orçamento encontrado para esta seleção.</p>
            <p className="text-xs text-slate-400">
              Você pode selecionar outra obra no seletor acima, escolher &quot;Todas as Obras&quot; ou cadastrar itens manualmente via planilha Excel.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-1">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Filtrar por descrição, código ou etapa..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto justify-between sm:justify-end">
                <span>
                  {itensFiltrados.length} de {itensOrcamento.length} itens disponíveis
                </span>
                <Button variant="ghost" size="sm" onClick={toggleTodos} className="h-7 text-xs">
                  {itensFiltrados.length > 0 && itensFiltrados.every((it) => selecionados[it.id])
                    ? "Desmarcar visíveis"
                    : "Selecionar visíveis"}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-md max-h-[46vh]">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descrição / Etapa</TableHead>
                    <TableHead className="w-16 text-center">Unid.</TableHead>
                    <TableHead className="w-20 text-right">Qtd.</TableHead>
                    <TableHead className="w-28 text-right">Preço Unit.</TableHead>
                    <TableHead className="w-28 text-right">Total Est.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-xs text-slate-400">
                        Nenhum item corresponde ao filtro informado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itensFiltrados.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() =>
                          setSelecionados((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                      >
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={Boolean(selecionados[item.id])}
                            onCheckedChange={(checked) =>
                              setSelecionados((prev) => ({ ...prev, [item.id]: Boolean(checked) }))
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">
                          {item.codigo || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-slate-900">{item.descricao}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-slate-100 rounded text-slate-600">
                              <Layers className="h-3 w-3 text-slate-400" />
                              {item.etapaNome}
                            </span>
                            {item.obraNome && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded font-medium">
                                <Building2 className="h-3 w-3 text-blue-500" />
                                {item.obraNome}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs">{item.unidade}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {item.quantidade.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-slate-600">
                          {((item.preco_unitario_centavos || 0) / 100).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium text-slate-900">
                          {(((item.preco_unitario_centavos || 0) * (item.quantidade || 0)) / 100).toLocaleString(
                            "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            }
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between sm:justify-between pt-3 border-t gap-2">
          <div className="text-xs text-slate-600 font-medium">
            <span className="font-semibold text-slate-900">{totalSelecionado}</span> item(ns) selecionado(s)
            {totalSelecionado > 0 && (
              <span className="ml-2 text-slate-500">
                (Total:{" "}
                <strong className="text-slate-900 font-mono">
                  {(valorTotalSelecionadoCentavos / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
                )
              </span>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={totalSelecionado === 0}
              onClick={handleConfirmar}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Adicionar ao Contrato ({totalSelecionado})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
