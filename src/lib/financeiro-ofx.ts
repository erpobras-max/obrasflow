/**
 * Módulo de Processamento e Conciliação de Extratos Bancários OFX
 * Suporta formatos SGML e XML de qualquer banco brasileiro (Itaú, Bradesco, BB, Caixa, Santander, Inter, Nubank, etc.)
 */

export interface OfxTransacao {
  id: string; // fitid ou hash gerado
  fitid: string;
  tipo: "credito" | "debito";
  valorCentavos: number; // sempre positivo
  data: string; // YYYY-MM-DD
  descricao: string;
  documento?: string;
}

export interface OfxExtrato {
  bancoId?: string;
  agencia?: string;
  conta?: string;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  saldoFinalCentavos?: number;
  transacoes: OfxTransacao[];
}

export interface SugestaoConciliacao {
  transacaoId: string;
  contaId: string;
  tipo: "receber" | "pagar";
  descricao: string;
  valorCentavos: number;
  dataVencimento: string;
  score: "exato" | "alto" | "medio";
}

/**
 * Normaliza datas OFX no formato YYYYMMDD ou YYYYMMDDHHMMSS[-3:BRT] para YYYY-MM-DD
 */
export function normalizarDataOfx(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const clean = rawDate.trim().replace(/[-+:].*$/, "");
  if (clean.length >= 8) {
    const ano = clean.slice(0, 4);
    const mes = clean.slice(4, 6);
    const dia = clean.slice(6, 8);
    return `${ano}-${mes}-${dia}`;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Extrai o valor de uma tag OFX, suportando tanto XML (<TAG>val</TAG>) quanto SGML (<TAG>val\n)
 */
function extrairTag(bloco: string, tag: string): string | null {
  // Tenta formato com tag de fechamento <TAG>valor</TAG>
  const xmlRegex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const xmlMatch = bloco.match(xmlRegex);
  if (xmlMatch && xmlMatch[1] !== undefined) {
    return xmlMatch[1].trim();
  }

  // Tenta formato SGML <TAG>valor\n ou <TAG>valor<
  const sgmlRegex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
  const sgmlMatch = bloco.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return sgmlMatch[1].trim();
  }

  return null;
}

/**
 * Converte string de valor monetário (ex: "1500.50", "-320.00", "1.500,50") para centavos inteiros
 */
export function valorParaCentavos(rawVal: string): number {
  if (!rawVal) return 0;
  let valStr = rawVal.trim().replace(/\s/g, "");
  // Se tiver vírgula como decimal (ex: 1500,50)
  if (valStr.includes(",") && !valStr.includes(".")) {
    valStr = valStr.replace(",", ".");
  } else if (valStr.includes(".") && valStr.includes(",")) {
    // Ex: 1.500,50
    valStr = valStr.replace(/\./g, "").replace(",", ".");
  }
  const floatVal = parseFloat(valStr);
  if (isNaN(floatVal)) return 0;
  return Math.round(floatVal * 100);
}

/**
 * Lê e analisa o conteúdo de um arquivo OFX
 */
export function parseOfx(conteudo: string): OfxExtrato {
  if (!conteudo || typeof conteudo !== "string") {
    return { transacoes: [] };
  }

  // Normaliza quebras de linha
  const texto = conteudo.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const bancoId = extrairTag(texto, "BANKID") || undefined;
  const agencia = extrairTag(texto, "BRANCHID") || undefined;
  const conta = extrairTag(texto, "ACCTID") || undefined;
  const dtStart = extrairTag(texto, "DTSTART");
  const dtEnd = extrairTag(texto, "DTEND");
  const balAmt = extrairTag(texto, "BALAMT");

  const dataInicio = dtStart ? normalizarDataOfx(dtStart) : undefined;
  const dataFim = dtEnd ? normalizarDataOfx(dtEnd) : undefined;
  const saldoFinalCentavos = balAmt !== null ? valorParaCentavos(balAmt) : undefined;

  // Isola as tags <STMTTRN>
  const transacoes: OfxTransacao[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtTrnRegex.exec(texto)) !== null) {
    const bloco = match[1];
    if (!bloco || bloco.trim().length === 0) continue;

    const trntype = (extrairTag(bloco, "TRNTYPE") || "").toUpperCase();
    const rawAmt = extrairTag(bloco, "TRNAMT") || "0";
    const centavosComSinal = valorParaCentavos(rawAmt);
    const fitid = extrairTag(bloco, "FITID") || crypto.randomUUID();
    const dtPosted = extrairTag(bloco, "DTPOSTED") || "";
    const memo = extrairTag(bloco, "MEMO") || extrairTag(bloco, "NAME") || "Sem descrição";
    const checknum = extrairTag(bloco, "CHECKNUM") || extrairTag(bloco, "REFNUM") || undefined;

    // Se centavosComSinal for positivo ou TRNTYPE for CREDIT
    const isCredito = centavosComSinal > 0 || trntype === "CREDIT" || trntype === "DEP";
    const tipo = isCredito ? "credito" : "debito";
    const valorCentavos = Math.abs(centavosComSinal);
    const data = normalizarDataOfx(dtPosted);

    transacoes.push({
      id: fitid,
      fitid,
      tipo,
      valorCentavos,
      data,
      descricao: memo.replace(/[\t\n\r]+/g, " ").trim(),
      documento: checknum || undefined,
    });
  }

  return {
    bancoId,
    agencia,
    conta,
    dataInicio,
    dataFim,
    saldoFinalCentavos,
    transacoes,
  };
}

/**
 * Calcula a diferença em dias entre duas datas YYYY-MM-DD
 */
function diferencaDias(d1: string, d2: string): number {
  const t1 = new Date(d1 + "T00:00:00").getTime();
  const t2 = new Date(d2 + "T00:00:00").getTime();
  return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)));
}

/**
 * Sugere conciliação inteligente entre uma transação OFX e a lista de contas pendentes
 */
export function sugerirConciliacaoParaTransacao(
  transacao: OfxTransacao,
  contas: Array<{
    id: string;
    tipo: "receber" | "pagar";
    descricao: string;
    valorCentavos: number;
    dataVencimento: string;
    documento?: string | null;
  }>
): SugestaoConciliacao | null {
  const tipoEsperado = transacao.tipo === "credito" ? "receber" : "pagar";
  const elegiveis = contas.filter((c) => c.tipo === tipoEsperado);

  if (elegiveis.length === 0) return null;

  // 1. Match perfeito: mesmo valor e mesmo número de documento
  if (transacao.documento) {
    const matchDoc = elegiveis.find(
      (c) =>
        c.valorCentavos === transacao.valorCentavos &&
        c.documento &&
        (c.documento.includes(transacao.documento!) || transacao.documento!.includes(c.documento))
    );
    if (matchDoc) {
      return {
        transacaoId: transacao.id,
        contaId: matchDoc.id,
        tipo: matchDoc.tipo,
        descricao: matchDoc.descricao,
        valorCentavos: matchDoc.valorCentavos,
        dataVencimento: matchDoc.dataVencimento,
        score: "exato",
      };
    }
  }

  // 2. Match de valor idêntico com menor diferença de datas (até 5 dias)
  const mesmoValor = elegiveis.filter((c) => c.valorCentavos === transacao.valorCentavos);
  if (mesmoValor.length > 0) {
    // Ordena pelo mais próximo em dias
    mesmoValor.sort((a, b) => diferencaDias(a.dataVencimento, transacao.data) - diferencaDias(b.dataVencimento, transacao.data));
    const melhor = mesmoValor[0];
    const diff = diferencaDias(melhor.dataVencimento, transacao.data);

    if (diff <= 3) {
      return {
        transacaoId: transacao.id,
        contaId: melhor.id,
        tipo: melhor.tipo,
        descricao: melhor.descricao,
        valorCentavos: melhor.valorCentavos,
        dataVencimento: melhor.dataVencimento,
        score: "alto",
      };
    } else if (diff <= 10) {
      return {
        transacaoId: transacao.id,
        contaId: melhor.id,
        tipo: melhor.tipo,
        descricao: melhor.descricao,
        valorCentavos: melhor.valorCentavos,
        dataVencimento: melhor.dataVencimento,
        score: "medio",
      };
    }
  }

  return null;
}

