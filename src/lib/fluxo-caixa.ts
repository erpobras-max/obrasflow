// Motor de cálculo de Fluxo de Caixa Diário, Semanal e Mensal por Obra e Conta Bancária

export interface FluxoCaixaItemConta {
  id: string;
  tipo: "receber" | "pagar";
  descricao: string;
  obra_id?: string | null;
  obra_nome?: string | null;
  conta_bancaria_id?: string | null;
  valor_total_centavos: number;
  valor_liquidado_centavos?: number | null;
  data_vencimento: string; // "YYYY-MM-DD"
  data_liquidacao?: string | null; // "YYYY-MM-DD"
  status: string; // "pendente" | "recebida" | "paga" | "atrasada" | "cancelada"
  etapa_nome?: string | null;
}

export type GranularidadeFluxo = "diario" | "semanal" | "mensal";

export interface FiltrosFluxoCaixa {
  granularidade: GranularidadeFluxo;
  obraId?: string | "todas";
  contaBancariaId?: string | "todas";
  dataReferencia?: string; // "YYYY-MM-DD", default hoje
  diasProjecao?: number; // Padrão: 30 dias para diário
  semanasProjecao?: number; // Padrão: 8 semanas
  mesesAnteriores?: number; // Padrão: 2 meses
  mesesPosteriores?: number; // Padrão: 4 meses
}

export interface FluxoCaixaPeriodo {
  chave: string;
  label: string;
  dataInicio: string;
  dataFim: string;
  saldoInicialCentavos: number;
  entradasPrevistasCentavos: number;
  entradasRealizadasCentavos: number;
  saidasPrevistasCentavos: number;
  saidasRealizadasCentavos: number;
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  resultadoCentavos: number;
  saldoFinalCentavos: number;
  saldoNegativo: boolean;
  itens: FluxoCaixaItemConta[];
}

export interface ResumoFluxoCaixa {
  saldoInicialCentavos: number;
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  resultadoPeriodoCentavos: number;
  saldoFinalProjetadoCentavos: number;
  menorSaldoProjetadoCentavos: number;
  dataMenorSaldo?: string;
  periodos: FluxoCaixaPeriodo[];
}

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatarDataYMD(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDataYMD(dataYMD: string): Date {
  const [y, m, d] = dataYMD.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Gera os slots de períodos conforme a granularidade selecionada.
 */
export function gerarSlotsPeriodos(
  granularidade: GranularidadeFluxo,
  dataRefYMD: string,
  diasProjecao = 30,
  semanasProjecao = 8,
  mesesAnteriores = 2,
  mesesPosteriores = 4
): { chave: string; label: string; dataInicio: string; dataFim: string }[] {
  const baseDate = parseDataYMD(dataRefYMD);

  if (granularidade === "diario") {
    const slots = [];
    for (let i = 0; i < diasProjecao; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const ymd = formatarDataYMD(d);
      const diaSemana = DIAS_DA_SEMANA[d.getDay()];
      const diaMes = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      slots.push({
        chave: ymd,
        label: `${diaMes} (${diaSemana})`,
        dataInicio: ymd,
        dataFim: ymd,
      });
    }
    return slots;
  }

  if (granularidade === "semanal") {
    const slots = [];
    // Ajustar para o início da semana atual (segunda-feira)
    const dInicio = new Date(baseDate);
    const diaSemanaAtual = dInicio.getDay();
    const diffParaSegunda = diaSemanaAtual === 0 ? -6 : 1 - diaSemanaAtual;
    dInicio.setDate(dInicio.getDate() + diffParaSegunda);

    for (let s = 0; s < semanasProjecao; s++) {
      const dSeg = new Date(dInicio);
      dSeg.setDate(dInicio.getDate() + s * 7);
      const dDom = new Date(dSeg);
      dDom.setDate(dSeg.getDate() + 6);

      const ymdSeg = formatarDataYMD(dSeg);
      const ymdDom = formatarDataYMD(dDom);
      const label = `${String(dSeg.getDate()).padStart(2, "0")}/${String(dSeg.getMonth() + 1).padStart(2, "0")} a ${String(dDom.getDate()).padStart(2, "0")}/${String(dDom.getMonth() + 1).padStart(2, "0")}`;

      slots.push({
        chave: `SEM-${ymdSeg}`,
        label: `Semana ${s + 1} (${label})`,
        dataInicio: ymdSeg,
        dataFim: ymdDom,
      });
    }
    return slots;
  }

  // granularidade === "mensal"
  const slots = [];
  const anoAtual = baseDate.getFullYear();
  const mesAtual = baseDate.getMonth();

  for (let m = -mesesAnteriores; m <= mesesPosteriores; m++) {
    const dMes = new Date(anoAtual, mesAtual + m, 1);
    const y = dMes.getFullYear();
    const mesIdx = dMes.getMonth();
    const ymdInicio = `${y}-${String(mesIdx + 1).padStart(2, "0")}-01`;

    const ultimoDia = new Date(y, mesIdx + 1, 0).getDate();
    const ymdFim = `${y}-${String(mesIdx + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

    const label = `${MESES_ABREV[mesIdx]}/${String(y).slice(2)}`;

    slots.push({
      chave: `${y}-${String(mesIdx + 1).padStart(2, "0")}`,
      label,
      dataInicio: ymdInicio,
      dataFim: ymdFim,
    });
  }
  return slots;
}

/**
 * Calcula o fluxo de caixa com projeção acumulada, saldo inicial de bancos e detecção de saldo negativo.
 */
export function calcularFluxoCaixa(
  itensContas: FluxoCaixaItemConta[],
  saldoInicialBancosCentavos: number,
  filtros: FiltrosFluxoCaixa
): ResumoFluxoCaixa {
  const dataRefYMD = filtros.dataReferencia || formatarDataYMD(new Date());

  // 1. Filtrar itens conforme Obra e Conta Bancária
  const itensFiltrados = itensContas.filter((item) => {
    if (item.status === "cancelada") return false;

    if (filtros.obraId && filtros.obraId !== "todas" && item.obra_id !== filtros.obraId) {
      return false;
    }

    if (
      filtros.contaBancariaId &&
      filtros.contaBancariaId !== "todas" &&
      item.conta_bancaria_id !== filtros.contaBancariaId
    ) {
      return false;
    }

    return true;
  });

  // 2. Gerar slots de tempo
  const slots = gerarSlotsPeriodos(
    filtros.granularidade,
    dataRefYMD,
    filtros.diasProjecao ?? 30,
    filtros.semanasProjecao ?? 8,
    filtros.mesesAnteriores ?? 2,
    filtros.mesesPosteriores ?? 4
  );

  // 3. Inicializar períodos
  const periodos: FluxoCaixaPeriodo[] = slots.map((s) => ({
    chave: s.chave,
    label: s.label,
    dataInicio: s.dataInicio,
    dataFim: s.dataFim,
    saldoInicialCentavos: 0,
    entradasPrevistasCentavos: 0,
    entradasRealizadasCentavos: 0,
    saidasPrevistasCentavos: 0,
    saidasRealizadasCentavos: 0,
    totalEntradasCentavos: 0,
    totalSaidasCentavos: 0,
    resultadoCentavos: 0,
    saldoFinalCentavos: 0,
    saldoNegativo: false,
    itens: [],
  }));

  // 4. Distribuir contas nos períodos
  itensFiltrados.forEach((item) => {
    const ehLiquidado = item.status === "recebida" || item.status === "paga";
    const dataAlvo = ehLiquidado
      ? item.data_liquidacao || item.data_vencimento
      : item.data_vencimento;

    if (!dataAlvo) return;

    // Encontrar período correspondente
    const periodo = periodos.find(
      (p) => dataAlvo >= p.dataInicio && dataAlvo <= p.dataFim
    );

    if (!periodo) return;

    periodo.itens.push(item);

    const valorCentavos = ehLiquidado
      ? item.valor_liquidado_centavos ?? item.valor_total_centavos
      : item.valor_total_centavos;

    if (item.tipo === "receber") {
      if (ehLiquidado) {
        periodo.entradasRealizadasCentavos += valorCentavos;
      } else {
        periodo.entradasPrevistasCentavos += valorCentavos;
      }
    } else {
      if (ehLiquidado) {
        periodo.saidasRealizadasCentavos += valorCentavos;
      } else {
        periodo.saidasPrevistasCentavos += valorCentavos;
      }
    }
  });

  // 5. Acumular saldo em cascata
  let saldoCorrente = saldoInicialBancosCentavos;
  let menorSaldo = saldoCorrente;
  let dataMenorSaldo: string | undefined = undefined;

  let somaTotalEntradas = 0;
  let somaTotalSaidas = 0;

  periodos.forEach((p, idx) => {
    p.saldoInicialCentavos = saldoCorrente;

    p.totalEntradasCentavos =
      p.entradasPrevistasCentavos + p.entradasRealizadasCentavos;
    p.totalSaidasCentavos =
      p.saidasPrevistasCentavos + p.saidasRealizadasCentavos;

    p.resultadoCentavos = p.totalEntradasCentavos - p.totalSaidasCentavos;
    p.saldoFinalCentavos = p.saldoInicialCentavos + p.resultadoCentavos;
    p.saldoNegativo = p.saldoFinalCentavos < 0;

    somaTotalEntradas += p.totalEntradasCentavos;
    somaTotalSaidas += p.totalSaidasCentavos;

    if (p.saldoFinalCentavos < menorSaldo || idx === 0) {
      menorSaldo = p.saldoFinalCentavos;
      dataMenorSaldo = p.label;
    }

    saldoCorrente = p.saldoFinalCentavos;
  });

  return {
    saldoInicialCentavos: saldoInicialBancosCentavos,
    totalEntradasCentavos: somaTotalEntradas,
    totalSaidasCentavos: somaTotalSaidas,
    resultadoPeriodoCentavos: somaTotalEntradas - somaTotalSaidas,
    saldoFinalProjetadoCentavos: saldoCorrente,
    menorSaldoProjetadoCentavos: menorSaldo,
    dataMenorSaldo,
    periodos,
  };
}
