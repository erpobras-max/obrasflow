import { useQuery } from "@tanstack/react-query";
import {
  calcularResultadoObra,
  type ResultadoObraFiltros,
  type ResultadoObraLinha,
} from "../lib/resultado-obra.ts";

interface ResultadoObraRpcRow {
  obra_id: string;
  obra_nome: string;
  etapa_id: string | null;
  etapa_nome: string | null;
  origem: ResultadoObraLinha["origem"];
  origem_id: string;
  origem_vinculo_id: string | null;
  descricao: string;
  data_referencia: string | null;
  data_vencimento: string | null;
  valor_em_aberto_centavos: number | string | null;
  valor_orcado_centavos: number | string | null;
  valor_receita_centavos: number | string | null;
  valor_comprometido_centavos: number | string | null;
  valor_realizado_centavos: number | string | null;
  valor_pago_centavos: number | string | null;
  avanco_fisico_percentual: number | string | null;
  legado_sem_saldo: boolean;
  competencia_fallback: boolean;
  origem_url: string | null;
  metadados: Record<string, unknown> | null;
}

interface RespostaRpc {
  data: ResultadoObraRpcRow[] | null;
  error: unknown;
}

type RequisicaoRpc = PromiseLike<RespostaRpc> & {
  abortSignal?: (signal: AbortSignal) => RequisicaoRpc;
};

export type ResultadoObraRpcExecutor = (
  nome: "obter_resultado_obra",
  parametros: {
    p_obra_id: string;
    p_data_inicio: string | null;
    p_data_fim: string | null;
    p_regime: ResultadoObraFiltros["regime"];
  },
  signal?: AbortSignal,
) => Promise<RespostaRpc>;

const numero = (valor: number | string | null | undefined) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

export function mapearResultadoObraLinha(row: ResultadoObraRpcRow): ResultadoObraLinha {
  return {
    obraId: row.obra_id,
    obraNome: row.obra_nome,
    etapaId: row.etapa_id,
    etapaNome: row.etapa_nome,
    origem: row.origem,
    origemId: row.origem_id,
    origemVinculoId: row.origem_vinculo_id,
    descricao: row.descricao,
    dataReferencia: row.data_referencia,
    dataVencimento: row.data_vencimento,
    valorEmAbertoCentavos: numero(row.valor_em_aberto_centavos),
    valorOrcadoCentavos: numero(row.valor_orcado_centavos),
    valorReceitaCentavos: numero(row.valor_receita_centavos),
    valorComprometidoCentavos: numero(row.valor_comprometido_centavos),
    valorRealizadoCentavos: numero(row.valor_realizado_centavos),
    valorPagoCentavos: numero(row.valor_pago_centavos),
    avancoFisicoPercentual:
      row.avanco_fisico_percentual === null ? null : numero(row.avanco_fisico_percentual),
    legadoSemSaldo: Boolean(row.legado_sem_saldo),
    competenciaFallback: Boolean(row.competencia_fallback),
    origemUrl: row.origem_url,
    metadados: row.metadados ?? {},
  };
}

export function resultadoObraQueryKey(filtros: ResultadoObraFiltros) {
  return [
    "resultado-obras",
    filtros.obraId,
    filtros.regime,
    filtros.periodo,
    filtros.dataInicio,
    filtros.dataFim,
  ] as const;
}

const executarRpc: ResultadoObraRpcExecutor = async (nome, parametros, signal) => {
  const { supabase } = await import("../integrations/supabase/client.custom.ts");
  const cliente = supabase as unknown as {
    rpc: (funcao: string, argumentos: Record<string, unknown>) => RequisicaoRpc;
  };
  let requisicao = cliente.rpc(nome, parametros);
  if (signal && typeof requisicao.abortSignal === "function") {
    requisicao = requisicao.abortSignal(signal);
  }
  return await requisicao;
};

function erroRpc(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error("Não foi possível consultar o resultado da obra.");
}

export async function carregarResultadoObra(
  filtros: ResultadoObraFiltros,
  executor: ResultadoObraRpcExecutor = executarRpc,
  signal?: AbortSignal,
) {
  if (!filtros.obraId) throw new Error("Selecione uma obra para consultar o resultado.");
  const resposta = await executor(
    "obter_resultado_obra",
    {
      p_obra_id: filtros.obraId,
      p_data_inicio: filtros.dataInicio,
      p_data_fim: filtros.dataFim,
      p_regime: filtros.regime,
    },
    signal,
  );
  if (resposta.error) throw erroRpc(resposta.error);
  const linhas = (resposta.data ?? []).map(mapearResultadoObraLinha);
  const resumo = calcularResultadoObra(linhas, {
    ...filtros,
    movimentosPreFiltrados: true,
  });
  return { linhas, resumo };
}

export function useResultadoObras(filtros: ResultadoObraFiltros) {
  return useQuery({
    queryKey: resultadoObraQueryKey(filtros),
    enabled: Boolean(filtros.obraId),
    queryFn: ({ signal }) => carregarResultadoObra(filtros, executarRpc, signal),
    staleTime: 30_000,
  });
}
