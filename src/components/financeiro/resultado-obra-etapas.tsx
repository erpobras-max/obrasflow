import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResultadoObraEtapa } from "@/lib/resultado-obra";
import {
  formatarCentavosResultado,
  formatarPercentualResultado,
  rotuloEtapaResultado,
} from "@/lib/resultado-obra-apresentacao";

const status = {
  saudavel: { texto: "Saudável", variante: "default" as const },
  atencao: { texto: "Atenção", variante: "secondary" as const },
  critico: { texto: "Crítico", variante: "destructive" as const },
  sem_dados: { texto: "Sem dados", variante: "outline" as const },
};

export function ResultadoObraEtapas({
  etapas,
  onDetalhar,
}: {
  etapas: ResultadoObraEtapa[];
  onDetalhar: (etapa: ResultadoObraEtapa) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado por etapa</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-52">Etapa</TableHead>
              <TableHead className="text-right">Orçado</TableHead>
              <TableHead className="text-right">Comprometido</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Pago</TableHead>
              <TableHead className="text-right">Avanço</TableHead>
              <TableHead className="text-right">IDC</TableHead>
              <TableHead className="text-right">EAC</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {etapas.map((etapa) => (
              <TableRow key={etapa.id ?? "sem-apropriacao"}>
                <TableCell className="font-medium">{rotuloEtapaResultado(etapa)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarCentavosResultado(etapa.bacCentavos)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarCentavosResultado(etapa.comprometidoCentavos)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarCentavosResultado(etapa.realizadoCentavos)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarCentavosResultado(etapa.pagoCentavos)}
                </TableCell>
                <TableCell className="text-right">
                  {formatarPercentualResultado(etapa.avancoFisicoPercentual)}
                </TableCell>
                <TableCell className="text-right">
                  {etapa.idc === null
                    ? "Não calculável"
                    : etapa.idc.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarCentavosResultado(etapa.eacPrincipalCentavos)}
                </TableCell>
                <TableCell>
                  <Badge variant={status[etapa.saude].variante}>{status[etapa.saude].texto}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDetalhar(etapa)}
                    aria-label={`Detalhar ${rotuloEtapaResultado(etapa)}`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
