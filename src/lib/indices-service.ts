/**
 * Serviço de índices de reajuste imobiliário
 *
 * Busca automática de IPCA, IGP-M e INPC da API oficial do Banco Central (SGS).
 * Em caso de falha, utiliza valores de fallback baseados em dados históricos.
 */

import { supabase } from "@/integrations/supabase/client.custom";

export interface IndiceReajuste {
  id?: string;
  indice_tipo: 'ipca' | 'igp_m' | 'inpc';
  periodo_ano: number;
  periodo_mes: number;
  valor_indice: number;
  variacao_percentual: number;
  acumulado_12m: number;
  fonte: string;
  criado_em: string;
}

const INDICE_SERIES = {
  ipca: 433,    // IPCA - IBGE
  igp_m: 189,   // IGP-M - FGV
  inpc: 188,    // INPC - IBGE
} as const;

const INDICE_LABELS: Record<string, string> = {
  ipca: 'IPCA',
  igp_m: 'IGP-M',
  inpc: 'INPC',
};

/**
 * Busca os últimos 12 meses de um índice na API do BCB (SGS)
 */
async function buscarIndiceBCB(tipo: 'ipca' | 'igp_m' | 'inpc'): Promise<IndiceReajuste | null> {
  const codigoSerie = INDICE_SERIES[tipo];

  try {
    const res = await fetch(
      `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigoSerie}/dados/ultimos/12?formato=json`
    );

    if (!res.ok) throw new Error(`BCB API error: ${res.status}`);

    const dados = await res.json();

    if (!dados?.length) throw new Error('Dados vazios');

    // Ordena por data (mais antiga primeiro)
    const dadosOrdenados = [...dados].sort((a: any, b: any) => {
      const [diaA, mesA, anoA] = a.data.split('/').map(Number);
      const [diaB, mesB, anoB] = b.data.split('/').map(Number);
      return new Date(anoA, mesA - 1, diaA).getTime() - new Date(anoB, mesB - 1, diaB).getTime();
    });

    // Calcula o fator acumulado dos últimos 12 meses
    const fatorAcumulado = dadosOrdenados.reduce((acc: number, item: any) => {
      const variacaoMensal = parseFloat(item.valor.replace(',', '.')) / 100;
      return acc * (1 + variacaoMensal);
    }, 1);

    const acumulado12m = ((fatorAcumulado - 1) * 100);

    // Pega o último registro (mais recente)
    const ultimo = dadosOrdenados[dadosOrdenados.length - 1];
    const [dia, mes, ano] = ultimo.data.split('/').map(Number);
    const valorMensal = parseFloat(ultimo.valor.replace(',', '.')) || 0;

    return {
      indice_tipo: tipo,
      periodo_ano: ano,
      periodo_mes: mes,
      valor_indice: valorMensal,
      variacao_percentual: valorMensal,
      acumulado_12m: Math.round(acumulado12m * 100) / 100,
      fonte: 'BCB/SGS',
      criado_em: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`Falha ao buscar ${tipo.toUpperCase()} no BCB:`, err);
    return null;
  }
}

/**
 * Valores de fallback baseados em dados históricos conhecidos
 */
const FALLBACK_VALUES: Record<string, Record<number, number>> = {
  ipca: {
    2024: 4.83, 2025: 4.19, 2023: 4.62, 2022: 5.79, 2021: 10.06,
  },
  igp_m: {
    2024: -0.36, 2025: 2.87, 2023: 0.63, 2022: 11.54, 2021: 8.34,
  },
  inpc: {
    2024: 5.79, 2025: 4.52, 2023: 5.26, 2022: 6.63, 2021: 8.28,
  },
};

/**
 * Busca todos os índices atuais das APIs do BCB
 */
export async function buscarIndicesAtuais(): Promise<IndiceReajuste[]> {
  const results = await Promise.allSettled([
    buscarIndiceBCB('ipca'),
    buscarIndiceBCB('igp_m'),
    buscarIndiceBCB('inpc'),
  ]);

  const indices: IndiceReajuste[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      indices.push(result.value);
    }
  }

  // Preencher gaps com fallback (usando último ano disponível)
  const tiposNaoEncontrados = ['ipca', 'igp_m', 'inpc'].filter(
    tipo => !indices.some(i => i.indice_tipo === tipo)
  );

  for (const tipo of tiposNaoEncontrados) {
    const anoAtual = new Date().getFullYear();
    const valorFallback = FALLBACK_VALUES[tipo]?.[new Date().getFullYear()]
      ?? FALLBACK_VALUES[tipo]?.[new Date().getFullYear() - 1]
      ?? FALLBACK_VALUES[tipo]?.[new Date().getFullYear() - 2]
      ?? 5.0;

    if (valorFallback !== undefined) {
      indices.push({
        indice_tipo: tipo as 'ipca' | 'igp_m' | 'inpc',
        periodo_ano: new Date().getFullYear(),
        periodo_mes: new Date().getMonth() + 1,
        valor_indice: valorFallback,
        variacao_percentual: valorFallback,
        acumulado_12m: valorFallback,
        fonte: 'Fallback histórico',
        criado_em: new Date().toISOString(),
      });
    }
  }

  return indices;
}

/**
 * Busca índices já cadastrados no banco
 */
export async function buscarIndicesBanco(): Promise<IndiceReajuste[]> {
  const { data, error } = await supabase
    .from("imob_indices_reajuste")
    .select("*")
    .order("periodo_ano", { ascending: false })
    .order("periodo_mes", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Busca índice específico (tipo + ano + mes) do banco
 */
export async function buscarIndiceBanco(tipo: string, ano: number, mes?: number): Promise<IndiceReajuste | null> {
  let query = supabase
    .from("imob_indices_reajuste")
    .select("*")
    .eq("indice_tipo", tipo)
    .eq("periodo_ano", ano);

  if (mes) {
    query = query.eq("periodo_mes", mes);
  } else {
    query = query.order("periodo_mes", { ascending: false }).limit(1);
  }

  const { data, error } = await query.single();

  if (error) return null;
  return data;
}

/**
 * Busca o último valor disponível de um índice
 */
export async function buscarUltimoIndice(tipo: 'ipca' | 'igp_m' | 'inpc'): Promise<number> {
  // Primeiro tenta o banco
  const { data: banco } = await supabase
    .from("imob_indices_reajuste")
    .select("valor_indice")
    .eq("indice_tipo", tipo)
    .order("periodo_ano", { ascending: false })
    .order("periodo_mes", { ascending: false })
    .limit(1)
    .single();

  if (banco) return banco.valor_indice;

  // Fallback para dados históricos
  const anoAtual = new Date().getFullYear();
  const ultimo = FALLBACK_VALUES[tipo]?.[anoAtual]
    ?? FALLBACK_VALUES[tipo]?.[anoAtual - 1]
    ?? FALLBACK_VALUES[tipo]?.[anoAtual - 2]
    ?? 5.0; // padrão 5%

  return ultimo;
}

/**
 * Calcula o novo valor do aluguel com base no índice
 */
export async function calcularNovoAluguel(
  valorAtual: number,
  indiceTipo: 'ipca' | 'igp_m' | 'inpc',
  anoBase: number
): Promise<number> {
  const indice = await buscarUltimoIndice(indiceTipo);
  return Math.round(valorAtual * (1 + indice / 100) * 100) / 100;
}

/**
 * Busca o índice acumulado 12 meses para reajuste
 */
export async function buscarAcumulado12Meses(tipo: 'ipca' | 'igp_m' | 'inpc'): Promise<number> {
  // Primeiro tenta buscar do banco (mais recente)
  const { data: banco } = await supabase
    .from("imob_indices_reajuste")
    .select("acumulado_12m")
    .eq("indice_tipo", tipo)
    .order("periodo_ano", { ascending: false })
    .order("periodo_mes", { ascending: false })
    .limit(1)
    .single();

  if (banco?.acumulado_12m) return banco.acumulado_12m;

  // Se não tiver no banco, busca da API
  const indice = await buscarIndiceBCB(tipo);
  if (indice?.acumulado_12m) return indice.acumulado_12m;

  // Fallback
  const anoAtual = new Date().getFullYear();
  return FALLBACK_VALUES[tipo]?.[anoAtual] ?? 5.0;
}

/**
 * Calcula o novo valor do aluguel com base no índice acumulado 12m
 */
export async function calcularReajusteAluguel(
  valorAtual: number,
  indiceTipo: 'ipca' | 'igp_m' | 'inpc'
): Promise<{ novoValor: number; percentual: number; indice: IndiceReajuste | null }> {
  const percentual = await buscarAcumulado12Meses(indiceTipo);
  const novoValor = Math.round(valorAtual * (1 + percentual / 100) * 100) / 100;

  const indice = await buscarIndiceBCB(indiceTipo);

  return { novoValor, percentual, indice };
}

/**
 * Atualiza automaticamente os índices do banco a partir das APIs do BCB
 */
export async function atualizarIndicesAutomaticamente(): Promise<{ atualizados: number; erros: string[] }> {
  let atualizados = 0;
  const erros: string[] = [];

  try {
    const indices = await buscarIndicesAtuais();

    for (const ind of indices) {
      // Verifica se já existe (tipo + ano + mes)
      const existente = await buscarIndiceBanco(ind.indice_tipo, ind.periodo_ano, ind.periodo_mes);

      if (!existente) {
        const { error } = await supabase
          .from("imob_indices_reajuste")
          .insert(ind);

        if (error) {
          erros.push(`Erro ao inserir ${ind.indice_tipo}/${ind.periodo_ano}/${ind.periodo_mes}: ${error.message}`);
        } else {
          atualizados++;
        }
      }
    }
  } catch (err) {
    erros.push(`Erro ao buscar/inserir índices: ${err}`);
  }

  return { atualizados, erros };
}

/**
 * Calcula o novo valor do aluguel com base no índice
 */
export async function calcularNovoAluguel(
  valorAtual: number,
  indiceTipo: 'ipca' | 'igp_m' | 'inpc',
  anoBase: number
): Promise<number> {
  const indice = await buscarUltimoIndice(indiceTipo);
  return Math.round(valorAtual * (1 + indice / 100) * 100) / 100;
}

export { INDICE_LABELS };