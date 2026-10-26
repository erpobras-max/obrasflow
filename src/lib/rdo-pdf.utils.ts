/**
 * Utilitários e formatação do Relatório Diário de Obra (RDO)
 */

export interface EfetivoItem {
  funcao: string;
  quantidade: number;
}

export interface ObraEnderecoInfo {
  logradouro?: string | null;
  numero_endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export const CLIMA_DESCRICOES: Record<string, { label: string; condicaoTrabalho: string }> = {
  claro: { label: "Ensolarado / Céu Aberto", condicaoTrabalho: "Normal (Sem impedimentos)" },
  nublado: { label: "Nublado / Encoberto", condicaoTrabalho: "Normal (Sem impedimentos)" },
  chuva_fraca: { label: "Chuva Fraca / Garoa", condicaoTrabalho: "Praticável com ressalvas" },
  chuva_forte: { label: "Chuva Forte / Temporal", condicaoTrabalho: "Impraticável / Reduzido" },
  impraticavel: { label: "Impraticável (Chuva / Solo Encharcado)", condicaoTrabalho: "Paralisado por intempérie" },
};

/**
 * Retorna a data formatada e o dia da semana por extenso em pt-BR
 */
export function formatarDataRdo(dataIso: string): {
  dataFormatada: string;
  diaSemana: string;
  dataCompletaExtenso: string;
} {
  if (!dataIso) {
    return { dataFormatada: "—", diaSemana: "—", dataCompletaExtenso: "—" };
  }

  // Divide para evitar conversões e fuso horário
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, (mes || 1) - 1, dia || 1);

  const diasSemana = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const diaPad = String(dia).padStart(2, "0");
  const mesPad = String(mes).padStart(2, "0");
  const diaSemanaNome = diasSemana[data.getDay()] || "";
  const mesNome = meses[data.getMonth()] || "";

  return {
    dataFormatada: `${diaPad}/${mesPad}/${ano}`,
    diaSemana: diaSemanaNome,
    dataCompletaExtenso: `${diaSemanaNome}, ${diaPad} de ${mesNome} de ${ano}`,
  };
}

/**
 * Gera o identificador oficial do RDO, ex: RDO-001/2026-10-26
 */
export function gerarCodigoRdo(obraNumero: string | null | undefined, dataIso: string): string {
  const numLimpo = (obraNumero || "000").trim();
  const dataLimpa = (dataIso || "00000000").replace(/-/g, "");
  return `RDO-${numLimpo}-${dataLimpa}`;
}

/**
 * Calcula o total geral de efetivo somando as quantidades
 */
export function calcularTotalEfetivo(efetivo: EfetivoItem[] | null | undefined): number {
  if (!Array.isArray(efetivo)) return 0;
  return efetivo.reduce((acc, item) => acc + (Number(item?.quantidade) || 0), 0);
}

/**
 * Formata o endereço completo da obra
 */
export function formatarEnderecoObra(obra: ObraEnderecoInfo | null | undefined): string {
  if (!obra) return "Canteiro de Obras principal";
  const partes: string[] = [];
  if (obra.logradouro) {
    let rua = obra.logradouro;
    if (obra.numero_endereco) rua += `, ${obra.numero_endereco}`;
    if (obra.complemento) rua += ` - ${obra.complemento}`;
    partes.push(rua);
  }
  if (obra.bairro) partes.push(obra.bairro);
  if (obra.cidade && obra.uf) {
    partes.push(`${obra.cidade}/${obra.uf}`);
  } else if (obra.cidade) {
    partes.push(obra.cidade);
  }
  return partes.length > 0 ? partes.join(", ") : "Canteiro de Obras principal";
}

/**
 * Retorna os detalhes do clima e status operacional
 */
export function obterClimaDetalhado(climaKey: string | null | undefined, temperatura: number | null | undefined) {
  const chave = (climaKey || "").toLowerCase();
  const info = CLIMA_DESCRICOES[chave] || {
    label: climaKey || "Não informado",
    condicaoTrabalho: "Normal (Sem impedimentos)",
  };

  const tempTexto = temperatura != null && !isNaN(Number(temperatura)) ? `${temperatura}°C` : "Não registrada";

  return {
    label: info.label,
    condicaoTrabalho: info.condicaoTrabalho,
    temperaturaTexto: tempTexto,
  };
}
