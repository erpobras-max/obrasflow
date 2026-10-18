import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  RefreshCw,
  Layers,
  Plus,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  BookOpen,
  ArrowRight,
  Database,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { UFS_BRASIL } from "@/lib/sinapi";
import { SINAPI_GRUPOS, SinapiGrupo } from "@/lib/sinapi-grupos";
import {
  obterDatasOficiaisCaixa,
  consultarSinapiOficialCaixa,
  obterAnaliticoComposicaoCaixa,
  sincronizarSinapiParaBanco,
  SinapiItemResultado,
  SinapiItemAnalitico,
} from "@/lib/sinapi.functions";

interface ConsultaSinapiOficialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultUf?: string;
  defaultAnoMes?: string;
  orcamentoId?: string;
  etapasDisponiveis?: string[];
  onItemAdicionado?: () => void;
}

export function ConsultaSinapiOficialModal({
  open,
  onOpenChange,
  defaultUf = "MG",
  defaultAnoMes,
  orcamentoId,
  etapasDisponiveis = [],
  onItemAdicionado,
}: ConsultaSinapiOficialModalProps) {
  // Filtros
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [dataPreco, setDataPreco] = useState<string>(defaultAnoMes || "2026-09");
  const [uf, setUf] = useState<string>(defaultUf);
  const [tipo, setTipo] = useState<"todos" | "insumos" | "composicoes">("todos");
  const [grupoId, setGrupoId] = useState<string>("0");
  const [codigo, setCodigo] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");

  // Estado da busca
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [resultado, setResultado] = useState<{
    total: number;
    pagina: number;
    totalPaginas: number;
    itens: SinapiItemResultado[];
  }>({ total: 0, pagina: 1, totalPaginas: 1, itens: [] });
  const [pagina, setPagina] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal Analítico
  const [analiticoOpen, setAnaliticoOpen] = useState<boolean>(false);
  const [analiticoLoading, setAnaliticoLoading] = useState<boolean>(false);
  const [analiticoData, setAnaliticoData] = useState<{
    codigoComposicao: string;
    totalSemDesoneracao: number;
    totalComDesoneracao: number;
    itens: SinapiItemAnalitico[];
  } | null>(null);
  const [selectedComposicaoDesc, setSelectedComposicaoDesc] = useState<string>("");

  // Diálogo para Adicionar ao Orçamento
  const [adicionarOpen, setAdicionarOpen] = useState<boolean>(false);
  const [itemParaAdicionar, setItemParaAdicionar] = useState<SinapiItemResultado | null>(null);
  const [etapaSelecionada, setEtapaSelecionada] = useState<string>(etapasDisponiveis[0] || "Geral");
  const [novaEtapa, setNovaEtapa] = useState<string>("");
  const [quantidade, setQuantidade] = useState<string>("1.00");
  const [tipoPreco, setTipoPreco] = useState<"com_desoneracao" | "sem_desoneracao">(
    "sem_desoneracao",
  );
  const [savingItem, setSavingItem] = useState<boolean>(false);

  // Carregar lista oficial de datas ao abrir
  useEffect(() => {
    if (open) {
      obterDatasOficiaisCaixa()
        .then((datas) => {
          if (Array.isArray(datas) && datas.length > 0) {
            setDatasDisponiveis(datas);
            if (!defaultAnoMes) {
              setDataPreco(datas[0]);
            }
          }
        })
        .catch((err) => {
          console.warn("Erro ao obter datas da Caixa:", err);
        });
    }
  }, [open, defaultAnoMes]);

  // Executar pesquisa
  const handlePesquisar = async (targetPagina = 1) => {
    if (!dataPreco || !uf) {
      toast.error("Selecione a Data de Preço e a UF para consultar.");
      return;
    }

    setLoading(true);
    try {
      const resp = await consultarSinapiOficialCaixa({
        data: {
          anoMes: dataPreco,
          uf,
          tipo,
          grupoId: grupoId && grupoId !== "0" ? Number(grupoId) : undefined,
          codigo: codigo.trim() || undefined,
          descricao: descricao.trim() || undefined,
          pagina: targetPagina,
          itensPorPagina: 20,
        },
      });
      setResultado(resp);
      setPagina(targetPagina);
    } catch (err: unknown) {
      toast.error(
        `Erro ao consultar dados da Caixa: ${(err as Error)?.message || "Tente novamente"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  // Abrir Composição Analítica
  const handleVerAnalitico = async (item: SinapiItemResultado) => {
    setSelectedComposicaoDesc(item.descricao);
    setAnaliticoOpen(true);
    setAnaliticoLoading(true);
    setAnaliticoData(null);

    try {
      const resp = await obterAnaliticoComposicaoCaixa({
        data: {
          anoMes: dataPreco,
          uf,
          codigoComposicao: item.codigo,
        },
      });
      setAnaliticoData(resp);
    } catch (err: unknown) {
      toast.error(`Erro ao carregar itens analíticos: ${(err as Error)?.message}`);
      setAnaliticoOpen(false);
    } finally {
      setAnaliticoLoading(false);
    }
  };

  // Copiar código
  const handleCopyCode = (cod: string) => {
    navigator.clipboard.writeText(cod);
    setCopiedCode(cod);
    toast.success(`Código ${cod} copiado!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Sincronizar com o Banco Local Supabase
  const handleSincronizarBanco = async () => {
    setSyncing(true);
    const toastId = toast.loading(
      `Sincronizando ${dataPreco} (${uf}) da Caixa para o banco de dados...`,
    );
    try {
      const resp = await sincronizarSinapiParaBanco({
        data: {
          anoMes: dataPreco,
          uf,
        },
      });
      toast.success(
        `Catálogo SINAPI ${resp.mesReferencia} - ${resp.uf} salvo com sucesso! (${resp.total.toLocaleString()} registros indexados)`,
        { id: toastId },
      );
    } catch (err: unknown) {
      toast.error(`Falha ao sincronizar com banco: ${(err as Error)?.message}`, { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  // Confirmar adição ao orçamento
  const handleConfirmarAdicionar = async () => {
    if (!orcamentoId || !itemParaAdicionar) return;

    const etapaFinal = novaEtapa.trim() || etapaSelecionada || "Geral";
    const qtdNum = parseFloat(quantidade.replace(",", "."));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }

    const valorUnitarioReais =
      tipoPreco === "com_desoneracao"
        ? itemParaAdicionar.precoComDesoneracao
        : itemParaAdicionar.precoSemDesoneracao;

    const valorUnitarioCentavos = Math.round(valorUnitarioReais * 100);
    const valorTotalCentavos = Math.round(valorUnitarioCentavos * qtdNum);

    setSavingItem(true);
    try {
      // Inserir item no orcamento
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("orcamento_itens").insert({
        orcamento_id: orcamentoId,
        codigo: itemParaAdicionar.codigo,
        descricao: itemParaAdicionar.descricao,
        unidade: itemParaAdicionar.unidade,
        quantidade: qtdNum,
        valor_unitario: valorUnitarioCentavos,
        valor_total: valorTotalCentavos,
        etapa: etapaFinal,
        fonte_referencia: "sinapi",
        tipo_referencia: itemParaAdicionar.tipo === "C" ? "composicao" : "insumo",
        referencia_uf: uf,
        referencia_mes: dataPreco,
      });

      if (error) throw error;

      toast.success(`Item ${itemParaAdicionar.codigo} adicionado à etapa "${etapaFinal}"!`);
      setAdicionarOpen(false);
      setItemParaAdicionar(null);
      if (onItemAdicionado) onItemAdicionado();
    } catch (err: unknown) {
      toast.error(`Erro ao adicionar item ao orçamento: ${(err as Error)?.message}`);
    } finally {
      setSavingItem(false);
    }
  };

  const gruposFiltrados = useMemo(() => {
    return SINAPI_GRUPOS.filter((g) => g.id !== 0);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header estilizado Caixa */}
          <div className="bg-gradient-to-r from-[#005CA9] via-[#0069c2] to-[#004b8a] text-white p-5 border-b flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none uppercase tracking-wider text-[11px] font-bold">
                  SINAPI Oficial • Caixa Econômica Federal
                </Badge>
                <span className="text-white/60 text-xs">• API Direta</span>
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Consulta de Preços e Custos
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs sm:text-sm">
                Inclui referências com e sem custo/preço, conforme publicação oficial do SINAPI.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSincronizarBanco}
                disabled={syncing}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Database className="w-4 h-4 mr-2 text-amber-300" />
                )}
                Sincronizar no Banco ({uf})
              </Button>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="p-4 bg-muted/30 border-b space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Data Preço */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Data Preço</label>
                <Select value={dataPreco} onValueChange={setDataPreco}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(datasDisponiveis.length > 0
                      ? datasDisponiveis
                      : ["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"]
                    ).map((dt) => (
                      <SelectItem key={dt} value={dt} className="font-mono">
                        {dt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* UF */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">UF</label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {UFS_BRASIL.map((u) => (
                      <SelectItem key={u} value={u} className="font-semibold">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo Referência */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Tipo Referência
                </label>
                <Select
                  value={tipo}
                  onValueChange={(v: "todos" | "insumos" | "composicoes") => setTipo(v)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Insumos (I) / Composições (C)</SelectItem>
                    <SelectItem value="insumos">Insumos (I)</SelectItem>
                    <SelectItem value="composicoes">Composições (C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Grupo */}
              <div className="space-y-1 lg:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Grupo</label>
                <Select value={grupoId} onValueChange={setGrupoId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todos os grupos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="0">Todos os Grupos ({gruposFiltrados.length})</SelectItem>
                    {gruposFiltrados.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Código */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Código</label>
                <Input
                  placeholder="Ex: 104658"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePesquisar(1)}
                  className="bg-background font-mono"
                />
              </div>
            </div>

            {/* Linha 2 de filtros: Descrição + Botão Pesquisar */}
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="space-y-1 flex-1 w-full">
                <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Digite palavras-chave (ex: rampa acessibilidade concreto)..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePesquisar(1)}
                    className="pl-9 bg-background"
                  />
                </div>
              </div>

              <Button
                onClick={() => handlePesquisar(1)}
                disabled={loading}
                className="bg-[#005CA9] hover:bg-[#004b8a] text-white min-w-[130px] font-semibold shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Consultar
              </Button>
            </div>
          </div>

          {/* Área de Resultados */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status bar */}
            <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-md border">
              <div className="font-semibold text-foreground">
                Resultado [ Data:{" "}
                <span className="font-mono text-primary font-bold">{dataPreco}</span> ] [ UF:{" "}
                <span className="font-mono text-primary font-bold">{uf}</span> ] —{" "}
                <span className="text-primary font-bold">{resultado.total.toLocaleString()}</span>{" "}
                registros
              </div>
              {resultado.totalPaginas > 1 && (
                <div>
                  Página {resultado.pagina} de {resultado.totalPaginas}
                </div>
              )}
            </div>

            {/* Tabela de Itens */}
            <div className="border rounded-md overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead className="w-12 text-center font-bold">Tipo</TableHead>
                    <TableHead className="w-24 font-bold">Código</TableHead>
                    <TableHead className="font-bold">
                      Descrição do Insumo/Composição [Grupo]
                    </TableHead>
                    <TableHead className="w-16 text-center font-bold">Unid.</TableHead>
                    <TableHead className="w-32 text-right font-bold">Sem Desoneração</TableHead>
                    <TableHead className="w-32 text-right font-bold">Com Desoneração</TableHead>
                    <TableHead className="w-16 text-center font-bold">% AS</TableHead>
                    <TableHead className="w-28 text-center font-bold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          <span>Consultando base oficial do SINAPI na Caixa...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : resultado.itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-40 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Info className="w-6 h-6 text-muted-foreground/60" />
                          <p className="font-medium">
                            Nenhum resultado encontrado para os filtros selecionados.
                          </p>
                          <p className="text-xs">
                            Clique em <strong>Consultar</strong> ou altere o código, descrição ou
                            grupo.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    resultado.itens.map((item) => (
                      <TableRow key={item.codigoCompleto} className="hover:bg-muted/40 group">
                        {/* Tipo */}
                        <TableCell className="text-center font-bold">
                          {item.tipo === "C" ? (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200"
                            >
                              C
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200"
                            >
                              I
                            </Badge>
                          )}
                        </TableCell>

                        {/* Código */}
                        <TableCell className="font-mono font-medium text-xs">
                          <div className="flex items-center gap-1">
                            <span>{item.codigo}</span>
                            <button
                              onClick={() => handleCopyCode(item.codigo)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded text-muted-foreground"
                              title="Copiar código"
                            >
                              {copiedCode === item.codigo ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>

                        {/* Descrição + Grupo */}
                        <TableCell>
                          <div className="space-y-1">
                            <span className="text-xs font-normal leading-relaxed text-foreground">
                              {item.descricao}
                            </span>
                            {item.grupoNome && item.grupoNome !== "Geral" && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {item.grupoLink ? (
                                  <a
                                    href={item.grupoLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:underline border border-sky-100"
                                  >
                                    <BookOpen className="w-2.5 h-2.5" />
                                    {item.grupoNome}
                                    <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />
                                  </a>
                                ) : (
                                  <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                    {item.grupoNome}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Unidade */}
                        <TableCell className="text-center font-mono text-xs font-semibold">
                          {item.unidade}
                        </TableCell>

                        {/* Sem Desoneração */}
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {item.precoSemDesoneracao > 0
                            ? item.precoSemDesoneracao.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </TableCell>

                        {/* Com Desoneração */}
                        <TableCell className="text-right font-mono text-xs font-semibold text-muted-foreground">
                          {item.precoComDesoneracao > 0
                            ? item.precoComDesoneracao.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </TableCell>

                        {/* % AS */}
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {item.percentualAS !== undefined ? `${item.percentualAS}%` : "-"}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {item.tipo === "C" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVerAnalitico(item)}
                                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                title="Ver Composição Analítica (Insumos e Coeficientes)"
                              >
                                <Layers className="w-3.5 h-3.5 mr-1" />
                                Analítico
                              </Button>
                            )}

                            {orcamentoId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setItemParaAdicionar(item);
                                  setAdicionarOpen(true);
                                }}
                                className="h-7 px-2 text-xs border-primary/30 text-primary hover:bg-primary/10"
                                title="Adicionar ao Orçamento Ativo"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Orçamento
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {resultado.totalPaginas > 1 && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Mostrando {resultado.itens.length} de {resultado.total.toLocaleString()} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina <= 1 || loading}
                    onClick={() => handlePesquisar(pagina - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs font-medium px-2">
                    {pagina} / {resultado.totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagina >= resultado.totalPaginas || loading}
                    onClick={() => handlePesquisar(pagina + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: DETALHAMENTO ANALÍTICO DA COMPOSIÇÃO */}
      <Dialog open={analiticoOpen} onOpenChange={setAnaliticoOpen}>
        <DialogContent className="max-w-4xl w-[92vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="p-4 bg-muted border-b flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white font-bold text-xs">
                  Composição Analítica
                </Badge>
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  Código: {analiticoData?.codigoComposicao}
                </span>
              </div>
              <DialogTitle className="text-base font-semibold leading-snug">
                {selectedComposicaoDesc}
              </DialogTitle>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            {analiticoLoading ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Carregando árvore de insumos e coeficientes...</span>
              </div>
            ) : !analiticoData || analiticoData.itens.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum detalhamento analítico registrado para esta composição nesta competência.
              </div>
            ) : (
              <>
                <div className="border rounded-md overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12 text-center">Tipo</TableHead>
                        <TableHead className="w-20">Código</TableHead>
                        <TableHead>Descrição do Item Filho</TableHead>
                        <TableHead className="w-16 text-center">Unid.</TableHead>
                        <TableHead className="w-20 text-right">Coeficiente</TableHead>
                        <TableHead className="w-24 text-right">Preço Unit. (R$)</TableHead>
                        <TableHead className="w-24 text-right">Custo Total (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analiticoData.itens.map((subItem) => (
                        <TableRow key={subItem.codigoCompleto}>
                          <TableCell className="text-center font-bold">
                            <Badge
                              variant="outline"
                              className={
                                subItem.tipo === "C"
                                  ? "bg-blue-50 text-blue-700 text-[10px]"
                                  : "bg-emerald-50 text-emerald-700 text-[10px]"
                              }
                            >
                              {subItem.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{subItem.codigo}</TableCell>
                          <TableCell className="text-xs">{subItem.descricao}</TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {subItem.unidade}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {subItem.coeficiente.toLocaleString("pt-BR", {
                              minimumFractionDigits: 4,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {subItem.precoUnitarioSemDesoneracao.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {subItem.custoTotalSemDesoneracao.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Subtotais */}
                <div className="flex flex-wrap items-center justify-end gap-6 p-3 bg-muted/30 rounded-md border text-sm">
                  <div>
                    <span className="text-muted-foreground mr-2">Total Sem Desoneração:</span>
                    <strong className="font-mono text-primary text-base">
                      R${" "}
                      {analiticoData.totalSemDesoneracao.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground mr-2">Total Com Desoneração:</span>
                    <strong className="font-mono text-muted-foreground text-base">
                      R${" "}
                      {analiticoData.totalComDesoneracao.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: ADICIONAR ITEM AO ORÇAMENTO */}
      <Dialog open={adicionarOpen} onOpenChange={setAdicionarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar ao Orçamento</DialogTitle>
            <DialogDescription className="text-xs">
              Configure a etapa e a quantidade para inserir o item selecionado.
            </DialogDescription>
          </DialogHeader>

          {itemParaAdicionar && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded border space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono font-bold">
                    {itemParaAdicionar.codigo}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Unidade: {itemParaAdicionar.unidade}
                  </span>
                </div>
                <p className="text-xs font-medium line-clamp-2">{itemParaAdicionar.descricao}</p>
              </div>

              {/* Etapa */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">Etapa do Orçamento</label>
                {etapasDisponiveis.length > 0 ? (
                  <Select value={etapaSelecionada} onValueChange={setEtapaSelecionada}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {etapasDisponiveis.map((et) => (
                        <SelectItem key={et} value={et}>
                          {et}
                        </SelectItem>
                      ))}
                      <SelectItem value="__nova__">+ Criar nova etapa...</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}

                {(etapaSelecionada === "__nova__" || etapasDisponiveis.length === 0) && (
                  <Input
                    placeholder="Nome da etapa (ex: Fundações, Alvenaria)"
                    value={novaEtapa}
                    onChange={(e) => setNovaEtapa(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>

              {/* Quantidade */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Quantidade ({itemParaAdicionar.unidade})
                </label>
                <Input
                  type="text"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="1.00"
                  className="font-mono"
                />
              </div>

              {/* Preço (Sem ou Com Desoneração) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">Regime de Desoneração</label>
                <Select
                  value={tipoPreco}
                  onValueChange={(v: "com_desoneracao" | "sem_desoneracao") => setTipoPreco(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem_desoneracao">
                      Sem Desoneração (R${" "}
                      {itemParaAdicionar.precoSemDesoneracao.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </SelectItem>
                    <SelectItem value="com_desoneracao">
                      Com Desoneração (R${" "}
                      {itemParaAdicionar.precoComDesoneracao.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                      )
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Total estimado */}
              <div className="p-3 bg-primary/5 rounded border border-primary/20 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Valor Total Estimado:
                </span>
                <span className="font-mono font-bold text-primary text-base">
                  R${" "}
                  {(
                    (parseFloat(quantidade.replace(",", ".")) || 0) *
                    (tipoPreco === "com_desoneracao"
                      ? itemParaAdicionar.precoComDesoneracao
                      : itemParaAdicionar.precoSemDesoneracao)
                  ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAdicionarOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmarAdicionar} disabled={savingItem}>
                  {savingItem ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Confirmar e Adicionar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
