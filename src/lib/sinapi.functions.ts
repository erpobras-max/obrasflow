import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SINAPI_GRUPOS } from "./sinapi-grupos";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

// Types
export interface SinapiItemResultado {
  tipo: "C" | "I";
  codigo: string;
  codigoCompleto: string;
  descricao: string;
  unidade: string;
  grupoId: number;
  grupoNome: string;
  grupoLink: string;
  precoSemDesoneracao: number;
  precoComDesoneracao: number;
  percentualAS?: number;
}

export interface SinapiItemAnalitico {
  tipo: "C" | "I";
  codigo: string;
  codigoCompleto: string;
  descricao: string;
  unidade: string;
  coeficiente: number;
  precoUnitarioSemDesoneracao: number;
  precoUnitarioComDesoneracao: number;
  custoTotalSemDesoneracao: number;
  custoTotalComDesoneracao: number;
}

interface CaixaDescricaoRaw {
  c: number; // prefixed code: 1xxxx for insumo, 2xxxx for composicao
  d: string; // description
  u: string; // unit
  s?: string; // status: "S" or "C"
  g?: number; // grupo id
}

interface CaixaValorRaw {
  c: number;
  sd: number; // sem desoneração
  cd: number; // com desoneração
  asp?: number; // % AS
}

interface CaixaAnaliticoRaw {
  c: number; // composicao pai (2xxxx)
  i: number; // item filho (1xxxx ou 2xxxx)
  cf: number; // coeficiente
}

// In-memory cache for server sessions to maximize speed
const serverCache = {
  datas: [] as string[],
  descricoes: new Map<string, CaixaDescricaoRaw[]>(),
  valoresUF: new Map<string, Map<number, CaixaValorRaw>>(),
  analitico: new Map<string, CaixaAnaliticoRaw[]>(),
};

const CAIXA_BASE_URL =
  "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Documents/busca";

const CAIXA_HEADERS = {
  Cookie: "security=true;",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function fetchCaixaJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: CAIXA_HEADERS,
  });
  if (!response.ok) {
    throw new Error(
      `Falha ao obter dados da Caixa (${response.status} ${response.statusText}): ${url}`,
    );
  }
  return (await response.json()) as T;
}

// 1. Obter datas disponíveis oficialmente na Caixa
export const obterDatasOficiaisCaixa = createServerFn({ method: "POST" }).handler(
  async (): Promise<string[]> => {
    if (serverCache.datas.length > 0) {
      return serverCache.datas;
    }

    try {
      const data = await fetchCaixaJson<{ datas_preco: string[] }>(
        `${CAIXA_BASE_URL}/data-preco.json`,
      );
      if (Array.isArray(data.datas_preco)) {
        serverCache.datas = data.datas_preco.sort().reverse();
        return serverCache.datas;
      }
    } catch (err) {
      console.warn("Erro ao buscar datas oficiais da Caixa, usando fallback:", err);
    }

    return [
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
    ];
  },
);

// 2. Consulta oficial SINAPI Caixa
export const consultarSinapiOficialCaixa = createServerFn({ method: "POST" })
  .validator(
    z.object({
      anoMes: z.string().min(6), // ex: '2026-09'
      uf: z.string().length(2), // ex: 'MG'
      tipo: z.enum(["todos", "insumos", "composicoes"]).default("todos"),
      grupoId: z.number().optional(),
      codigo: z.string().optional(),
      descricao: z.string().optional(),
      pagina: z.number().default(1),
      itensPorPagina: z.number().default(25),
    }),
  )
  .handler(async ({ data }) => {
    const { anoMes, uf, tipo, grupoId, codigo, descricao, pagina, itensPorPagina } = data;

    // 1. Carregar descricoes
    let descricoes = serverCache.descricoes.get(anoMes);
    if (!descricoes) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-descricoes.json`;
      descricoes = await fetchCaixaJson<CaixaDescricaoRaw[]>(url);
      serverCache.descricoes.set(anoMes, descricoes);
    }

    // 2. Carregar valores da UF
    const cacheKeyUF = `${anoMes}-${uf}`;
    let valoresMap = serverCache.valoresUF.get(cacheKeyUF);
    if (!valoresMap) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-${uf}.json`;
      const valoresArray = await fetchCaixaJson<CaixaValorRaw[]>(url);
      valoresMap = new Map<number, CaixaValorRaw>();
      for (const v of valoresArray) {
        valoresMap.set(v.c, v);
      }
      serverCache.valoresUF.set(cacheKeyUF, valoresMap);
    }

    // 3. Filtrar
    const cleanCodigo = codigo?.trim();
    const cleanDescricao = descricao?.trim();

    let filtrados = descricoes;

    // Filtro por tipo
    if (tipo === "insumos") {
      filtrados = filtrados.filter((d) => String(d.c).startsWith("1"));
    } else if (tipo === "composicoes") {
      filtrados = filtrados.filter((d) => String(d.c).startsWith("2"));
    }

    // Filtro por grupo
    if (grupoId && grupoId > 0) {
      filtrados = filtrados.filter((d) => (d.g ?? 0) === grupoId);
    }

    // Filtro por código
    if (cleanCodigo) {
      filtrados = filtrados.filter((d) => {
        const codStr = String(d.c);
        const semPrefixo = codStr.substring(1);
        return semPrefixo.includes(cleanCodigo) || codStr.includes(cleanCodigo);
      });
    }

    // Filtro por descrição (todas as palavras presentes)
    if (cleanDescricao) {
      const palavras = normalizar(cleanDescricao).split(/\s+/).filter(Boolean);
      filtrados = filtrados.filter((d) => {
        const alvo = normalizar(d.d);
        return palavras.every((p) => alvo.includes(p));
      });
    }

    const total = filtrados.length;
    const offset = (pagina - 1) * itensPorPagina;
    const paginados = filtrados.slice(offset, offset + itensPorPagina);

    // Mapear com valores e grupo
    const itens: SinapiItemResultado[] = paginados.map((d) => {
      const codStr = String(d.c);
      const isComposicao = codStr.startsWith("2");
      const tipoResult: "C" | "I" = isComposicao ? "C" : "I";
      const codigoBase = codStr.substring(1);

      const val = valoresMap!.get(d.c);
      const grupoObj = SINAPI_GRUPOS.find((g) => g.id === d.g);

      return {
        tipo: tipoResult,
        codigo: codigoBase,
        codigoCompleto: codStr,
        descricao: d.d,
        unidade: d.u,
        grupoId: d.g ?? 0,
        grupoNome: grupoObj?.g ?? "Geral",
        grupoLink: grupoObj?.l ?? "",
        precoSemDesoneracao: val?.sd ?? 0,
        precoComDesoneracao: val?.cd ?? 0,
        percentualAS: val?.asp,
      };
    });

    return {
      total,
      pagina,
      totalPaginas: Math.ceil(total / itensPorPagina),
      itens,
    };
  });

// 3. Obter Detalhamento Analítico de uma Composição
export const obterAnaliticoComposicaoCaixa = createServerFn({ method: "POST" })
  .validator(
    z.object({
      anoMes: z.string(),
      uf: z.string().length(2),
      codigoComposicao: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { anoMes, uf, codigoComposicao } = data;
    const codigoPaiPrefixo = Number(
      codigoComposicao.startsWith("2") ? codigoComposicao : `2${codigoComposicao}`,
    );

    // 1. Carregar analítico
    let analitico = serverCache.analitico.get(anoMes);
    if (!analitico) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-analitico.json`;
      analitico = await fetchCaixaJson<CaixaAnaliticoRaw[]>(url);
      serverCache.analitico.set(anoMes, analitico);
    }

    // 2. Carregar descrições
    let descricoes = serverCache.descricoes.get(anoMes);
    if (!descricoes) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-descricoes.json`;
      descricoes = await fetchCaixaJson<CaixaDescricaoRaw[]>(url);
      serverCache.descricoes.set(anoMes, descricoes);
    }
    const descricoesMap = new Map<number, CaixaDescricaoRaw>(descricoes.map((d) => [d.c, d]));

    // 3. Carregar valores UF
    const cacheKeyUF = `${anoMes}-${uf}`;
    let valoresMap = serverCache.valoresUF.get(cacheKeyUF);
    if (!valoresMap) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-${uf}.json`;
      const valoresArray = await fetchCaixaJson<CaixaValorRaw[]>(url);
      valoresMap = new Map<number, CaixaValorRaw>();
      for (const v of valoresArray) {
        valoresMap.set(v.c, v);
      }
      serverCache.valoresUF.set(cacheKeyUF, valoresMap);
    }

    // Filtrar filhos da composição
    const relacoes = analitico.filter((a) => a.c === codigoPaiPrefixo);

    const itens: SinapiItemAnalitico[] = relacoes.map((rel) => {
      const d = descricoesMap.get(rel.i);
      const v = valoresMap!.get(rel.i);
      const codStr = String(rel.i);
      const isComposicao = codStr.startsWith("2");

      const precoUnitSem = v?.sd ?? 0;
      const precoUnitCom = v?.cd ?? 0;

      return {
        tipo: isComposicao ? "C" : "I",
        codigo: codStr.substring(1),
        codigoCompleto: codStr,
        descricao: d?.d ?? `Item ${codStr}`,
        unidade: d?.u ?? "UN",
        coeficiente: rel.cf,
        precoUnitarioSemDesoneracao: precoUnitSem,
        precoUnitarioComDesoneracao: precoUnitCom,
        custoTotalSemDesoneracao: Number((precoUnitSem * rel.cf).toFixed(4)),
        custoTotalComDesoneracao: Number((precoUnitCom * rel.cf).toFixed(4)),
      };
    });

    const totalSemDesoneracao = itens.reduce((acc, curr) => acc + curr.custoTotalSemDesoneracao, 0);
    const totalComDesoneracao = itens.reduce((acc, curr) => acc + curr.custoTotalComDesoneracao, 0);

    return {
      codigoComposicao,
      totalItens: itens.length,
      totalSemDesoneracao: Number(totalSemDesoneracao.toFixed(2)),
      totalComDesoneracao: Number(totalComDesoneracao.toFixed(2)),
      itens,
    };
  });

// 4. Sincronizar competência oficial da Caixa diretamente com o banco de dados Supabase
export const sincronizarSinapiParaBanco = createServerFn({ method: "POST" })
  .validator(
    z.object({
      anoMes: z.string(), // ex: '2026-09'
      uf: z.string().length(2), // ex: 'MG'
    }),
  )
  .handler(async ({ data }) => {
    const { anoMes, uf } = data;
    const authContext = await requireSupabaseAuth();
    const supabase = authContext.supabase;

    // Converter '2026-09' -> '09/2026'
    const [ano, mes] = anoMes.split("-");
    const mesReferencia = `${mes}/${ano}`;

    // 1. Obter descrições
    let descricoes = serverCache.descricoes.get(anoMes);
    if (!descricoes) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-descricoes.json`;
      descricoes = await fetchCaixaJson<CaixaDescricaoRaw[]>(url);
      serverCache.descricoes.set(anoMes, descricoes);
    }

    // 2. Obter valores
    const cacheKeyUF = `${anoMes}-${uf}`;
    let valoresMap = serverCache.valoresUF.get(cacheKeyUF);
    if (!valoresMap) {
      const url = `${CAIXA_BASE_URL}/dados/${anoMes}/${anoMes}-${uf}.json`;
      const valoresArray = await fetchCaixaJson<CaixaValorRaw[]>(url);
      valoresMap = new Map<number, CaixaValorRaw>();
      for (const v of valoresArray) {
        valoresMap.set(v.c, v);
      }
      serverCache.valoresUF.set(cacheKeyUF, valoresMap);
    }

    // 3. Montar lotes para inserção
    const insumosRows: Record<string, unknown>[] = [];
    const composicoesRows: Record<string, unknown>[] = [];

    for (const d of descricoes) {
      const codStr = String(d.c);
      const isComposicao = codStr.startsWith("2");
      const codigoBase = codStr.substring(1);
      const val = valoresMap.get(d.c);

      // centavos
      const precoCentavos = Math.round((val?.sd ?? val?.cd ?? 0) * 100);

      if (isComposicao) {
        const grupoObj = SINAPI_GRUPOS.find((g) => g.id === d.g);
        composicoesRows.push({
          fonte: "sinapi",
          uf,
          mes_referencia: mesReferencia,
          codigo: codigoBase,
          descricao: d.d,
          unidade: d.u,
          custo_total: precoCentavos,
          tipo_classe: grupoObj?.g ?? "SINAPI",
        });
      } else {
        insumosRows.push({
          fonte: "sinapi",
          uf,
          mes_referencia: mesReferencia,
          codigo: codigoBase,
          descricao: d.d,
          unidade: d.u,
          preco_mediano: precoCentavos,
        });
      }
    }

    // Inserção em lotes de 500 registros
    const BATCH_SIZE = 500;
    let insumosInseridos = 0;
    let composicoesInseridas = 0;

    for (let i = 0; i < insumosRows.length; i += BATCH_SIZE) {
      const chunk = insumosRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("referencia_insumos").upsert(chunk, {
        onConflict: "fonte,uf,mes_referencia,codigo",
      });
      if (error) throw error;
      insumosInseridos += chunk.length;
    }

    for (let i = 0; i < composicoesRows.length; i += BATCH_SIZE) {
      const chunk = composicoesRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("referencia_composicoes").upsert(chunk, {
        onConflict: "fonte,uf,mes_referencia,codigo",
      });
      if (error) throw error;
      composicoesInseridas += chunk.length;
    }

    return {
      success: true,
      mesReferencia,
      uf,
      insumosInseridos,
      composicoesInseridas,
      total: insumosInseridos + composicoesInseridas,
    };
  });
