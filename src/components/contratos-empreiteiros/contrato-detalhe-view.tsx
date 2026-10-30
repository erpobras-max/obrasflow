import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Plus,
  Ruler,
  FilePlus2,
  ShieldAlert,
  Printer,
  HardHat,
  ArrowLeft,
  Calendar,
  Building2,
  DollarSign,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContratoEditorDialog } from "./contrato-editor-dialog";
import { ContratoStatusBadge, MedicaoStatusBadge } from "./contrato-status-badge";
import { AditivoDialog } from "./aditivo-dialog";
import { RetencoesDialog } from "./retencoes-dialog";
import { MedicaoEditorSheet } from "./medicao-editor-sheet";
import { MedicaoRelatorioImprimir } from "./medicao-relatorio-imprimir";
import {
  obterDetalhesContrato,
  criarBoletimMedicao,
} from "@/lib/contratos-empreiteiros.functions";

interface ContratoDetalheViewProps {
  contratoId: string;
  onVoltar: () => void;
}

export function ContratoDetalheView({ contratoId, onVoltar }: ContratoDetalheViewProps) {
  const queryClient = useQueryClient();
  const [tabAtiva, setTabAtiva] = useState("itens");

  const [dialogAditivoOpen, setDialogAditivoOpen] = useState(false);
  const [dialogRetencoesOpen, setDialogRetencoesOpen] = useState(false);
  const [medicaoSelecionada, setMedicaoSelecionada] = useState<any | null>(null);
  const [medicaoParaImpressao, setMedicaoParaImpressao] = useState<any | null>(null);

  // Carregar dados completos do contrato
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["detalhes-contrato-empreiteiro", contratoId],
    queryFn: () => obterDetalhesContrato(contratoId),
  });

  // Carregar dados da empresa para relatório de impressão
  const { data: dadosEmpresa } = useQuery({
    queryKey: ["dados-empresa-relatorio"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_empresa").select("*").limit(1);
      return data?.[0] || null;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <span className="text-sm">Carregando detalhes do contrato...</span>
      </div>
    );
  }

  const { contrato, itens, medicoes, aditivos, retencoes } = data;

  const valorTotalContrato = Number(contrato.valor_total_atual_centavos || 0) / 100;
  const totalMedidoBruto = medicoes
    .filter((m: any) => m.status === "aprovada" || m.status === "paga")
    .reduce((acc: number, m: any) => acc + Number(m.valor_bruto_centavos || 0), 0) / 100;
  const saldoFinanceiro = Math.max(0, valorTotalContrato - totalMedidoBruto);
  const percentualGeral = valorTotalContrato > 0 ? (totalMedidoBruto / valorTotalContrato) * 100 : 0;

  const handleCriarNovaMedicao = async () => {
    try {
      const nova = await criarBoletimMedicao(contratoId, {
        periodoInicio: new Date().toISOString().split("T")[0],
        periodoFim: new Date().toISOString().split("T")[0],
      });
      toast.success(`Boletim de Medição nº ${nova.numero} aberto.`);
      await refetch();
      setMedicaoSelecionada(nova);
    } catch (err: any) {
      toast.error(`Falha ao criar medição: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Topo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onVoltar} className="h-8">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar aos Contratos
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {contrato.numero} — {contrato.objeto}
              </h1>
              <ContratoStatusBadge status={contrato.status} />
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Obra: <strong>{contrato.obras?.nome}</strong></span>
              <span>•</span>
              <span>Empreiteiro: <strong>{contrato.fornecedores?.nome_fantasia || contrato.fornecedores?.razao_social || '—'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogAditivoOpen(true)}
            className="h-8 text-xs"
          >
            <FilePlus2 className="h-3.5 w-3.5 mr-1 text-indigo-600" />
            + Termo Aditivo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogRetencoesOpen(true)}
            className="h-8 text-xs"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1 text-amber-600" />
            Retenções ({retencoes.length})
          </Button>
          <Button
            size="sm"
            onClick={handleCriarNovaMedicao}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nova Medição
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Valor Contratado Total</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {valorTotalContrato.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          {Number(contrato.valor_total_aditivos_centavos || 0) > 0 && (
            <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
              Inclui {(Number(contrato.valor_total_aditivos_centavos) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em aditivos
            </div>
          )}
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total Medido Bruto</div>
          <div className="text-xl font-bold text-blue-600 mt-1">
            {totalMedidoBruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {percentualGeral.toFixed(1)}% do escopo concluído
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Saldo a Medir</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {saldoFinanceiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Disponível para futuras medições
          </div>
        </div>

        <div className="p-4 bg-white border rounded-lg shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Boletins de Medição</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {medicoes.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {medicoes.filter((m: any) => m.status === "aprovada" || m.status === "paga").length} aprovado(s)
          </div>
        </div>
      </div>

      {/* Barra de Progresso Geral */}
      <div className="bg-white border rounded-lg p-3">
        <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
          <span>Avanço Físico-Financeiro Acumulado</span>
          <span className="font-semibold text-blue-700">{percentualGeral.toFixed(1)}%</span>
        </div>
        <Progress value={percentualGeral} className="h-2.5" />
      </div>

      {/* Abas do Contrato */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="itens" className="text-xs font-medium">
            Itens e Escopo ({itens.length})
          </TabsTrigger>
          <TabsTrigger value="medicoes" className="text-xs font-medium">
            Boletins de Medição ({medicoes.length})
          </TabsTrigger>
          <TabsTrigger value="aditivos" className="text-xs font-medium">
            Termos Aditivos ({aditivos.length})
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Itens e Escopo */}
        <TabsContent value="itens" className="mt-4">
          <div className="border rounded-md bg-white overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Código / Descrição</TableHead>
                  <TableHead className="w-24">Etapa</TableHead>
                  <TableHead className="w-16 text-center">Unid.</TableHead>
                  <TableHead className="w-24 text-right">Qtd. Contratada</TableHead>
                  <TableHead className="w-28 text-right">Preço Unit.</TableHead>
                  <TableHead className="w-28 text-right">Total Contratado</TableHead>
                  <TableHead className="w-24 text-right">Qtd. Medida</TableHead>
                  <TableHead className="w-24 text-right">Saldo Físico</TableHead>
                  <TableHead className="w-28 text-center">% Executado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-xs text-slate-400">
                      Nenhum item cadastrado neste contrato.
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((it: any, idx: number) => {
                    const preco = it.precoUnitarioCentavos / 100;
                    const total = it.precoTotalCentavos / 100;
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-slate-900">{it.descricao}</div>
                          {it.codigo && (
                            <div className="text-[10px] text-slate-400 font-mono">{it.codigo}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{it.etapa}</TableCell>
                        <TableCell className="text-center text-xs font-mono">{it.unidade}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {it.quantidadeContratada.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-slate-800">
                          {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-blue-700 font-medium">
                          {it.quantidadeMedida.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-700">
                          {it.saldoQuantidade.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <Progress value={it.percentualExecutado} className="h-1.5 w-14" />
                            <span className="text-[11px] font-mono text-slate-600">
                              {it.percentualExecutado.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Aba 2: Boletins de Medição */}
        <TabsContent value="medicoes" className="mt-4">
          <div className="border rounded-md bg-white overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-16">Boletim</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="w-28">Vencimento</TableHead>
                  <TableHead className="w-28 text-right">Valor Bruto</TableHead>
                  <TableHead className="w-28 text-right">Deduções</TableHead>
                  <TableHead className="w-28 text-right">Valor Líquido</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-36 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-400">
                      Nenhum boletim de medição emitido ainda. Clique em "Nova Medição" acima para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  medicoes.map((m: any) => {
                    const bruto = Number(m.valor_bruto_centavos || 0) / 100;
                    const deducoes =
                      (Number(m.valor_descontos_centavos || 0) +
                        Number(m.valor_amortizacao_centavos || 0) +
                        Number(m.valor_retencao_centavos || 0) +
                        Number(m.valor_tributos_centavos || 0)) /
                      100;
                    const liquido = Number(m.valor_liquido_centavos || 0) / 100;

                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-bold text-xs text-blue-700">
                          BM-{String(m.numero).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {m.periodo_inicio || "—"} até {m.periodo_fim || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">
                          {m.data_vencimento || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {bruto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-right text-xs text-rose-600">
                          {deducoes > 0
                            ? `-${deducoes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-slate-900">
                          {liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </TableCell>
                        <TableCell className="text-center">
                          <MedicaoStatusBadge status={m.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-slate-600"
                              onClick={() => {
                                setMedicaoParaImpressao(m);
                              }}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant={m.status === "aprovada" || m.status === "paga" ? "outline" : "default"}
                              className={
                                m.status === "aprovada" || m.status === "paga"
                                  ? "h-7 text-xs"
                                  : "h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                              }
                              onClick={() => setMedicaoSelecionada(m)}
                            >
                              {m.status === "aprovada" || m.status === "paga" ? "Visualizar" : "Medir"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Aba 3: Aditivos */}
        <TabsContent value="aditivos" className="mt-4">
          <div className="border rounded-md bg-white overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead className="w-24">Tipo</TableHead>
                  <TableHead>Objeto / Justificativa</TableHead>
                  <TableHead className="w-28 text-right">Acréscimo R$</TableHead>
                  <TableHead className="w-24 text-center">Prazo (Dias)</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aditivos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                      Nenhum termo aditivo cadastrado para este contrato.
                    </TableCell>
                  </TableRow>
                ) : (
                  aditivos.map((ad: any) => {
                    const acrescimo = Number(ad.valor_acrescimo_centavos || 0) / 100;
                    return (
                      <TableRow key={ad.id}>
                        <TableCell className="font-bold text-xs text-indigo-700">
                          TA-{String(ad.numero).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="text-xs uppercase text-slate-500 font-semibold">
                          {ad.tipo}
                        </TableCell>
                        <TableCell className="text-xs text-slate-800">{ad.objeto}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-indigo-700">
                          {acrescimo > 0
                            ? acrescimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs font-mono">
                          {ad.dias_prazo > 0 ? `+${ad.dias_prazo} dias` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-emerald-500 text-emerald-700 text-[10px]">
                            {ad.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog do Aditivo */}
      <AditivoDialog
        open={dialogAditivoOpen}
        onOpenChange={setDialogAditivoOpen}
        contratoId={contratoId}
        onAditivoCriado={refetch}
      />

      {/* Dialog de Retenções */}
      <RetencoesDialog
        open={dialogRetencoesOpen}
        onOpenChange={setDialogRetencoesOpen}
        retencoes={retencoes}
        onRetencaoLiberada={refetch}
      />

      {/* Sheet de Edição e Aprovação do Boletim de Medição */}
      {medicaoSelecionada && (
        <MedicaoEditorSheet
          open={Boolean(medicaoSelecionada)}
          onOpenChange={(op) => {
            if (!op) setMedicaoSelecionada(null);
          }}
          contrato={contrato}
          medicao={medicaoSelecionada}
          itensContrato={itens}
          onMedicaoSalva={refetch}
          onAbrirImpressao={(mId) => {
            const m = medicoes.find((item: any) => item.id === mId) || medicaoSelecionada;
            setMedicaoParaImpressao(m);
          }}
        />
      )}

      {/* Relatório Imprimível do Boletim */}
      {medicaoParaImpressao && (
        <MedicaoRelatorioImprimir
          open={Boolean(medicaoParaImpressao)}
          onOpenChange={(op) => {
            if (!op) setMedicaoParaImpressao(null);
          }}
          contrato={contrato}
          medicao={medicaoParaImpressao}
          itens={itens}
          empresa={dadosEmpresa}
        />
      )}
    </div>
  );
}

