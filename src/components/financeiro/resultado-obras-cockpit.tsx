import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, DatabaseZap, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import { useResultadoObras } from "@/hooks/use-resultado-obras";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResultadoObraEtapa, ResultadoObraFiltros } from "@/lib/resultado-obra";
import {
  filtrarAlertasAcionaveis,
  formatarCentavosResultado,
  obterEstadoCockpitResultado,
} from "@/lib/resultado-obra-apresentacao";
import { ResultadoObraDetalhesSheet } from "./resultado-obra-detalhes-sheet";
import { ResultadoObraEtapas } from "./resultado-obra-etapas";
import { ResultadoObraGraficos } from "./resultado-obra-graficos";
import { ResultadoObraKpis } from "./resultado-obra-kpis";

interface ObraOpcao {
  id: string;
  nome: string;
  numero: string | null;
}

export function ResultadoObrasCockpit({
  filtros,
  onFiltrosChange,
}: {
  filtros: ResultadoObraFiltros;
  onFiltrosChange: (filtros: ResultadoObraFiltros) => void;
}) {
  const [etapaDetalhe, setEtapaDetalhe] = useState<ResultadoObraEtapa | null>(null);
  const obras = useQuery({
    queryKey: ["resultado-obras-opcoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id,nome,numero").order("nome");
      if (error) throw error;
      return (data ?? []) as ObraOpcao[];
    },
  });
  const consulta = useResultadoObras(filtros);
  const resumo = consulta.data?.resumo ?? null;
  const estado = obterEstadoCockpitResultado({
    obraId: filtros.obraId,
    isLoading: consulta.isLoading,
    isError: consulta.isError,
    resumo,
  });
  const alterar = (parcial: Partial<ResultadoObraFiltros>) =>
    onFiltrosChange({ ...filtros, ...parcial });

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Obra</Label>
            <Select value={filtros.obraId ?? ""} onValueChange={(obraId) => alterar({ obraId })}>
              <SelectTrigger>
                <SelectValue
                  placeholder={obras.isLoading ? "Carregando obras..." : "Selecione uma obra"}
                />
              </SelectTrigger>
              <SelectContent>
                {(obras.data ?? []).map((obra) => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.numero ? `${obra.numero} · ` : ""}
                    {obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Regime</Label>
            <Select
              value={filtros.regime}
              onValueChange={(regime: "caixa" | "competencia") => alterar({ regime })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="competencia">Competência</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Período</Label>
            <Select
              value={filtros.periodo}
              onValueChange={(periodo: ResultadoObraFiltros["periodo"]) => {
                const hoje = new Date().toISOString().slice(0, 10);
                alterar({
                  periodo,
                  dataInicio: periodo === "obra_inteira" ? null : filtros.dataInicio,
                  dataFim:
                    periodo === "ate_hoje"
                      ? hoje
                      : periodo === "obra_inteira"
                        ? null
                        : filtros.dataFim,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="obra_inteira">Obra inteira</SelectItem>
                <SelectItem value="ate_hoje">Até hoje</SelectItem>
                <SelectItem value="mes">Mês / intervalo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtros.periodo === "mes" && (
            <>
              <div className="space-y-1.5 md:col-start-3">
                <Label>De</Label>
                <Input
                  type="date"
                  value={filtros.dataInicio ?? ""}
                  onChange={(e) => alterar({ dataInicio: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Até</Label>
                <Input
                  type="date"
                  value={filtros.dataFim ?? ""}
                  onChange={(e) => alterar({ dataFim: e.target.value || null })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {estado === "selecione_obra" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold">Selecione uma obra</p>
              <p className="text-sm text-muted-foreground">
                O resultado consolidado aparecerá aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {estado === "carregando" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}
      {estado === "erro" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível carregar o resultado</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              {consulta.error instanceof Error ? consulta.error.message : "Tente novamente."}
            </span>
            <Button size="sm" variant="outline" onClick={() => consulta.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {resumo && !consulta.isLoading && !consulta.isError && (
        <>
          {estado === "sem_orcamento" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Obra sem orçamento analítico atual</AlertTitle>
              <AlertDescription>
                Os movimentos são exibidos, mas BAC, IDC, EAC e desvio não podem ser calculados.
              </AlertDescription>
            </Alert>
          )}
          {resumo.qualidade.temDadosParciais && (
            <Alert>
              <DatabaseZap className="h-4 w-4" />
              <AlertTitle>Qualidade dos dados</AlertTitle>
              <AlertDescription className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {resumo.qualidade.quantidadeSemEtapa} sem etapa ·{" "}
                  {formatarCentavosResultado(resumo.qualidade.valorSemEtapaCentavos)}
                </Badge>
                <Badge variant="outline">{resumo.qualidade.quantidadeSemVinculo} sem vínculo</Badge>
                <Badge variant="outline">
                  {resumo.qualidade.quantidadeFallbackCompetencia} com fallback de competência
                </Badge>
                <Badge variant="outline">
                  {resumo.qualidade.quantidadeLegadoSemSaldo} legado sem saldo
                </Badge>
              </AlertDescription>
            </Alert>
          )}
          {filtrarAlertasAcionaveis(resumo.alertas).length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {filtrarAlertasAcionaveis(resumo.alertas).map((alerta) => (
                <button
                  key={alerta.id}
                  type="button"
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-left hover:bg-amber-100 dark:bg-amber-950/20"
                  onClick={() => {
                    const etapa = resumo.etapas.find((item) => item.id === alerta.etapaId);
                    if (etapa) setEtapaDetalhe(etapa);
                    else if (alerta.origemUrl) window.location.assign(alerta.origemUrl);
                  }}
                >
                  <p className="text-sm font-semibold">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                </button>
              ))}
            </div>
          )}
          <ResultadoObraKpis resumo={resumo} />
          <ResultadoObraEtapas etapas={resumo.etapas} onDetalhar={setEtapaDetalhe} />
          <ResultadoObraGraficos etapas={resumo.etapas} />
        </>
      )}
      <ResultadoObraDetalhesSheet
        etapa={etapaDetalhe}
        onOpenChange={(open) => {
          if (!open) setEtapaDetalhe(null);
        }}
      />
    </div>
  );
}
