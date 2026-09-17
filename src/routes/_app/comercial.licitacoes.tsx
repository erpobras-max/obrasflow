import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, MapPin, Calendar, ExternalLink, Loader2, Info, AlertTriangle,
  FileText, ArrowRight, ChevronLeft, ChevronRight, Filter, BookOpen, AlertCircle,
  FolderPlus
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client.custom";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/comercial/licitacoes")({
  component: LicitacoesPage,
});

interface PNCPItem {
  numeroControlePNCP: string;
  orgaoEntidade: {
    cnpj: string;
    razaoSocial: string;
    poderId: string;
    esferaId: string;
  };
  unidadeOrgao: {
    ufSigla: string;
    municipioNome: string;
    codigoIbge: string;
    nomeUnidade: string;
  };
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra: string;
  modalidadeId: number;
  modalidadeNome: string;
  objetoCompra?: string;
  objeto?: string;
  valorTotalEstimado?: number;
  dataPublicacaoPncp: string;
  dataAberturaProposta?: string;
  dataEncerramentoProposta?: string;
  situacaoCompraNome?: string;
  linkSistemaOrigem?: string;
  linkProcessoEletronico?: string;
}

interface PNCPResponse {
  data: PNCPItem[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
}

const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const MODALIDADES = [
  { code: "Todas", label: "Todas (Principais)" },
  { code: "4", label: "Concorrência" },
  { code: "5", label: "Pregão" },
  { code: "6", label: "Dispensa de Licitação" },
  { code: "7", label: "Inexigibilidade" },
  { code: "1", label: "Leilão" },
  { code: "8", label: "Credenciamento" },
  { code: "9", label: "Pré-qualificação" },
];

const OBRAS_KEYWORDS = [
  "obra", "reforma", "pavimentação", "pavimentacao", "construção", "construcao",
  "saneamento", "edificação", "edificacao", "retrofit", "engenharia", "demolição",
  "demolicao", "infraestrutura", "drenagem", "asfalto", "recapeamento", "terraplenagem",
  "iluminação pública", "iluminacao publica", "galeria", "viaduto", "ponte"
];

const matchesKeywords = (text: string) => {
  if (!text) return false;
  const normalizedText = text.toLowerCase();
  return OBRAS_KEYWORDS.some(keyword => normalizedText.includes(keyword));
};

const formatCurrency = (v: number | undefined | null) => {
  if (v === undefined || v === null || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatDate = (dateStr: string | undefined | null) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

const fetchPNCP = async (url: string): Promise<PNCPResponse> => {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
    }
  });
  if (!res.ok) {
    throw new Error(`Erro ${res.status}: ${res.statusText}`);
  }
  return res.json();
};

function LicitacoesPage() {
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const defaultEnd = new Date();

  const formatDateInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [uf, setUf] = useState<string>("Todos");
  const [dataInicial, setDataInicial] = useState<string>(formatDateInput(defaultStart));
  const [dataFinal, setDataFinal] = useState<string>(formatDateInput(defaultEnd));
  const [modalidade, setModalidade] = useState<string>("Todas");
  const [apenasObras, setApenasObras] = useState<boolean>(true);
  const [termoBusca, setTermoBusca] = useState<string>("");
  const [pagina, setPagina] = useState<number>(1);
  const [detailTarget, setDetailTarget] = useState<PNCPItem | null>(null);

  const queryClient = useQueryClient();
  const importMutation = useMutation({
    mutationFn: async (item: PNCPItem) => {
      const { error } = await supabase
        .from("oportunidades" as any)
        .insert({
          titulo: `Licitação - ${item.orgaoEntidade?.razaoSocial?.slice(0, 100)}`,
          descricao: `Objeto: ${item.objetoCompra || item.objeto || "Não especificado"}\n\nModalidade: ${item.modalidadeNome}\nEdital: Nº ${item.numeroCompra || "—"}/${item.anoCompra}\nPNCP ID: ${item.numeroControlePNCP}`,
          valor_estimado: item.valorTotalEstimado ? Math.round(item.valorTotalEstimado) : null,
          status: "novo",
          probabilidade: 30,
          data_prevista: item.dataAberturaProposta ? item.dataAberturaProposta.slice(0, 10) : null
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Oportunidade importada com sucesso no funil de Vendas!");
      queryClient.invalidateQueries({ queryKey: ["oportunidades"] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao importar oportunidade: ${err.message}`);
    }
  });

  // Reset page when filters change
  useEffect(() => {
    setPagina(1);
  }, [uf, dataInicial, dataFinal, modalidade]);

  const dataInicialClean = dataInicial.replace(/-/g, "");
  const dataFinalClean = dataFinal.replace(/-/g, "");

  const { data: queryData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["licitacoes", uf, dataInicialClean, dataFinalClean, modalidade, pagina],
    queryFn: async () => {
      const ufParam = uf !== "Todos" ? `&uf=${uf}` : "";

      if (modalidade !== "Todas") {
        const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicialClean}&dataFinal=${dataFinalClean}${ufParam}&pagina=${pagina}&tamanhoPagina=50&codigoModalidadeContratacao=${modalidade}`;
        const result = await fetchPNCP(url);
        return {
          data: result.data || [],
          totalRegistros: result.totalRegistros || 0,
          totalPaginas: result.totalPaginas || 1,
        };
      } else {
        // Fetch major modalities in parallel: Concorrência (4), Pregão (5), Dispensa (6), Inexigibilidade (7)
        const codes = [4, 5, 6, 7];
        const promises = codes.map(code => {
          const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dataInicialClean}&dataFinal=${dataFinalClean}${ufParam}&pagina=${pagina}&tamanhoPagina=25&codigoModalidadeContratacao=${code}`;
          return fetchPNCP(url).catch(err => {
            console.warn(`Erro ao buscar modalidade ${code}:`, err);
            return { data: [], totalRegistros: 0, totalPaginas: 1, numeroPagina: 1 };
          });
        });

        const results = await Promise.all(promises);

        let mergedData: PNCPItem[] = [];
        let totalRegistros = 0;

        results.forEach(res => {
          if (res.data) mergedData = mergedData.concat(res.data);
          if (res.totalRegistros) totalRegistros += res.totalRegistros;
        });

        // Sort by publication date descending
        mergedData.sort((a, b) => {
          const dateA = new Date(a.dataPublicacaoPncp).getTime();
          const dateB = new Date(b.dataPublicacaoPncp).getTime();
          return dateB - dateA;
        });

        const totalPaginas = Math.max(1, Math.ceil(totalRegistros / 100));

        return {
          data: mergedData,
          totalRegistros,
          totalPaginas,
        };
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredItems = useMemo(() => {
    if (!queryData?.data) return [];

    return queryData.data.filter(item => {
      const desc = (item.objetoCompra || item.objeto || "").toLowerCase();
      const orgao = (item.orgaoEntidade?.razaoSocial || "").toLowerCase();
      const municipio = (item.unidadeOrgao?.municipioNome || "").toLowerCase();

      // Construction filter
      if (apenasObras) {
        const isWork = matchesKeywords(desc);
        if (!isWork) return false;
      }

      // Keyword search text filter
      if (termoBusca.trim()) {
        const term = termoBusca.toLowerCase().trim();
        const matchDesc = desc.includes(term);
        const matchOrgao = orgao.includes(term);
        const matchMunicipio = municipio.includes(term);
        const matchNum = (item.numeroCompra || "").includes(term);
        const matchControl = (item.numeroControlePNCP || "").includes(term);

        if (!matchDesc && !matchOrgao && !matchMunicipio && !matchNum && !matchControl) {
          return false;
        }
      }

      return true;
    });
  }, [queryData?.data, apenasObras, termoBusca]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6 text-primary" /> Licitações do Setor de Obras
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe oportunidades de contratações públicas integradas em tempo real com o Portal Nacional de Contratações Públicas (PNCP).
          </p>
        </div>
        {isFetching && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/30 px-3 py-1.5 rounded-full border border-border">
            <Loader2 className="size-3.5 animate-spin text-primary" /> Atualizando...
          </div>
        )}
      </div>

      <Card className="border-border bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" /> Filtros de Pesquisa
          </CardTitle>
          <CardDescription>Refine sua pesquisa no banco de dados governamental do PNCP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estado (UF)</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os Estados</SelectItem>
                  {BRAZIL_STATES.map(st => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Modalidade</Label>
              <Select value={modalidade} onValueChange={setModalidade}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a Modalidade" />
                </SelectTrigger>
                <SelectContent>
                  {MODALIDADES.map(mod => (
                    <SelectItem key={mod.code} value={mod.code}>{mod.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Inicial</Label>
              <Input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data Final</Label>
              <Input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/60">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Pesquisa Textual (Filtragem Local)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquise por palavra-chave no objeto, CNPJ, número ou órgão..."
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="flex items-end pb-1">
              <div className="flex items-center space-x-2 bg-accent/20 px-3 py-2.5 rounded-md border border-border/80 w-full">
                <Checkbox
                  id="apenas-obras"
                  checked={apenasObras}
                  onCheckedChange={(checked) => setApenasObras(!!checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="apenas-obras"
                    className="text-xs font-semibold cursor-pointer select-none"
                  >
                    Apenas Obras e Engenharia
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Filtra objetos contendo obras, reformas, asfalto, etc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="size-4" />
          <AlertTitle>Erro de Conexão com o PNCP</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Não foi possível estabelecer contato com a API pública do governo federal. Isso ocorre devido a intermitências temporárias no Portal de Contratações Públicas.
            </p>
            <Button size="sm" variant="outline" className="gap-2 border-destructive/30 hover:bg-destructive/10" onClick={() => refetch()}>
              Tentar Novamente
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="rounded-md border border-border">
            <div className="p-4 border-b border-border bg-muted/20">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col md:flex-row gap-4 justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                  <div className="space-y-2 w-32 shrink-0 md:text-right">
                    <Skeleton className="h-4 w-20 md:ml-auto" />
                    <Skeleton className="h-4 w-24 md:ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed border-2 border-border/60 py-12 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="size-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">Nenhuma licitação encontrada</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1 px-4">
            Não foram localizados registros no período e região informados que atendessem aos filtros estabelecidos. {apenasObras && "Tente desmarcar a opção 'Apenas Obras e Engenharia' ou ampliar o período da busca."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div>
              Mostrando <span className="font-semibold text-foreground">{filteredItems.length}</span> de{" "}
              <span className="font-semibold text-foreground">{queryData?.totalRegistros || filteredItems.length}</span> registros retornados do portal.
            </div>
            {apenasObras && (
              <div className="flex items-center gap-1 bg-primary/10 text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20">
                Filtro de Obras Ativo
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Órgão / Ente Público</th>
                    <th className="px-4 py-3 font-semibold">Modalidade / Edital</th>
                    <th className="px-4 py-3 font-semibold">Objeto da Contratação</th>
                    <th className="px-4 py-3 font-semibold">Valor Estimado</th>
                    <th className="px-4 py-3 font-semibold">Datas Principais</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => {
                    const desc = item.objetoCompra || item.objeto || "";
                    const isTruncated = desc.length > 140;
                    const cleanDesc = isTruncated ? desc.slice(0, 140) + "..." : desc;

                    return (
                      <tr key={item.numeroControlePNCP} className="hover:bg-accent/10 transition-colors">
                        <td className="px-4 py-4 max-w-[200px]">
                          <div className="font-semibold text-foreground leading-tight truncate" title={item.orgaoEntidade?.razaoSocial}>
                            {item.orgaoEntidade?.razaoSocial}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                            <MapPin className="size-3 text-muted-foreground/70" />
                            {item.unidadeOrgao?.municipioNome} / {item.unidadeOrgao?.ufSigla}
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <Badge variant="outline" className="font-medium bg-background border-border/80">
                            {item.modalidadeNome || `Cod: ${item.modalidadeId}`}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1.5 font-mono">
                            Nº {item.numeroCompra || "—"}/{item.anoCompra}
                          </div>
                        </td>

                        <td className="px-4 py-4 max-w-[320px]">
                          <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                            {cleanDesc}
                          </p>
                          {isTruncated && (
                            <button
                              onClick={() => setDetailTarget(item)}
                              className="text-xs text-primary hover:underline font-medium mt-1 inline-flex items-center gap-0.5"
                            >
                              Ver mais detalhes
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-semibold font-mono text-xs">
                          {formatCurrency(item.valorTotalEstimado)}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="font-medium text-[10px] uppercase bg-muted px-1 rounded">Pub:</span>
                            <span>{item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp).toLocaleDateString("pt-BR") : "—"}</span>
                          </div>
                          {item.dataAberturaProposta && (
                            <div className="flex items-center gap-1.5 text-foreground font-medium">
                              <span className="font-medium text-[10px] uppercase bg-primary/10 text-primary-foreground px-1 rounded">Abert:</span>
                              <span>{new Date(item.dataAberturaProposta).toLocaleDateString("pt-BR")}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-primary hover:bg-primary/10"
                              title="Importar Oportunidade"
                              disabled={importMutation.isPending}
                              onClick={() => importMutation.mutate(item)}
                            >
                              <FolderPlus className="size-4" />
                            </Button>

                            <Button size="icon" variant="ghost" className="size-8" title="Ver Detalhes" onClick={() => setDetailTarget(item)}>
                              <Info className="size-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            
                            {item.orgaoEntidade?.cnpj && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="size-8"
                                title="Abrir no Portal PNCP"
                                asChild
                              >
                                <a
                                  href={`https://pncp.gov.br/app/editais/${item.orgaoEntidade.cnpj}/${item.anoCompra}/${item.sequencialCompra}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1 || isFetching}
              onClick={() => setPagina(prev => Math.max(1, prev - 1))}
              className="gap-1.5"
            >
              <ChevronLeft className="size-4" /> Anterior
            </Button>
            <div className="text-xs text-muted-foreground">
              Página <span className="font-semibold text-foreground">{pagina}</span> de{" "}
              <span className="font-semibold text-foreground">{queryData?.totalPaginas || 1}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= (queryData?.totalPaginas || 1) || isFetching}
              onClick={() => setPagina(prev => prev + 1)}
              className="gap-1.5"
            >
              Próxima <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2.5 text-base md:text-lg">
              <FileText className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="block leading-snug">Detalhamento da Licitação</span>
                <span className="text-xs text-muted-foreground font-mono mt-1 block font-normal">
                  PNCP ID: {detailTarget?.numeroControlePNCP}
                </span>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dados consolidados extraídos diretamente da base pública do PNCP.
            </DialogDescription>
          </DialogHeader>

          {detailTarget && (
            <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-accent/10 p-3 rounded-md border border-border/60">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Órgão Comprador</div>
                  <div className="font-semibold mt-0.5 text-foreground leading-tight">{detailTarget.orgaoEntidade?.razaoSocial}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">CNPJ: {detailTarget.orgaoEntidade?.cnpj}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidade Administrativa</div>
                  <div className="font-semibold mt-0.5 text-foreground leading-tight">{detailTarget.unidadeOrgao?.nomeUnidade || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="size-3" />
                    {detailTarget.unidadeOrgao?.municipioNome} / {detailTarget.unidadeOrgao?.ufSigla}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Objeto da Licitação</div>
                <p className="text-xs leading-relaxed text-foreground bg-accent/5 p-3 rounded-md border border-border/40 font-normal whitespace-pre-wrap">
                  {detailTarget.objetoCompra || detailTarget.objeto || "Não informado"}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-border/80 p-2.5 rounded-md bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Valor Estimado</div>
                  <div className="font-mono font-bold mt-1 text-xs text-foreground">
                    {formatCurrency(detailTarget.valorTotalEstimado)}
                  </div>
                </div>
                
                <div className="border border-border/80 p-2.5 rounded-md bg-background">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Modalidade</div>
                  <div className="font-semibold mt-1 text-xs text-foreground truncate" title={detailTarget.modalidadeNome}>
                    {detailTarget.modalidadeNome || `Código ${detailTarget.modalidadeId}`}
                  </div>
                </div>

                <div className="border border-border/80 p-2.5 rounded-md bg-background col-span-2 sm:col-span-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Edital Número</div>
                  <div className="font-mono font-semibold mt-1 text-xs text-foreground truncate">
                    {detailTarget.numeroCompra || "—"}/{detailTarget.anoCompra}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Data de Publicação</span>
                    <span className="text-foreground font-medium">{formatDate(detailTarget.dataPublicacaoPncp)}</span>
                  </div>
                </div>
                {detailTarget.dataAberturaProposta && (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="size-4 text-primary" />
                    <div>
                      <span className="text-primary block text-[10px] uppercase font-semibold">Data de Abertura / Proposta</span>
                      <span className="text-foreground font-semibold">{formatDate(detailTarget.dataAberturaProposta)}</span>
                    </div>
                  </div>
                )}
              </div>

              {detailTarget.situacaoCompraNome && (
                <div className="text-xs flex items-center gap-1.5 mt-2 bg-accent/20 px-3 py-1.5 rounded border border-border/80 w-fit">
                  <span className="text-muted-foreground">Situação:</span>
                  <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider">{detailTarget.situacaoCompraNome}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t border-border/60 pt-3 sm:justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDetailTarget(null)}>
              Fechar
            </Button>
            <div className="flex gap-2">
              {detailTarget && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                  disabled={importMutation.isPending}
                  onClick={() => {
                    importMutation.mutate(detailTarget);
                    setDetailTarget(null);
                  }}
                >
                  <FolderPlus className="size-3.5" /> Importar Oportunidade
                </Button>
              )}
              {detailTarget && detailTarget.orgaoEntidade?.cnpj && (
                <Button size="sm" className="gap-1.5" asChild>
                  <a
                    href={`https://pncp.gov.br/app/editais/${detailTarget.orgaoEntidade.cnpj}/${detailTarget.anoCompra}/${detailTarget.sequencialCompra}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ir para Edital no PNCP <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
