export type PeriodicidadeParcelamento = "mensal" | "quinzenal" | "semanal";

export interface ParametrosParcelamento {
  valorTotalCentavos: number;
  quantidadeParcelas: number;
  dataPrimeiroVencimento: string; // YYYY-MM-DD
  periodicidade?: PeriodicidadeParcelamento;
  descricaoBase: string;
}

export interface ParcelaGerada {
  numero: number;
  totalParcelas: number;
  descricao: string;
  valorCentavos: number;
  dataVencimento: string; // YYYY-MM-DD
}

function calcularDataVencimento(
  dataBaseStr: string,
  indiceParcela: number,
  periodicidade: PeriodicidadeParcelamento
): string {
  if (indiceParcela === 0) return dataBaseStr;

  const [anoStr, mesStr, diaStr] = dataBaseStr.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const dia = parseInt(diaStr, 10);

  if (periodicidade === "mensal") {
    const mesIndex = mes - 1 + indiceParcela;
    const targetAno = ano + Math.floor(mesIndex / 12);
    const targetMes = (mesIndex % 12) + 1;
    // Dias máximos no mês de destino
    const maxDiasNoMes = new Date(targetAno, targetMes, 0).getDate();
    const targetDia = Math.min(dia, maxDiasNoMes);

    const mm = String(targetMes).padStart(2, "0");
    const dd = String(targetDia).padStart(2, "0");
    return `${targetAno}-${mm}-${dd}`;
  }

  const d = new Date(ano, mes - 1, dia);
  const diasAdicionar = periodicidade === "quinzenal" ? indiceParcela * 15 : indiceParcela * 7;
  d.setDate(d.getDate() + diasAdicionar);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function gerarParcelasFinanceiras({
  valorTotalCentavos,
  quantidadeParcelas,
  dataPrimeiroVencimento,
  periodicidade = "mensal",
  descricaoBase,
}: ParametrosParcelamento): ParcelaGerada[] {
  const qtd = Math.max(1, Math.floor(quantidadeParcelas));
  const total = Math.max(0, Math.round(valorTotalCentavos));

  if (qtd <= 1) {
    return [
      {
        numero: 1,
        totalParcelas: 1,
        descricao: descricaoBase.trim(),
        valorCentavos: total,
        dataVencimento: dataPrimeiroVencimento,
      },
    ];
  }

  const valorBase = Math.floor(total / qtd);
  const restoCentavos = total % qtd;
  const parcelas: ParcelaGerada[] = [];

  for (let i = 0; i < qtd; i++) {
    const numero = i + 1;
    // O resto é distribuído nas primeiras parcelas para manter a soma 100% fiel ao total
    const valorCentavos = valorBase + (i < restoCentavos ? 1 : 0);
    const dataVencimento = calcularDataVencimento(dataPrimeiroVencimento, i, periodicidade);
    const desc = `${descricaoBase.trim()} (${numero}/${qtd})`;

    parcelas.push({
      numero,
      totalParcelas: qtd,
      descricao: desc,
      valorCentavos,
      dataVencimento,
    });
  }

  return parcelas;
}

