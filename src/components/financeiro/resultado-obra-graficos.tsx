import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResultadoObraEtapa } from "@/lib/resultado-obra";
import { rotuloEtapaResultado } from "@/lib/resultado-obra-apresentacao";

const reais = (centavos: number | null) => (centavos ?? 0) / 100;
const moedaCompacta = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    style: "currency",
    currency: "BRL",
  }).format(valor);

export function ResultadoObraGraficos({ etapas }: { etapas: ResultadoObraEtapa[] }) {
  const dados = etapas.map((etapa) => ({
    etapa: rotuloEtapaResultado(etapa),
    orcado: reais(etapa.bacCentavos),
    comprometido: reais(etapa.comprometidoCentavos),
    realizado: reais(etapa.realizadoCentavos),
    eac: reais(etapa.eacPrincipalCentavos),
  }));
  if (!dados.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orçado × comprometido × realizado × EAC</CardTitle>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="etapa"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={78}
            />
            <YAxis tickFormatter={moedaCompacta} width={88} />
            <Tooltip formatter={(valor) => moedaCompacta(Number(valor))} />
            <Legend />
            <Bar dataKey="orcado" name="Orçado" fill="#64748b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="comprometido" name="Comprometido" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="realizado" name="Realizado" fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Bar dataKey="eac" name="EAC" fill="#7c3aed" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
