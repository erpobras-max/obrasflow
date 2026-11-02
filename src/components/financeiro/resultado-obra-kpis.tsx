import { CircleHelp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ResultadoObraResumo } from "@/lib/resultado-obra";
import { criarKpisResultadoObra } from "@/lib/resultado-obra-apresentacao";

const tons = {
  neutro: "border-l-slate-400",
  positivo: "border-l-emerald-500",
  atencao: "border-l-amber-500",
  critico: "border-l-red-500",
};

export function ResultadoObraKpis({ resumo }: { resumo: ResultadoObraResumo }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {criarKpisResultadoObra(resumo).map((kpi) => (
          <Card key={kpi.id} className={cn("border-l-4", tons[kpi.tom])}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.titulo}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground"
                      aria-label={`Fórmula de ${kpi.titulo}`}
                    >
                      <CircleHelp className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">{kpi.formula}</TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums">{kpi.valor}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.complemento}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
