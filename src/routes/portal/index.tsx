import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Calendar, ClipboardList, Clock, Loader2, MapPin, Users } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client.custom";
import { usePortalContext } from "@/hooks/use-portal-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_OBRA_LABEL, STATUS_OBRA_BADGE } from "@/lib/obras.schema";

export const Route = createFileRoute("/portal/")({
  component: PortalIndex,
});

function PortalIndex() {
  const { obraId } = usePortalContext();

  const {
    data: obra,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["portal-obra-detalhe", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .eq("id", obraId as string)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!obraId,
  });

  const { data: atualizacoes = [], isLoading: loadingAtualizacoes } = useQuery({
    queryKey: ["portal-obra-andamento", obraId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diarios_obra")
        .select("id,data,atividades,ocorrencias,observacoes,clima,temperatura,efetivo,created_at")
        .eq("obra_id", obraId as string)
        .order("data", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        data: string;
        atividades: string | null;
        ocorrencias: string | null;
        observacoes: string | null;
        clima: string | null;
        temperatura: number | null;
        efetivo: Array<{ funcao: string; quantidade: number }> | null;
        created_at: string;
      }>;
    },
    enabled: !!obraId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !obra) {
    return (
      <div className="text-center py-10 bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-destructive">Erro ao carregar detalhes</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Não conseguimos obter as informações desta obra.
        </p>
      </div>
    );
  }

  const progresso = Math.min(100, Math.max(0, Number(obra.progresso ?? 0)));

  // Calculate remaining days
  let diasRestantes = 0;
  let prazoTexto = "Não definido";
  if (obra.data_fim_prevista) {
    const hoje = new Date();
    const fim = parseISO(obra.data_fim_prevista);
    diasRestantes = differenceInDays(fim, hoje);
    prazoTexto = format(fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  // Circular progress dimensions
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progresso / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-primary/90 to-primary text-primary-foreground p-6 rounded-2xl shadow-sm">
        <h1 className="text-xl md:text-2xl font-bold">Acompanhe a sua obra</h1>
        <p className="text-primary-foreground/80 text-xs md:text-sm mt-1">
          Obra: <span className="font-semibold">{obra.nome}</span> (Ref: #{obra.numero})
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge
            className={`${STATUS_OBRA_BADGE[obra.status as keyof typeof STATUS_OBRA_BADGE]} border-none`}
          >
            {STATUS_OBRA_LABEL[obra.status as keyof typeof STATUS_OBRA_LABEL] || obra.status}
          </Badge>
          {obra.cidade && (
            <Badge
              variant="secondary"
              className="bg-white/20 text-white hover:bg-white/30 border-none flex items-center gap-1"
            >
              <MapPin className="size-3" />
              {obra.cidade} - {obra.uf}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Progress Circular Wheel */}
        <Card className="md:col-span-1 flex flex-col items-center justify-center py-6">
          <CardHeader className="pb-2 text-center w-full">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Progresso Geral
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="relative size-36 flex items-center justify-center">
              <svg className="size-full transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className="stroke-slate-100 fill-none"
                  strokeWidth="12"
                />
                {/* Foreground circle */}
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  className="stroke-primary fill-none transition-all duration-500 ease-out"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-3xl font-extrabold text-slate-800">{progresso}%</span>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">
                  concluído
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Milestone Dates & Clock */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Cronograma & Prazos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary mt-0.5">
                <Calendar className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Início da Obra</p>
                <p className="text-sm font-semibold text-slate-700">
                  {obra.data_inicio_real
                    ? format(parseISO(obra.data_inicio_real), "dd/MM/yyyy")
                    : obra.data_inicio_prevista
                      ? format(parseISO(obra.data_inicio_prevista), "dd/MM/yyyy") + " (Previsto)"
                      : "Não informado"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg text-primary mt-0.5">
                <Clock className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previsão de Entrega</p>
                <p className="text-sm font-semibold text-slate-700">{prazoTexto}</p>
              </div>
            </div>

            <div className="border-t pt-4 mt-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Prazo Restante</p>
                <p className="text-lg font-bold text-slate-800">
                  {diasRestantes > 0
                    ? `${diasRestantes} dias`
                    : diasRestantes === 0
                      ? "Entrega programada para hoje"
                      : obra.status === "concluida"
                        ? "Obra concluída"
                        : `Prazo previsto encerrado há ${Math.abs(diasRestantes)} dias`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
                <Activity className="size-5 text-primary" />
                Últimas atualizações da obra
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Registros reais informados pela equipe no diário da obra.
              </p>
            </div>
            <Badge variant="secondary">{atualizacoes.length} registros recentes</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAtualizacoes ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : atualizacoes.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <ClipboardList className="mx-auto mb-3 size-9 text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-700">
                Nenhuma atualização publicada
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Os registros feitos pela equipe aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {atualizacoes.map((registro, index) => {
                const totalEfetivo = (registro.efetivo ?? []).reduce(
                  (total, item) => total + Number(item.quantidade || 0),
                  0,
                );
                return (
                  <div key={registro.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {index < atualizacoes.length - 1 && (
                      <div className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-slate-200" />
                    )}
                    <div className="relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ClipboardList className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl border bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">
                          {format(parseISO(registro.data), "dd 'de' MMMM 'de' yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          {registro.clima && (
                            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                              {registro.clima}
                              {registro.temperatura != null ? ` · ${registro.temperatura}°C` : ""}
                            </span>
                          )}
                          {totalEfetivo > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                              <Users className="size-3" /> {totalEfetivo} profissionais
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                        {registro.atividades || "Atualização de andamento registrada pela equipe."}
                      </p>
                      {registro.ocorrencias && (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <span className="font-semibold">Ocorrências:</span> {registro.ocorrencias}
                        </p>
                      )}
                      {registro.observacoes && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-slate-600">Observações:</span>{" "}
                          {registro.observacoes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
