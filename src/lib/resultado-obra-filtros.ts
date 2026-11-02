import type {
  ResultadoObraFiltros,
  ResultadoObraPeriodo,
  ResultadoObraRegime,
} from "./resultado-obra.ts";

export type FinanceiroTab =
  | "receber"
  | "pagar"
  | "fluxo"
  | "conciliacao"
  | "resultado"
  | "dre"
  | "contas";

export interface ResultadoObraSearchState extends ResultadoObraFiltros {
  tab: FinanceiroTab;
}

export interface ResultadoObraSearchParams {
  tab?: unknown;
  obra?: unknown;
  regime?: unknown;
  periodo?: unknown;
  inicio?: unknown;
  fim?: unknown;
}

const TABS = new Set<FinanceiroTab>([
  "receber",
  "pagar",
  "fluxo",
  "conciliacao",
  "resultado",
  "dre",
  "contas",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function dataValida(valor: unknown): string | null {
  const candidata = texto(valor);
  if (!candidata || !DATA.test(candidata)) return null;
  const data = new Date(`${candidata}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== candidata) return null;
  return candidata;
}

export function parseResultadoObraSearch(
  search: ResultadoObraSearchParams | null | undefined,
): ResultadoObraSearchState {
  const entrada = search ?? {};
  const tabInformada = texto(entrada.tab) as FinanceiroTab | null;
  const tab = tabInformada && TABS.has(tabInformada) ? tabInformada : "receber";
  const obraInformada = texto(entrada.obra);
  const obraId = obraInformada && UUID.test(obraInformada) ? obraInformada : null;
  const regimeInformado = texto(entrada.regime);
  const regime: ResultadoObraRegime = regimeInformado === "caixa" ? "caixa" : "competencia";
  const inicio = dataValida(entrada.inicio);
  const fim = dataValida(entrada.fim);
  const periodoInformado = texto(entrada.periodo);
  let periodo: ResultadoObraPeriodo = "obra_inteira";
  let dataInicio: string | null = null;
  let dataFim: string | null = null;

  if (periodoInformado === "ate_hoje") {
    periodo = "ate_hoje";
    dataInicio = inicio;
    dataFim = fim;
  } else if (periodoInformado === "mes" && inicio && fim && inicio <= fim) {
    periodo = "mes";
    dataInicio = inicio;
    dataFim = fim;
  }

  return { tab, obraId, regime, periodo, dataInicio, dataFim };
}

export function serializarResultadoObraSearch(
  filtros: ResultadoObraSearchState,
): Record<string, string> {
  const search: Record<string, string> = {
    tab: filtros.tab,
    regime: filtros.regime,
    periodo: filtros.periodo,
  };
  if (filtros.obraId) search.obra = filtros.obraId;
  if (filtros.periodo !== "obra_inteira") {
    if (filtros.dataInicio) search.inicio = filtros.dataInicio;
    if (filtros.dataFim) search.fim = filtros.dataFim;
  }
  return search;
}
