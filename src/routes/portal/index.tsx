import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Calendar, Clock, MapPin, ChevronRight, CheckCircle2, Circle } from "lucide-react";
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

  const { data: obra, isLoading, error } = useQuery({
    queryKey: ["portal-obra-detalhe", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("obras")
        .select("*")
        .eq("id", obraId as string)
        .single();
      if (error) throw error;
      return data;
    },
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

  const progresso = obra.progresso ?? 0;
  
  // Calculate remaining days
  let diasRestantes = 0;
  let prazoTexto = "Não definido";
  if (obra.data_fim_prevista) {
    const hoje = new Date();
    const fim = parseISO(obra.data_fim_prevista);
    diasRestantes = differenceInDays(fim, hoje);
    prazoTexto = format(fim, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  // Predefined construction stages with weights to distribute overall progress
  const stagesDefinition = [
    { name: "Fundações e Infraestrutura", weight: 15 },
    { name: "Estrutura e Alvenaria", weight: 30 },
    { name: "Instalações Hidráulicas e Elétricas", weight: 20 },
    { name: "Revestimentos e Acabamentos", weight: 25 },
    { name: "Pintura e Limpeza Final", weight: 10 },
  ];

  // Distribute overall progress across stages
  let accumulatedWeight = 0;
  const stages = stagesDefinition.map((s) => {
    let stageProgress = 0;
    const minOverall = accumulatedWeight;
    const maxOverall = accumulatedWeight + s.weight;
    accumulatedWeight += s.weight;

    if (progresso >= maxOverall) {
      stageProgress = 100;
    } else if (progresso <= minOverall) {
      stageProgress = 0;
    } else {
      // Linear interpolation inside this stage
      stageProgress = Math.round(((progresso - minOverall) / s.weight) * 100);
    }

    let status: "pending" | "progress" | "completed" = "pending";
    if (stageProgress === 100) status = "completed";
    else if (stageProgress > 0) status = "progress";

    return {
      name: s.name,
      progress: stageProgress,
      status,
    };
  });

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
          <Badge className={`${STATUS_OBRA_BADGE[obra.status as keyof typeof STATUS_OBRA_BADGE]} border-none`}>
            {STATUS_OBRA_LABEL[obra.status as keyof typeof STATUS_OBRA_LABEL] || obra.status}
          </Badge>
          {obra.cidade && (
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none flex items-center gap-1">
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
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mt-0.5">concluído</p>
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
                  {diasRestantes > 0 ? `${diasRestantes} dias úteis` : diasRestantes === 0 ? "Entrega programada para hoje" : "Obra em fase final"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Construction Stages Grid */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Etapas de Construção</h2>
        <div className="grid gap-3">
          {stages.map((stage, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-center gap-3">
                {stage.status === "completed" ? (
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                ) : stage.status === "progress" ? (
                  <div className="relative size-5 flex items-center justify-center shrink-0">
                    <div className="absolute size-5 rounded-full border-2 border-primary/20"></div>
                    <div className="absolute size-3 rounded-full bg-primary animate-pulse"></div>
                  </div>
                ) : (
                  <Circle className="size-5 text-slate-300 shrink-0" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{stage.name}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {stage.status === "completed"
                      ? "Concluída com sucesso"
                      : stage.status === "progress"
                      ? `Em andamento (${stage.progress}%)`
                      : "Aguardando início das etapas anteriores"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${
                  stage.status === "completed" ? "text-emerald-600" : stage.status === "progress" ? "text-primary" : "text-slate-400"
                }`}>
                  {stage.progress}%
                </span>
                <ChevronRight className="size-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
