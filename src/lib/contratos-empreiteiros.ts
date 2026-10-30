export interface ItemContratoCalculo {
  id?: string;
  descricao: string;
  unidade: string;
  quantidadeContratada: number;
  precoUnitarioCentavos: number;
}

export interface EntradaMedicaoItem {
  modo: "quantidade" | "percentual" | "valor";
  quantidade?: number;
  percentual?: number;
  valorCentavos?: number;
}

export interface ResultadoConversaoMedicao {
  quantidade: number;
  percentual: number;
  valorCentavos: number;
}

export interface AjusteMedicaoCalculo {
  id?: string;
  tipo: "desconto" | "adiantamento" | "retencao_tecnica" | "tributo" | "outro";
  descricao: string;
  percentual?: number | null;
  baseCalculoCentavos?: number | null;
  valorCentavos: number;
}

export interface ItemMedicaoComSaldo {
  servicoTerceirizadoId: string;
  descricao: string;
  unidade: string;
  quantidadeContratada: number;
  precoUnitarioCentavos: number;
  totalContratadoCentavos: number;
  anteriorQuantidade: number;
  anteriorCentavos: number;
  anteriorPercentual: number;
  atualQuantidade: number;
  atualCentavos: number;
  atualPercentual: number;
  acumuladoQuantidade: number;
  quantidadeAcumulada?: number;
  acumuladoCentavos: number;
  acumuladoPercentual: number;
  saldoQuantidade: number;
  saldoCentavos: number;
  estouroSaldo: boolean;
  estouro?: boolean;
}

export interface ResumoMedicaoCalculo {
  valorBrutoCentavos: number;
  totalDescontosCentavos: number;
  totalAmortizacoesCentavos: number;
  totalRetencoesCentavos: number;
  totalTributosCentavos: number;
  totalDeducoesCentavos: number;
  valorLiquidoCentavos: number;
  liquidoNegativo: boolean;
  ajustesCalculados: AjusteMedicaoCalculo[];
}

function roundHalfUp(num: number): number {
  return Math.round(num);
}

function roundToDecimals(num: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Converte a entrada de medição (quantidade, percentual ou valor)
 * para os 3 formatos sincronizados, com escala de 6 casas na quantidade,
 * 4 casas no percentual e centavos inteiros.
 */
export function converterEntradaMedicao(
  arg1: ItemContratoCalculo | "quantidade" | "percentual" | "valor",
  arg2: EntradaMedicaoItem | number,
  arg3?: number,
  arg4?: number
): ResultadoConversaoMedicao {
  let item: ItemContratoCalculo;
  let entrada: EntradaMedicaoItem;

  if (typeof arg1 === "string") {
    const modo = arg1 as "quantidade" | "percentual" | "valor";
    const valor = Number(arg2 || 0);
    item = {
      quantidadeContratada: Number(arg3 || 0),
      precoUnitarioCentavos: Number(arg4 || 0),
    };
    entrada = {
      modo,
      quantidade: modo === "quantidade" ? valor : undefined,
      percentual: modo === "percentual" ? valor : undefined,
      valorCentavos: modo === "valor" ? valor : undefined,
    };
  } else {
    item = arg1;
    entrada = arg2 as EntradaMedicaoItem;
  }
  const totalContratadoCentavos = Math.round(
    item.quantidadeContratada * item.precoUnitarioCentavos
  );

  if (item.quantidadeContratada <= 0 || item.precoUnitarioCentavos < 0) {
    return { quantidade: 0, percentual: 0, valorCentavos: 0 };
  }

  if (entrada.modo === "quantidade") {
    const qtdBruta = entrada.quantidade ?? 0;
    const qtd = Math.max(0, roundToDecimals(qtdBruta, 6));
    const val = roundHalfUp(qtd * item.precoUnitarioCentavos);
    const pct =
      totalContratadoCentavos > 0
        ? roundToDecimals((val / totalContratadoCentavos) * 100, 4)
        : 0;
    return {
      quantidade: qtd,
      percentual: Math.min(100, Math.max(0, pct)),
      valorCentavos: Math.max(0, val),
    };
  }

  if (entrada.modo === "percentual") {
    const pctBruto = entrada.percentual ?? 0;
    const pct = Math.min(100, Math.max(0, roundToDecimals(pctBruto, 4)));
    const val = roundHalfUp((pct / 100) * totalContratadoCentavos);
    const qtd =
      item.precoUnitarioCentavos > 0
        ? roundToDecimals(val / item.precoUnitarioCentavos, 6)
        : roundToDecimals((pct / 100) * item.quantidadeContratada, 6);
    return {
      quantidade: Math.max(0, qtd),
      percentual: pct,
      valorCentavos: Math.max(0, val),
    };
  }

  // modo === "valor"
  const valBruto = entrada.valorCentavos ?? 0;
  const val = Math.max(0, roundHalfUp(valBruto));
  const pct =
    totalContratadoCentavos > 0
      ? roundToDecimals((val / totalContratadoCentavos) * 100, 4)
      : 0;
  const qtd =
    item.precoUnitarioCentavos > 0
      ? roundToDecimals(val / item.precoUnitarioCentavos, 6)
      : 0;
  return {
    quantidade: Math.max(0, qtd),
    percentual: Math.min(100, Math.max(0, pct)),
    valorCentavos: val,
  };
}

/**
 * Calcula o saldo físico e financeiro do item considerando histórico anterior e valor atual.
 */
export function calcularSaldoItem(
  arg1: ItemContratoCalculo | number,
  arg2: { quantidade: number; centavos: number } | number,
  arg3: { quantidade: number; centavos: number } | number,
  arg4?: number
): ItemMedicaoComSaldo {
  let item: ItemContratoCalculo;
  let anterior: { quantidade: number; centavos: number };
  let atual: { quantidade: number; centavos: number };

  if (typeof arg1 === "number") {
    const preco = Number(arg4 || 0);
    item = {
      quantidadeContratada: arg1,
      precoUnitarioCentavos: preco,
    };
    anterior = {
      quantidade: Number(arg2 || 0),
      centavos: Math.round(Number(arg2 || 0) * preco),
    };
    atual = {
      quantidade: Number(arg3 || 0),
      centavos: Math.round(Number(arg3 || 0) * preco),
    };
  } else {
    item = arg1;
    anterior = arg2 as { quantidade: number; centavos: number };
    atual = arg3 as { quantidade: number; centavos: number };
  }

  const totalContratadoCentavos = Math.round(
    item.quantidadeContratada * item.precoUnitarioCentavos
  );

  const anteriorQtd = Math.max(0, roundToDecimals(anterior?.quantidade || 0, 6));
  const anteriorCentavos = Math.max(0, Math.round(anterior?.centavos || 0));
  const anteriorPct =
    totalContratadoCentavos > 0
      ? roundToDecimals((anteriorCentavos / totalContratadoCentavos) * 100, 4)
      : 0;

  const atualQtd = Math.max(0, roundToDecimals(atual?.quantidade || 0, 6));
  const atualCentavos = Math.max(0, Math.round(atual?.centavos || 0));
  const atualPct =
    totalContratadoCentavos > 0
      ? roundToDecimals((atualCentavos / totalContratadoCentavos) * 100, 4)
      : 0;

  const acumuladoQtd = roundToDecimals(anteriorQtd + atualQtd, 6);
  const acumuladoCentavos = anteriorCentavos + atualCentavos;
  const acumuladoPct =
    totalContratadoCentavos > 0
      ? roundToDecimals((acumuladoCentavos / totalContratadoCentavos) * 100, 4)
      : 0;

  const saldoQtd = Math.max(0, roundToDecimals(item.quantidadeContratada - acumuladoQtd, 6));
  const saldoCentavos = Math.max(0, totalContratadoCentavos - acumuladoCentavos);

  const estouroSaldo =
    acumuladoCentavos > totalContratadoCentavos ||
    acumuladoQtd > item.quantidadeContratada + 1e-6;

  return {
    servicoTerceirizadoId: (item as any).servicoTerceirizadoId || item.id || "",
    descricao: item.descricao || "",
    unidade: item.unidade || "un",
    quantidadeContratada: item.quantidadeContratada,
    precoUnitarioCentavos: item.precoUnitarioCentavos,
    totalContratadoCentavos,
    anteriorQuantidade: anteriorQtd,
    anteriorCentavos,
    anteriorPercentual: anteriorPct,
    atualQuantidade: atualQtd,
    atualCentavos,
    atualPercentual: atualPct,
    acumuladoQuantidade: acumuladoQtd,
    quantidadeAcumulada: acumuladoQtd,
    acumuladoCentavos,
    acumuladoPercentual: acumuladoPct,
    saldoQuantidade: saldoQtd,
    saldoCentavos,
    estouroSaldo,
    estouro: estouroSaldo,
  };
}

/**
 * Calcula o resumo financeiro da medição com deduções e retenções independentes sobre o bruto.
 */
export function calcularResumoMedicao(
  itens: Array<{ valorAtualCentavos: number }>,
  ajustes: AjusteMedicaoCalculo[]
): ResumoMedicaoCalculo {
  const valorBrutoCentavos = itens.reduce(
    (acc, it) => acc + Math.max(0, Math.round(it.valorAtualCentavos)),
    0
  );

  let totalDescontosCentavos = 0;
  let totalAmortizacoesCentavos = 0;
  let totalRetencoesCentavos = 0;
  let totalTributosCentavos = 0;

  const ajustesCalculados: AjusteMedicaoCalculo[] = ajustes.map((aj) => {
    let valorFinal = Math.max(0, Math.round(aj.valorCentavos));
    let baseCalculo = aj.baseCalculoCentavos ?? valorBrutoCentavos;

    // Se possui percentual, calcula sobre o bruto da medição atual (não em cascata)
    if (aj.percentual != null && aj.percentual > 0) {
      baseCalculo = valorBrutoCentavos;
      valorFinal = roundHalfUp((aj.percentual / 100) * valorBrutoCentavos);
    }

    if (aj.tipo === "desconto") totalDescontosCentavos += valorFinal;
    else if (aj.tipo === "adiantamento") totalAmortizacoesCentavos += valorFinal;
    else if (aj.tipo === "retencao_tecnica") totalRetencoesCentavos += valorFinal;
    else if (aj.tipo === "tributo") totalTributosCentavos += valorFinal;
    else totalDescontosCentavos += valorFinal;

    return {
      ...aj,
      baseCalculoCentavos: baseCalculo,
      valorCentavos: valorFinal,
    };
  });

  const totalDeducoesCentavos =
    totalDescontosCentavos +
    totalAmortizacoesCentavos +
    totalRetencoesCentavos +
    totalTributosCentavos;

  const saldoLiquidoBruto = valorBrutoCentavos - totalDeducoesCentavos;
  const liquidoNegativo = saldoLiquidoBruto < 0;
  const valorLiquidoCentavos = Math.max(0, saldoLiquidoBruto);

  return {
    valorBrutoCentavos,
    totalDescontosCentavos,
    totalAmortizacoesCentavos,
    totalRetencoesCentavos,
    totalTributosCentavos,
    totalDeducoesCentavos,
    valorLiquidoCentavos,
    liquidoNegativo,
    ajustesCalculados,
  };
}

/**
 * Valida a planilha de itens de um contrato antes de submissão.
 */
export function validarPlanilhaContrato(itens: ItemContratoCalculo[]): {
  valido: boolean;
  totalCentavos: number;
  erros: string[];
} {
  const erros: string[] = [];
  if (!itens || itens.length === 0) {
    erros.push("O contrato deve possuir pelo menos um item.");
    return { valido: false, totalCentavos: 0, erros };
  }

  let totalCentavos = 0;
  itens.forEach((it, idx) => {
    if (!it.descricao || !it.descricao.trim()) {
      erros.push(`Item ${idx + 1}: Descrição é obrigatória.`);
    }
    if (!it.unidade || !it.unidade.trim()) {
      erros.push(`Item ${idx + 1}: Unidade é obrigatória.`);
    }
    if (it.quantidadeContratada <= 0) {
      erros.push(`Item ${idx + 1}: Quantidade contratada deve ser maior que zero.`);
    }
    if (it.precoUnitarioCentavos < 0) {
      erros.push(`Item ${idx + 1}: Preço unitário não pode ser negativo.`);
    }
    totalCentavos += Math.round(it.quantidadeContratada * it.precoUnitarioCentavos);
  });

  return {
    valido: erros.length === 0,
    totalCentavos,
    erros,
  };
}

