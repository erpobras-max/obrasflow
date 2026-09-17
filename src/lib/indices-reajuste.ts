/**
 * Busca índices de reajuste (IPCA, IGP-M, INPC) de APIs públicas brasileiras.
 *
 * APIs utilizadas:
 * - IPCA: IBGE (https://api.ibge.gov.br)
 * - IGP-M: FGV via BrasilAPI (https://brasilapi.com.br)
 * - INPC: IBGE
 *
 * Em caso de falha, retorna valores simulados baseados nos últimos dados conhecidos.
 */

export interface IndiceReajuste {
  tipo: 'ipca' | 'igp_m' | 'inpc';
  ano: number;
  valor: number;
  fonte: string;
}

/**
 * Busca IPCA (Índice de Preços ao Consumidor Amplo) do IBGE
 * Retorna variação anual em percentual
 */
export async function buscarIpca(ano: number): Promise<IndiceReajuste> {
  try {
    // IBGE API - IPCA anual
    const res = await fetch(`https://apis.ibge.gov.br/series/p/2395/t${ano}`);
    if (!res.ok) throw new Error('IBGE API error');
    const data = await res.json();
    if (data?.[0]?.dados?.length > 0) {
      // Dados no formato array [mês, valor]
      const ultimo = data[0].dados[data[0].dados.length - 1];
      const valor = parseFloat(ultimo[1]) || 0;
      return { tipo: 'ipca', ano, valor, fonte: 'IBGE' };
    }
  } catch {
    // Fallback para dados simulados
  }

  // Valores de fallback baseados em dados históricos (2024-2025)
  const fallbacks: Record<number, number> = {
    2024: 4.83,
    2025: 4.19,
    2023: 4.62,
    2022: 5.79,
  };
  return {
    tipo: 'ipca',
    ano,
    valor: fallbacks[ano] || 5.0,
    fonte: 'IBGE (fallback)',
  };
}

/**
 * Busca IGP-M da FGV
 */
export async function buscarIgpM(ano: number): Promise<IndiceReajuste> {
  try {
    // BrasilAPI - IGP-M mensal
    const res = await fetch(`https://brasilapi.com.br/api/indadores/fgv/igpm/v1?ano=${ano}`);
    if (!res.ok) throw new Error('BrasilAPI error');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Soma todas as variações mensais para obter o anual
      const total = data.reduce((acc: number, m: any) => acc + (m.variacao || 0), 0);
      return { tipo: 'igp_m', ano, valor: Math.round(total * 100) / 100, fonte: 'FGV' };
    }
  } catch {
    // Fallback
  }

  // Valores de fallback
  const fallbacks: Record<number, number> = {
    2024: -0.36,
    2025: 2.87,
    2023: 0.63,
    2022: 11.54,
  };
  return {
    tipo: 'igp_m',
    ano,
    valor: fallbacks[ano] || 3.0,
    fonte: 'FGV (fallback)',
  };
}

/**
 * Busca INPC do IBGE
 */
export async function buscarInpc(ano: number): Promise<IndiceReajuste> {
  try {
    // IBGE API - INPC anual
    const res = await fetch(`https://apis.ibge.gov.br/series/p/2393/t${ano}`);
    if (!res.ok) throw new Error('IBGE API error');
    const data = await res.json();
    if (data?.[0]?.dados?.length > 0) {
      const ultimo = data[0].dados[data[0].dados.length - 1];
      const valor = parseFloat(ultimo[1]) || 0;
      return { tipo: 'inpc', ano, valor, fonte: 'IBGE' };
    }
  } catch {
    // Fallback
  }

  // Valores de fallback
  const fallbacks: Record<number, number> = {
    2024: 5.79,
    2025: 4.52,
    2023: 5.26,
    2022: 6.63,
  };
  return {
    tipo: 'inpc',
    ano,
    valor: fallbacks[ano] || 5.0,
    fonte: 'IBGE (fallback)',
  };
}

/**
 * Busca todos os índices para um ano específico
 */
export async function buscarTodosIndices(ano?: number): Promise<IndiceReajuste[]> {
  const targetYear = ano || new Date().getFullYear();
  const [ipca, igpM, inpc] = await Promise.allSettled([
    buscarIpca(targetYear),
    buscarIgpM(targetYear),
    buscarInpc(targetYear),
  ]);

  return [
    ipca.status ? ipca.value : null,
    igpM.status ? igpM.value : null,
    inpc.status ? inpc.value : null,
  ].filter(Boolean) as IndiceReajuste[];
}

/**
 * Calcula o reajuste sugerido com base no índice selecionado
 */
export function calcularReajusteSugerido(
  valorAtual: number,
  indiceTipo: 'ipca' | 'igp_m' | 'inpc',
  anoBase: number
): Promise<number> {
  return buscarTodosIndices(anoBase).then((indices) => {
    const indice = indices.find((i) => i.tipo === indiceTipo);
    if (!indice) return valorAtual * 1.05; // fallback +5%
    return valorAtual * (1 + indice.valor / 100);
  });
}
