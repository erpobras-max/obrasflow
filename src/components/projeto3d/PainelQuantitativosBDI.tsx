import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { DadosProjetoBIM, ConfiguracaoBDI, ItemQuantitativo } from "@/types/projeto3d";
import {
  calcularQuantitativosBIM,
  formatarMoeda,
  BDI_PADRAO_INICIAL,
} from "@/lib/projeto3d.utils";
import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calculator,
  Percent,
  Coins,
  FileCheck2,
  TrendingUp,
  RotateCcw,
  Info,
  Send,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface PainelQuantitativosBDIProps {
  dados: DadosProjetoBIM;
  configBdi: ConfiguracaoBDI;
  onChangeBdi: (novaConfig: ConfiguracaoBDI) => void;
  somenteLeitura?: boolean;
  obraId?: string;
  obraNome?: string;
}

export function PainelQuantitativosBDI({
  dados,
  configBdi,
  onChangeBdi,
  somenteLeitura = false,
  obraId,
  obraNome,
}: PainelQuantitativosBDIProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const resumo = calcularQuantitativosBIM(dados, configBdi);

  // Estados para o diálogo de criação de medição a partir do 3D
  const [modalMedicaoAberto, setModalMedicaoAberto] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState<Record<string, boolean>>({});
  const [periodoInicio, setPeriodoInicio] = useState(() => new Date().toISOString().split("T")[0]);
  const [periodoFim, setPeriodoFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  });
  const [observacoesMedicao, setObservacoesMedicao] = useState("");
  const [criandoMedicao, setCriandoMedicao] = useState(false);

  // Inicializar seleção quando abrir o modal
  const abrirModalMedicao = () => {
    const selecaoInicial: Record<string, boolean> = {};
    resumo.itens.forEach((it) => {
      selecaoInicial[it.id] = true;
    });
    setItensSelecionados(selecaoInicial);
    setObservacoesMedicao(`Medição gerada a partir dos quantitativos do Projeto 3D/BIM da obra.`);
    setModalMedicaoAberto(true);
  };

  const toggleItem = (id: string) => {
    setItensSelecionados((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const selecionarTodos = (marcar: boolean) => {
    const nova: Record<string, boolean> = {};
    resumo.itens.forEach((it) => {
      nova[it.id] = marcar;
    });
    setItensSelecionados(nova);
  };

  const itensFiltradosParaExportar = resumo.itens.filter((it) => itensSelecionados[it.id]);
  const valorTotalExportacao = itensFiltradosParaExportar.reduce((acc, it) => {
    const subtotal = it.quantidade * it.precoUnitario;
    return acc + subtotal * (1 + resumo.bdiTaxa / 100);
  }, 0);

  const handleConfirmarEnvioMedicao = async () => {
    if (!obraId) {
      toast.error("Identificador da obra não encontrado.");
      return;
    }
    if (itensFiltradosParaExportar.length === 0) {
      toast.error("Selecione pelo menos um serviço do projeto para incluir na medição.");
      return;
    }
    if (!periodoInicio || !periodoFim) {
      toast.error("Informe a data de início e fim da medição.");
      return;
    }

    setCriandoMedicao(true);
    try {
      // 1. Criar cabeçalho da medição
      const baseMed = {
        obra_id: obraId,
        contrato_id: null,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        percentual_total: 100, // Primeira medição de quantitativo base
        status: "rascunho",
        observacoes: observacoesMedicao || `Extraído do Modelo 3D / BIM - Obra: ${obraNome || ""}`,
        created_by: user?.id ?? null,
      };

      const { data: medData, error: medError } = await supabase
        .from("medicoes")
        .insert(baseMed)
        .select("id, numero")
        .single();

      if (medError) throw medError;
      const medicaoId = medData.id;

      // 2. Inserir itens da medição com seus quantitativos e valores unitários com BDI
      const itensInsert = itensFiltradosParaExportar.map((it) => {
        const precoComBdi = it.precoUnitario * (1 + resumo.bdiTaxa / 100);
        return {
          medicao_id: medicaoId,
          descricao: it.descricao,
          unidade: it.unidade,
          qtd_contratada: it.quantidade,
          qtd_executada: it.quantidade,
          valor_unitario: Number(precoComBdi.toFixed(2)),
          valor_total: Number((it.quantidade * precoComBdi).toFixed(2)),
          codigo_referencia: it.codigoSinapi || it.codigo,
          fonte_referencia: it.codigoSinapi ? "sinapi" : null,
          percentual_executado: 100,
        };
      });

      const { error: itensError } = await (supabase as any)
        .from("medicoes_itens")
        .insert(itensInsert);

      if (itensError) throw itensError;

      toast.success(
        `Medição ${medData.numero ? `#${medData.numero}` : ""} criada com sucesso a partir do projeto 3D! Ela já está pronta em Medições & Financeiro.`
      );
      setModalMedicaoAberto(false);

      // Redirecionar para a tela de medições
      navigate({ to: "/medicoes" });
    } catch (err: any) {
      toast.error(`Falha ao criar medição: ${err.message}`);
    } finally {
      setCriandoMedicao(false);
    }
  };

  const handleUpdateCampo = (campo: keyof ConfiguracaoBDI, valorStr: string) => {
    const valor = parseFloat(valorStr) || 0;
    onChangeBdi({
      ...configBdi,
      [campo]: valor,
    });
  };

  const handleResetarBdi = () => {
    onChangeBdi(BDI_PADRAO_INICIAL);
  };

  return (
    <div className="h-full bg-slate-50/50 p-4 lg:p-6 overflow-y-auto space-y-6">
      {/* Aviso informativo caso o projeto esteja em branco */}
      {dados.paredes.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs shadow-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Obra sem paredes modeladas:</strong> Os quantitativos e orçamentos abaixo estão zerados porque ainda não há paredes desenhadas nesta obra. Alterne para a aba <strong>Planta Baixa (2D)</strong> para traçar os cômodos ou importe um arquivo DXF para calcular os materiais automaticamente.
          </div>
        </div>
      )}

      {/* 1. Cards de Resumo Financeiro com BDI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Custo Direto (Materiais + MO)</span>
              <Coins className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
              {formatarMoeda(resumo.custoDiretoTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Calculado a partir das áreas do 3D</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Taxa de BDI Aplicada</span>
              <Percent className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2 font-mono">
              {resumo.bdiTaxa.toFixed(2)}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Lucro + Impostos + Indiretos</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Valor do BDI (Margem Bruta)</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2 font-mono">
              {formatarMoeda(resumo.valorBdiTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Margem operacional da construtora</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 shadow-xs bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-primary text-xs font-semibold">
              <span>Preço Total da Obra</span>
              <FileCheck2 className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary mt-2 font-mono">
              {formatarMoeda(resumo.precoVendaTotal)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Valor do Dossiê & Proposta</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Painel de Parametrização do BDI */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Parâmetros de BDI Privado (Construtora)
            </CardTitle>
            <CardDescription className="text-xs">
              Ajuste as margens de lucro, impostos e custos indiretos específicos desta obra.
            </CardDescription>
          </div>

          {!somenteLeitura && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-8 text-slate-600"
              onClick={handleResetarBdi}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Padrão (31.5%)
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Lucro Líquido (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.lucroLiquido}
                onChange={(e) => handleUpdateCampo("lucroLiquido", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Meta líquida da empresa</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Impostos sobre Venda (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.impostos}
                onChange={(e) => handleUpdateCampo("impostos", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Simples / Presumido</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Adm. Central (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.administracaoCentral}
                onChange={(e) => handleUpdateCampo("administracaoCentral", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Escritório & gestão</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Custo Indireto da Obra (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.custoIndiretoObra}
                onChange={(e) => handleUpdateCampo("custoIndiretoObra", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Canteiro, EPIs, água/luz</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Contingência e Riscos (%)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={somenteLeitura}
                value={configBdi.contingencia}
                onChange={(e) => handleUpdateCampo("contingencia", e.target.value)}
                className="h-9 font-mono"
              />
              <span className="text-[10px] text-slate-400">Imprevistos e variações</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tabela de Quantitativos & Memória de Cálculo Auditável */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
                Memória de Cálculo e Quantitativos BIM
              </CardTitle>
              <CardDescription className="text-xs">
                Quantidades extraídas das paredes, vãos e ambientes com referências SINAPI.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1.5 text-slate-600 font-normal">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Desconto real de vãos: {resumo.areaTotalVaos.toFixed(2)} m²
              </Badge>

              {!somenteLeitura && obraId && (
                <Button
                  size="sm"
                  onClick={abrirModalMedicao}
                  disabled={resumo.itens.length === 0}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gerar Medição / Financeiro
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-20">Item</TableHead>
                <TableHead className="w-28">Ref. SINAPI</TableHead>
                <TableHead>Descrição do Serviço / Composição</TableHead>
                <TableHead>Memória de Cálculo (Fórmula)</TableHead>
                <TableHead className="text-right w-24">Qtd.</TableHead>
                <TableHead className="text-right w-28">Preço Unit.</TableHead>
                <TableHead className="text-right w-32">Subtotal Direto</TableHead>
                <TableHead className="text-right w-32 font-semibold">Total c/ BDI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.itens.map((item) => {
                const subtotal = item.quantidade * item.precoUnitario;
                const totalComBdi = subtotal * (1 + resumo.bdiTaxa / 100);

                return (
                  <TableRow key={item.id} className="text-xs">
                    <TableCell className="font-mono font-medium text-slate-700">
                      {item.codigo}
                    </TableCell>
                    <TableCell>
                      {item.codigoSinapi ? (
                        <Badge variant="secondary" className="font-mono text-[11px] font-normal">
                          #{item.codigoSinapi}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {item.descricao}
                    </TableCell>
                    <TableCell className="text-slate-500 text-[11px] font-mono">
                      {item.memoriaCalculo}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.quantidade.toFixed(2)} {item.unidade}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-600">
                      {formatarMoeda(item.precoUnitario)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-700">
                      {formatarMoeda(subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatarMoeda(totalComBdi)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Exportação para Medição / Financeiro */}
      <Dialog open={modalMedicaoAberto} onOpenChange={setModalMedicaoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <Send className="w-5 h-5 text-emerald-600" />
              Lançar Medição no Financeiro a partir do Projeto 3D
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ideal para reformas ou obras novas: selecione apenas os serviços do projeto que serão executados neste período (ex: gesso, troca de pisos ou pintura).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Datas do período da medição */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Período Inicial da Medição *
                </Label>
                <Input
                  type="date"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Período Final da Medição *
                </Label>
                <Input
                  type="date"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            {/* Seleção de serviços/escopo da reforma */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-800">
                  Selecione os Serviços a Medir / Faturar:
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-primary"
                    onClick={() => selecionarTodos(true)}
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-slate-500"
                    onClick={() => selecionarTodos(false)}
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white">
                {resumo.itens.map((it) => {
                  const subtotal = it.quantidade * it.precoUnitario;
                  const totalComBdi = subtotal * (1 + resumo.bdiTaxa / 100);
                  const marcado = !!itensSelecionados[it.id];

                  return (
                    <div
                      key={it.id}
                      onClick={() => toggleItem(it.id)}
                      className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        marcado ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => toggleItem(it.id)}
                        />
                        <div>
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <span>{it.descricao}</span>
                            {it.codigoSinapi && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                #{it.codigoSinapi}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Quantitativo BIM: {it.quantidade.toFixed(2)} {it.unidade}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-semibold text-slate-900">
                          {formatarMoeda(totalComBdi)}
                        </div>
                        <div className="text-[10px] text-slate-400">c/ BDI incluso</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumo do Valor que será lançado */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {itensFiltradosParaExportar.length} serviço(s) selecionado(s)
                </div>
                <div className="text-[11px] text-emerald-700">
                  O valor será enviado como medição pronta para faturamento financeiro.
                </div>
              </div>

              <div className="text-right">
                <div className="text-[11px] text-emerald-800 font-medium">Valor Total da Medição:</div>
                <div className="text-lg font-bold font-mono text-emerald-900">
                  {formatarMoeda(valorTotalExportacao)}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalMedicaoAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarEnvioMedicao}
              disabled={criandoMedicao || itensFiltradosParaExportar.length === 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {criandoMedicao ? (
                "Gerando Medição..."
              ) : (
                <>
                  Confirmar e Ir para Medições
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
