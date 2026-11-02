import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ResultadoObraEtapa, ResultadoObraLinha } from "@/lib/resultado-obra";
import { formatarCentavosResultado, rotuloEtapaResultado } from "@/lib/resultado-obra-apresentacao";

const rotulos: Record<ResultadoObraLinha["origem"], string> = {
  orcamento: "Orçamento",
  receita: "Receita",
  pedido: "Pedidos",
  contrato: "Contratos e medições",
  conta_pagar: "Contas a pagar",
  conta_receber: "Contas a receber",
  avanco: "Avanço físico",
};

function valorLinha(linha: ResultadoObraLinha) {
  return Math.max(
    linha.valorOrcadoCentavos,
    linha.valorReceitaCentavos,
    linha.valorComprometidoCentavos,
    linha.valorRealizadoCentavos,
    linha.valorPagoCentavos,
  );
}

export function ResultadoObraDetalhesSheet({
  etapa,
  onOpenChange,
}: {
  etapa: ResultadoObraEtapa | null;
  onOpenChange: (open: boolean) => void;
}) {
  const grupos = (etapa?.linhas ?? []).reduce<Record<string, ResultadoObraLinha[]>>(
    (acc, linha) => {
      (acc[linha.origem] ??= []).push(linha);
      return acc;
    },
    {},
  );

  return (
    <Sheet open={Boolean(etapa)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{etapa ? rotuloEtapaResultado(etapa) : "Detalhamento"}</SheetTitle>
          <SheetDescription>
            Rastreabilidade somente leitura até cada lançamento de origem.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-6 h-[calc(100vh-9rem)] pr-4">
          <div className="space-y-6">
            {Object.entries(grupos).map(([origem, linhas]) => (
              <section key={origem} className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {rotulos[origem as ResultadoObraLinha["origem"]]}
                </h3>
                {linhas.map((linha) => (
                  <div key={`${linha.origem}:${linha.origemId}`} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{linha.descricao}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {linha.dataReferencia && (
                            <span>
                              {new Date(`${linha.dataReferencia}T12:00:00`).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          )}
                          {linha.legadoSemSaldo && (
                            <Badge variant="secondary">Legado sem saldo aferível</Badge>
                          )}
                          {linha.competenciaFallback && (
                            <Badge variant="outline">Competência por fallback</Badge>
                          )}
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatarCentavosResultado(valorLinha(linha))}
                      </span>
                    </div>
                    {linha.origemUrl && (
                      <Button asChild variant="link" className="mt-2 h-auto p-0">
                        <a href={linha.origemUrl}>
                          Abrir origem <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
