import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calculator } from "lucide-react";
import { mapearAtividadesParaItensContrato } from "@/lib/contratos-empreiteiros-importacao";
import type { ContratoItem } from "@/lib/contratos-empreiteiros.schema";

interface ImportarOrcamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId?: string;
  onImportar: (itens: ContratoItem[]) => void;
}

export function ImportarOrcamentoDialog({
  open,
  onOpenChange,
  obraId,
  onImportar,
}: ImportarOrcamentoDialogProps) {
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});

  // Buscar itens do orçamento analítico da obra
  const { data: itensOrcamento = [], isLoading } = useQuery({
    queryKey: ["orcamento-analitico-itens-importacao", obraId],
    enabled: open && Boolean(obraId),
    queryFn: async () => {
      if (!obraId) return [];

      // 1. Tentar buscar orçamento ativo da obra
      const { data: orcamentos } = await supabase
        .from("orcamentos")
        .select("id, bdi_padrao_percentual")
        .eq("obra_id", obraId)
        .order("created_at", { ascending: false })
        .limit(1);

      const orcamentoId = orcamentos?.[0]?.id;
      if (!orcamentoId) {
        // Fallback: tentar escopo_obra
        const { data: escopo } = await supabase
          .from("escopo_obra")
          .select("id, item, descricao, unidade, quantidade, valor_unitario")
          .eq("obra_id", obraId)
          .order("item");

        return (escopo || []).map((e: any) => ({
          id: e.id,
          codigo: e.item || null,
          descricao: e.descricao,
          unidade: e.unidade || "un",
          quantidade: Number(e.quantidade || 1),
          etapaNome: "Geral",
          preco_unitario_centavos: Math.round(Number(e.valor_unitario || 0) * 100),
          custoTotalCentavos: Math.round(Number(e.valor_unitario || 0) * Number(e.quantidade || 1) * 100),
          bdiPercentual: 0,
        }));
      }

      // Buscar etapas e atividades do orçamento analítico
      const { data: etapas } = await supabase
        .from("orcamento_etapas")
        .select("id, nome, ordem")
        .eq("orcamento_id", orcamentoId)
        .order("ordem");

      const etapaMap = new Map((etapas || []).map((et) => [et.id, et.nome]));
      const etapaIds = (etapas || []).map((e) => e.id);

      if (etapaIds.length === 0) return [];

      const { data: atividades } = await supabase
        .from("orcamento_atividades")
        .select("id, etapa_id, codigo, descricao, unidade, quantidade, custo_total_centavos, bdi_percentual")
        .in("etapa_id", etapaIds)
        .order("ordem");

      return (atividades || []).map((atv: any) => ({
        id: atv.id,
        codigo: atv.codigo,
        descricao: atv.descricao,
        unidade: atv.unidade || "un",
        quantidade: Number(atv.quantidade || 1),
        etapaNome: etapaMap.get(atv.etapa_id) || "Geral",
        orcamentoId,
        custoTotalCentavos: Number(atv.custo_total_centavos || 0),
        bdiPercentual: Number(atv.bdi_percentual || orcamentos?.[0]?.bdi_padrao_percentual || 0),
      }));
    },
  });

  const toggleTodos = () => {
    if (Object.keys(selecionados).length === itensOrcamento.length) {
      setSelecionados({});
    } else {
      const todos: Record<string, boolean> = {};
      itensOrcamento.forEach((it) => {
        todos[it.id] = true;
      });
      setSelecionados(todos);
    }
  };

  const handleConfirmar = () => {
    const escolhidos = itensOrcamento.filter((it) => selecionados[it.id]);
    const itensConvertidos = mapearAtividadesParaItensContrato(escolhidos);
    onImportar(itensConvertidos);
    setSelecionados({});
    onOpenChange(false);
  };

  const totalSelecionado = Object.values(selecionados).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Importar Itens do Orçamento da Obra
          </DialogTitle>
          <DialogDescription>
            Selecione as atividades do orçamento analítico para compor o escopo do contrato com o empreiteiro.
          </DialogDescription>
        </DialogHeader>

        {!obraId ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Selecione uma obra no contrato antes de importar itens do orçamento.
          </div>
        ) : isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-sm">Carregando itens do orçamento...</span>
          </div>
        ) : itensOrcamento.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Nenhum item de orçamento encontrado para esta obra. Você pode cadastrar itens manualmente ou importar via planilha Excel.
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between pb-2 text-xs text-slate-500">
              <span>{itensOrcamento.length} itens disponíveis</span>
              <Button variant="ghost" size="sm" onClick={toggleTodos} className="h-7 text-xs">
                {totalSelecionado === itensOrcamento.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead className="w-24">Código</TableHead>
                    <TableHead>Descrição / Etapa</TableHead>
                    <TableHead className="w-16 text-center">Unid.</TableHead>
                    <TableHead className="w-20 text-right">Qtd.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensOrcamento.map((item) => (
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
                        <div className="text-[11px] text-slate-500">{item.etapaNome}</div>
                      </TableCell>
                      <TableCell className="text-center text-xs">{item.unidade}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {item.quantidade.toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 border-t">
          <div className="text-xs text-slate-600 font-medium">
            {totalSelecionado} item(ns) selecionado(s)
          </div>
          <div className="flex gap-2">
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

