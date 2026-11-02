export type ResultadoObraOrigem =
  | "orcamento"
  | "receita"
  | "pedido"
  | "contrato"
  | "conta_pagar"
  | "conta_receber"
  | "avanco";

export type ResultadoObraRegime = "caixa" | "competencia";
export type ResultadoObraPeriodo = "obra_inteira" | "ate_hoje" | "mes";
export type ResultadoObraSaude = "saudavel" | "atencao" | "critico" | "sem_dados";

export interface ResultadoObraFiltros {
  obraId: string | null;
  regime: ResultadoObraRegime;
  periodo: ResultadoObraPeriodo;
  dataInicio: string | null;
  dataFim: string | null;
  hoje?: string;
}

export interface ResultadoObraLinha {
  obraId: string;
  obraNome: string;
  etapaId: string | null;
  etapaNome: string | null;
  origem: ResultadoObraOrigem;
  origemId: string;
  origemVinculoId: string | null;
  descricao: string;
  dataReferencia: string | null;
  dataVencimento?: string | null;
  valorEmAbertoCentavos?: number;
  valorOrcadoCentavos: number;
  valorReceitaCentavos: number;
  valorComprometidoCentavos: number;
  valorRealizadoCentavos: number;
  valorPagoCentavos: number;
  avancoFisicoPercentual: number | null;
  legadoSemSaldo: boolean;
  competenciaFallback?: boolean;
  origemUrl?: string | null;
  metadados?: Record<string, unknown>;
}

export interface ResultadoObraAlerta {
  id: string;
  tipo:
    | "sem_orcamento"
    | "sem_receita"
    | "legado_sem_saldo"
    | "sem_apropriacao"
    | "titulo_vencido"
    | "desvio_orcamento"
    | "margem_critica";
  titulo: string;
  descricao: string;
  etapaId: string | null;
  origemId: string | null;
  origemUrl: string | null;
}

export interface ResultadoObraEtapa {
  id: string | null;
  nome: string;
  bacCentavos: number;
  comprometidoCentavos: number;
  realizadoCentavos: number;
  pagoCentavos: number;
  avancoFisicoPercentual: number | null;
  valorAgregadoCentavos: number | null;
  idc: number | null;
  eacContratualCentavos: number | null;
  eacDesempenhoCentavos: number | null;
  eacPrincipalCentavos: number | null;
  desvioProjetadoCentavos: number | null;
  desvioProjetadoPercentual: number | null;
  saude: ResultadoObraSaude;
  linhas: ResultadoObraLinha[];
}

export interface ResultadoObraQualidade {
  temDadosParciais: boolean;
  quantidadeSemEtapa: number;
  valorSemEtapaCentavos: number;
  quantidadeSemVinculo: number;
  quantidadeFallbackCompetencia: number;
  quantidadeLegadoSemSaldo: number;
}

export interface ResultadoObraResumo {
  obraId: string | null;
  obraNome: string | null;
  bacCentavos: number | null;
  receitaContratadaCentavos: number | null;
  comprometidoCentavos: number;
  realizadoCentavos: number;
  pagoCentavos: number;
  avancoFisicoPercentual: number | null;
  valorAgregadoCentavos: number | null;
  idc: number | null;
  eacContratualCentavos: number | null;
  eacDesempenhoCentavos: number | null;
  eacPrincipalCentavos: number | null;
  margemPrevistaCentavos: number | null;
  margemPrevistaPercentual: number | null;
  margemProjetadaCentavos: number | null;
  margemProjetadaPercentual: number | null;
  desvioProjetadoCentavos: number | null;
  desvioProjetadoPercentual: number | null;
  saude: ResultadoObraSaude;
  compromissoEhPosicaoAtual: boolean;
  etapas: ResultadoObraEtapa[];
  alertas: ResultadoObraAlerta[];
  qualidade: ResultadoObraQualidade;
}

const ORIGENS_VALIDAS = new Set<ResultadoObraOrigem>([
  "orcamento",
  "receita",
  "pedido",
  "contrato",
  "conta_pagar",
  "conta_receber",
  "avanco",
]);

function centavos(valor: unknown): number {
  return Number.isFinite(valor) ? Math.trunc(Number(valor)) : 0;
}

export function normalizarResultadoObraLinha(
  linha: ResultadoObraLinha | (Omit<ResultadoObraLinha, "origem"> & { origem: string }),
): ResultadoObraLinha | null {
  if (!ORIGENS_VALIDAS.has(linha.origem as ResultadoObraOrigem)) return null;

  return {
    ...linha,
    origem: linha.origem as ResultadoObraOrigem,
    valorOrcadoCentavos: centavos(linha.valorOrcadoCentavos),
    valorReceitaCentavos: centavos(linha.valorReceitaCentavos),
    valorComprometidoCentavos: centavos(linha.valorComprometidoCentavos),
    valorRealizadoCentavos: centavos(linha.valorRealizadoCentavos),
    valorPagoCentavos: centavos(linha.valorPagoCentavos),
    valorEmAbertoCentavos: centavos(linha.valorEmAbertoCentavos),
  };
}

export function classificarSaudeResultado(desvioPercentual: number | null): ResultadoObraSaude {
  if (desvioPercentual === null || !Number.isFinite(desvioPercentual)) return "sem_dados";
  if (desvioPercentual <= 5) return "saudavel";
  if (desvioPercentual <= 10) return "atencao";
  return "critico";
}

function estaNoPeriodo(linha: ResultadoObraLinha, filtros: ResultadoObraFiltros): boolean {
  if (filtros.periodo === "obra_inteira") return true;
  if (!linha.dataReferencia) return false;
  if (filtros.dataInicio && linha.dataReferencia < filtros.dataInicio) return false;
  if (filtros.dataFim && linha.dataReferencia > filtros.dataFim) return false;
  if (
    filtros.periodo === "ate_hoje" &&
    linha.dataReferencia > (filtros.hoje ?? new Date().toISOString().slice(0, 10))
  ) {
    return false;
  }
  return true;
}

function percentual(parte: number, total: number | null): number | null {
  if (!total) return null;
  return (parte / total) * 100;
}

function calcularProjecoes(
  bacCentavos: number,
  realizadoCentavos: number,
  comprometidoCentavos: number,
  avancoFisicoPercentual: number | null,
) {
  if (bacCentavos <= 0) {
    return {
      valorAgregadoCentavos: null,
      idc: null,
      eacContratualCentavos: null,
      eacDesempenhoCentavos: null,
      eacPrincipalCentavos: null,
      desvioProjetadoCentavos: null,
      desvioProjetadoPercentual: null,
      saude: "sem_dados" as const,
    };
  }

  const valorAgregadoCentavos =
    avancoFisicoPercentual === null
      ? null
      : Math.round(bacCentavos * (avancoFisicoPercentual / 100));
  const idc =
    valorAgregadoCentavos !== null && valorAgregadoCentavos > 0 && realizadoCentavos > 0
      ? valorAgregadoCentavos / realizadoCentavos
      : null;
  const eacContratualCentavos = Math.max(bacCentavos, realizadoCentavos + comprometidoCentavos);
  const desempenhoConfiavel =
    avancoFisicoPercentual !== null &&
    avancoFisicoPercentual >= 5 &&
    realizadoCentavos >= bacCentavos * 0.01 &&
    idc !== null &&
    idc > 0;
  const eacDesempenhoCentavos = desempenhoConfiavel ? Math.round(bacCentavos / idc) : null;
  const eacPrincipalCentavos = Math.max(
    eacContratualCentavos,
    eacDesempenhoCentavos ?? eacContratualCentavos,
  );
  const desvioProjetadoCentavos = eacPrincipalCentavos - bacCentavos;
  const desvioProjetadoPercentual = (desvioProjetadoCentavos / bacCentavos) * 100;

  return {
    valorAgregadoCentavos,
    idc,
    eacContratualCentavos,
    eacDesempenhoCentavos,
    eacPrincipalCentavos,
    desvioProjetadoCentavos,
    desvioProjetadoPercentual,
    saude: classificarSaudeResultado(desvioProjetadoPercentual),
  };
}

export function calcularResultadoObra(
  linhasRecebidas: ResultadoObraLinha[],
  filtros: ResultadoObraFiltros,
): ResultadoObraResumo {
  const linhas = linhasRecebidas
    .map((linha) => normalizarResultadoObraLinha(linha))
    .filter((linha): linha is ResultadoObraLinha => linha !== null)
    .filter((linha) => !filtros.obraId || linha.obraId === filtros.obraId);
  const origensPorId = new Map(linhas.map((linha) => [linha.origemId, linha]));
  const movimentosNoPeriodo = new Set(
    linhas.filter((linha) => estaNoPeriodo(linha, filtros)).map((linha) => linha.origemId),
  );
  const contribuicoes = linhas.map((linha) => {
    const origemVinculada = linha.origemVinculoId
      ? origensPorId.get(linha.origemVinculoId)
      : undefined;
    const contaVinculada = linha.origem === "conta_pagar" && Boolean(origemVinculada);
    const noPeriodo = movimentosNoPeriodo.has(linha.origemId);

    return {
      linha,
      orcado: linha.valorOrcadoCentavos,
      receita: linha.valorReceitaCentavos,
      comprometido: contaVinculada ? 0 : linha.valorComprometidoCentavos,
      realizado:
        noPeriodo && !(contaVinculada && (origemVinculada?.valorRealizadoCentavos ?? 0) !== 0)
          ? linha.valorRealizadoCentavos
          : 0,
      pago: noPeriodo ? linha.valorPagoCentavos : 0,
    };
  });

  const temOrcamento = linhas.some(
    (linha) => linha.origem === "orcamento" || linha.valorOrcadoCentavos !== 0,
  );
  const temReceita = linhas.some(
    (linha) => linha.origem === "receita" || linha.valorReceitaCentavos !== 0,
  );
  const bacSomado = contribuicoes.reduce((total, item) => total + item.orcado, 0);
  const receitaSomada = contribuicoes.reduce((total, item) => total + item.receita, 0);
  const bacCentavos = temOrcamento ? bacSomado : null;
  const receitaContratadaCentavos = temReceita ? receitaSomada : null;

  type EtapaMutavel = {
    id: string | null;
    nome: string;
    bacCentavos: number;
    comprometidoCentavos: number;
    realizadoCentavos: number;
    pagoCentavos: number;
    avancos: number[];
    linhas: ResultadoObraLinha[];
  };
  const etapas = new Map<string, EtapaMutavel>();

  for (const item of contribuicoes) {
    const possuiValorDeEtapa =
      item.linha.origem !== "receita" &&
      (item.orcado !== 0 ||
        item.comprometido !== 0 ||
        item.realizado !== 0 ||
        item.pago !== 0 ||
        item.linha.origem === "avanco");
    if (!possuiValorDeEtapa) continue;
    const chave = item.linha.etapaId ?? "__sem_apropriacao__";
    const etapa = etapas.get(chave) ?? {
      id: item.linha.etapaId,
      nome: item.linha.etapaNome?.trim() || "Sem apropriação",
      bacCentavos: 0,
      comprometidoCentavos: 0,
      realizadoCentavos: 0,
      pagoCentavos: 0,
      avancos: [],
      linhas: [],
    };
    etapa.bacCentavos += item.orcado;
    etapa.comprometidoCentavos += item.comprometido;
    etapa.realizadoCentavos += item.realizado;
    etapa.pagoCentavos += item.pago;
    if (item.linha.avancoFisicoPercentual !== null) {
      etapa.avancos.push(item.linha.avancoFisicoPercentual);
    }
    etapa.linhas.push(item.linha);
    etapas.set(chave, etapa);
  }

  const etapasCalculadas = [...etapas.values()]
    .sort((a, b) => Number(a.id === null) - Number(b.id === null))
    .map<ResultadoObraEtapa>((etapa) => {
      const avanco = etapa.avancos.length ? Math.max(...etapa.avancos) : null;
      return {
        ...etapa,
        avancoFisicoPercentual: avanco,
        ...calcularProjecoes(
          etapa.bacCentavos,
          etapa.realizadoCentavos,
          etapa.comprometidoCentavos,
          avanco,
        ),
      };
    });

  const comprometidoCentavos = etapasCalculadas.reduce(
    (total, etapa) => total + etapa.comprometidoCentavos,
    0,
  );
  const realizadoCentavos = etapasCalculadas.reduce(
    (total, etapa) => total + etapa.realizadoCentavos,
    0,
  );
  const pagoCentavos = etapasCalculadas.reduce((total, etapa) => total + etapa.pagoCentavos, 0);
  const etapasComAvanco = etapasCalculadas.filter(
    (etapa) => etapa.bacCentavos > 0 && etapa.avancoFisicoPercentual !== null,
  );
  const avancoFisicoPercentual =
    bacCentavos && etapasComAvanco.length
      ? (etapasComAvanco.reduce(
          (total, etapa) => total + etapa.bacCentavos * ((etapa.avancoFisicoPercentual ?? 0) / 100),
          0,
        ) /
          bacCentavos) *
        100
      : null;
  const projecoes = calcularProjecoes(
    bacCentavos ?? 0,
    realizadoCentavos,
    comprometidoCentavos,
    avancoFisicoPercentual,
  );
  const margemPrevistaCentavos =
    receitaContratadaCentavos !== null && bacCentavos !== null
      ? receitaContratadaCentavos - bacCentavos
      : null;
  const margemProjetadaCentavos =
    receitaContratadaCentavos !== null && projecoes.eacPrincipalCentavos !== null
      ? receitaContratadaCentavos - projecoes.eacPrincipalCentavos
      : null;

  const linhasSemEtapa = linhas.filter(
    (linha) =>
      linha.etapaId === null &&
      linha.origem !== "receita" &&
      (linha.valorOrcadoCentavos !== 0 ||
        linha.valorComprometidoCentavos !== 0 ||
        linha.valorRealizadoCentavos !== 0 ||
        linha.valorPagoCentavos !== 0 ||
        linha.valorEmAbertoCentavos !== 0),
  );
  const quantidadeSemVinculo = linhas.filter(
    (linha) => linha.origem === "conta_pagar" && !linha.origemVinculoId,
  ).length;
  const quantidadeFallbackCompetencia = linhas.filter((linha) => linha.competenciaFallback).length;
  const quantidadeLegadoSemSaldo = linhas.filter((linha) => linha.legadoSemSaldo).length;
  const qualidade: ResultadoObraQualidade = {
    temDadosParciais:
      linhasSemEtapa.length > 0 ||
      quantidadeSemVinculo > 0 ||
      quantidadeFallbackCompetencia > 0 ||
      quantidadeLegadoSemSaldo > 0,
    quantidadeSemEtapa: linhasSemEtapa.length,
    valorSemEtapaCentavos: linhasSemEtapa.reduce(
      (total, linha) =>
        total +
        Math.max(
          linha.valorOrcadoCentavos,
          linha.valorComprometidoCentavos,
          linha.valorRealizadoCentavos,
          linha.valorPagoCentavos,
          linha.valorEmAbertoCentavos ?? 0,
        ),
      0,
    ),
    quantidadeSemVinculo,
    quantidadeFallbackCompetencia,
    quantidadeLegadoSemSaldo,
  };

  const alertas: ResultadoObraAlerta[] = [];
  const adicionarAlerta = (
    tipo: ResultadoObraAlerta["tipo"],
    titulo: string,
    descricao: string,
    linha?: ResultadoObraLinha,
  ) =>
    alertas.push({
      id: `${tipo}:${linha?.origemId ?? "obra"}`,
      tipo,
      titulo,
      descricao,
      etapaId: linha?.etapaId ?? null,
      origemId: linha?.origemId ?? null,
      origemUrl: linha?.origemUrl ?? null,
    });

  if (!temOrcamento)
    adicionarAlerta("sem_orcamento", "Obra sem orçamento", "Vincule uma revisão analítica atual.");
  if (!temReceita)
    adicionarAlerta(
      "sem_receita",
      "Receita não informada",
      "Vincule uma proposta ou contrato comercial.",
    );
  for (const linha of linhas.filter((item) => item.legadoSemSaldo)) {
    adicionarAlerta(
      "legado_sem_saldo",
      "Compromisso legado parcial",
      "O saldo recebido não é aferível.",
      linha,
    );
  }
  if (linhasSemEtapa.length) {
    adicionarAlerta(
      "sem_apropriacao",
      "Lançamentos sem apropriação",
      `${linhasSemEtapa.length} lançamento(s) sem etapa.`,
      linhasSemEtapa[0],
    );
  }

  const hoje = filtros.hoje ?? new Date().toISOString().slice(0, 10);
  const limiteVencido = Math.max(100_000, Math.round((bacCentavos ?? 0) * 0.01));
  for (const linha of linhas) {
    if (
      linha.dataVencimento &&
      linha.dataVencimento < hoje &&
      (linha.valorEmAbertoCentavos ?? 0) >= limiteVencido
    ) {
      adicionarAlerta("titulo_vencido", "Título vencido relevante", linha.descricao, linha);
    }
  }
  for (const etapa of etapasCalculadas.filter((item) => item.saude === "critico")) {
    adicionarAlerta(
      "desvio_orcamento",
      "Etapa acima do orçamento",
      `${etapa.nome} possui desvio crítico.`,
      etapa.linhas[0],
    );
  }
  if (
    margemProjetadaCentavos !== null &&
    receitaContratadaCentavos &&
    margemProjetadaCentavos / receitaContratadaCentavos < 0.1
  ) {
    adicionarAlerta(
      "margem_critica",
      "Margem projetada crítica",
      "A margem projetada está abaixo de 10% da receita.",
    );
  }

  const dataFimHistorica =
    filtros.periodo === "mes" && Boolean(filtros.dataFim) && filtros.dataFim! < hoje;

  return {
    obraId: filtros.obraId ?? linhas[0]?.obraId ?? null,
    obraNome: linhas[0]?.obraNome ?? null,
    bacCentavos,
    receitaContratadaCentavos,
    comprometidoCentavos,
    realizadoCentavos,
    pagoCentavos,
    avancoFisicoPercentual,
    ...projecoes,
    margemPrevistaCentavos,
    margemPrevistaPercentual:
      margemPrevistaCentavos === null
        ? null
        : percentual(margemPrevistaCentavos, receitaContratadaCentavos),
    margemProjetadaCentavos,
    margemProjetadaPercentual:
      margemProjetadaCentavos === null
        ? null
        : percentual(margemProjetadaCentavos, receitaContratadaCentavos),
    compromissoEhPosicaoAtual: dataFimHistorica,
    etapas: etapasCalculadas,
    alertas,
    qualidade,
  };
}
