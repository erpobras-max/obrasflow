import type {
  ResultadoObraAlerta,
  ResultadoObraEtapa,
  ResultadoObraResumo,
} from "./resultado-obra.ts";

export const ACOES_RESULTADO_OBRA = ["detalhar", "abrir_origem"] as const;

export type EstadoCockpitResultado =
  | "selecione_obra"
  | "carregando"
  | "erro"
  | "sem_orcamento"
  | "dados_parciais"
  | "completo";

export interface KpiResultadoObra {
  id: "receita" | "bac" | "comprometido" | "realizado" | "pago" | "eac" | "margem" | "desvio";
  titulo: string;
  valor: string;
  complemento: string;
  formula: string;
  tom: "neutro" | "positivo" | "atencao" | "critico";
}

export function formatarCentavosResultado(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return "Não informado";
  return (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarPercentualResultado(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return "Não informado";
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function rotuloEtapaResultado(etapa: Pick<ResultadoObraEtapa, "id" | "nome">): string {
  return etapa.id === null || !etapa.nome.trim() ? "Sem apropriação" : etapa.nome;
}

export function criarKpisResultadoObra(resumo: ResultadoObraResumo): KpiResultadoObra[] {
  const margemCritica =
    resumo.margemProjetadaPercentual !== null && resumo.margemProjetadaPercentual < 10;
  return [
    {
      id: "receita",
      titulo: "Receita contratada",
      valor: formatarCentavosResultado(resumo.receitaContratadaCentavos),
      complemento: "Fonte contratual prioritária",
      formula: "Proposta aceita; na ausência, contrato, valor da obra ou contas a receber.",
      tom: "neutro",
    },
    {
      id: "bac",
      titulo: "Custo orçado (BAC)",
      valor: formatarCentavosResultado(resumo.bacCentavos),
      complemento: "Sem BDI e sem preço de venda",
      formula: "Soma dos insumos e coeficientes da revisão analítica corrente.",
      tom: "neutro",
    },
    {
      id: "comprometido",
      titulo: "Custo comprometido",
      valor: formatarCentavosResultado(resumo.comprometidoCentavos),
      complemento: resumo.compromissoEhPosicaoAtual ? "posição atual" : "Saldo ainda não realizado",
      formula: "Pedidos e contratos ativos menos recebimentos e medições já realizados.",
      tom: "atencao",
    },
    {
      id: "realizado",
      titulo: "Custo realizado",
      valor: formatarCentavosResultado(resumo.realizadoCentavos),
      complemento: "Conforme o regime e período",
      formula: "Obrigações reconhecidas na competência ou liquidações no regime de caixa.",
      tom: "neutro",
    },
    {
      id: "pago",
      titulo: "Custo pago",
      valor: formatarCentavosResultado(resumo.pagoCentavos),
      complemento: "Somente valores liquidados",
      formula: "Soma dos pagamentos com data de liquidação dentro do período.",
      tom: "neutro",
    },
    {
      id: "eac",
      titulo: "Custo projetado (EAC)",
      valor: formatarCentavosResultado(resumo.eacPrincipalCentavos),
      complemento: `Contratual ${formatarCentavosResultado(resumo.eacContratualCentavos)} · Desempenho ${formatarCentavosResultado(resumo.eacDesempenhoCentavos)}`,
      formula: "Maior cenário válido entre max(BAC, realizado + compromisso) e BAC ÷ IDC.",
      tom:
        resumo.saude === "critico" ? "critico" : resumo.saude === "atencao" ? "atencao" : "neutro",
    },
    {
      id: "margem",
      titulo: "Margem projetada",
      valor: formatarCentavosResultado(resumo.margemProjetadaCentavos),
      complemento: formatarPercentualResultado(resumo.margemProjetadaPercentual),
      formula: "Receita contratada menos o EAC principal conservador.",
      tom: margemCritica ? "critico" : "positivo",
    },
    {
      id: "desvio",
      titulo: "Desvio projetado",
      valor: formatarCentavosResultado(resumo.desvioProjetadoCentavos),
      complemento: formatarPercentualResultado(resumo.desvioProjetadoPercentual),
      formula: "EAC principal menos o custo orçado (BAC).",
      tom:
        resumo.saude === "critico"
          ? "critico"
          : resumo.saude === "atencao"
            ? "atencao"
            : "positivo",
    },
  ];
}

export function obterEstadoCockpitResultado(params: {
  obraId: string | null;
  isLoading?: boolean;
  isError?: boolean;
  resumo?: ResultadoObraResumo | null;
}): EstadoCockpitResultado {
  if (!params.obraId) return "selecione_obra";
  if (params.isLoading) return "carregando";
  if (params.isError || !params.resumo) return "erro";
  if (params.resumo.bacCentavos === null) return "sem_orcamento";
  if (params.resumo.qualidade.temDadosParciais) return "dados_parciais";
  return "completo";
}

export function filtrarAlertasAcionaveis<
  T extends Pick<ResultadoObraAlerta, "etapaId" | "origemUrl">,
>(alertas: T[]): T[] {
  return alertas.filter((alerta) => Boolean(alerta.etapaId || alerta.origemUrl));
}
