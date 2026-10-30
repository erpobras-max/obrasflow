import * as XLSX from "xlsx";
import type { ContratoItem } from "./contratos-empreiteiros.schema";

export interface ItemImportadoOrcamento {
  origemId: string;
  origemTipo: "orcamento_analitico" | "escopo_obra" | "orcamento_legado";
  codigo: string | null;
  descricao: string;
  unidade: string;
  etapa: string;
  quantidade: number;
  custoUnitarioCentavos: number;
  precoUnitarioCentavos: number;
}

/**
 * Converte número em formato brasileiro (ex: "1.250,50" ou 1250.5) para centavos inteiros.
 */
export function converterParaCentavos(valor: unknown): number {
  if (typeof valor === "number") {
    if (isNaN(valor)) return 0;
    return Math.round(valor * 100);
  }
  if (typeof valor !== "string") return 0;

  const limpo = valor.trim().replace(/^R\$\s*/i, "");
  if (!limpo) return 0;

  // Se tiver vírgula como decimal (ex: 1.250,50)
  if (limpo.includes(",")) {
    const semMilhar = limpo.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(semMilhar);
    return isNaN(num) ? 0 : Math.round(num * 100);
  }

  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

/**
 * Converte número com decimais brasileiros para float com escala
 */
export function converterParaQuantidade(valor: unknown): number {
  if (typeof valor === "number") {
    if (isNaN(valor)) return 0;
    return valor;
  }
  if (typeof valor !== "string") return 0;

  const limpo = valor.trim();
  if (!limpo) return 0;

  if (limpo.includes(",")) {
    const semMilhar = limpo.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(semMilhar);
    return isNaN(num) ? 0 : num;
  }

  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

/**
 * Mapeia atividades da árvore do orçamento analítico para itens de contrato de empreiteiro.
 */
export function mapearAtividadesParaItensContrato(
  atividades: Array<{
    id: string;
    codigo: string | null;
    descricao: string;
    unidade: string;
    quantidade: number;
    etapaNome?: string;
    orcamentoId?: string;
    insumos?: Array<{ coeficiente: number; preco_unitario_centavos: number }>;
    custoTotalCentavos?: number;
    bdiPercentual?: number;
  }>,
  bdiPadrao: number = 0
): ContratoItem[] {
  return atividades.map((atv, idx) => {
    let custoUnitCentavos = 0;
    if (atv.insumos && atv.insumos.length > 0) {
      custoUnitCentavos = atv.insumos.reduce(
        (acc, ins) =>
          acc + Math.round(Number(ins.coeficiente ?? 1) * Number(ins.preco_unitario_centavos ?? 0)),
        0
      );
    } else if (atv.custoTotalCentavos && atv.quantidade > 0) {
      custoUnitCentavos = Math.round(atv.custoTotalCentavos / atv.quantidade);
    }

    const bdi = atv.bdiPercentual != null ? atv.bdiPercentual : bdiPadrao;
    const precoUnitCentavos = Math.round(custoUnitCentavos * (1 + bdi / 100));

    return {
      codigo: atv.codigo || null,
      descricao: atv.descricao,
      unidade: atv.unidade || "un",
      etapa: atv.etapaNome || "Geral",
      quantidadeContratada: Number(atv.quantidade ?? 1),
      precoUnitarioCentavos: precoUnitCentavos,
      origemOrcamentoId: atv.orcamentoId || null,
      origemAtividadeId: atv.id,
      origemTipo: "orcamento_analitico",
      ordem: idx,
    };
  });
}

/**
 * Lê e valida um arquivo Excel (.xlsx ou .csv) contendo itens para o contrato.
 */
export function processarPlanilhaExcelContrato(bufferOuArray: ArrayBuffer | Uint8Array): {
  sucesso: boolean;
  itens: ContratoItem[];
  erros: string[];
} {
  try {
    const workbook = XLSX.read(bufferOuArray, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { sucesso: false, itens: [], erros: ["O arquivo Excel está vazio."] };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    if (!rows || rows.length === 0) {
      return { sucesso: false, itens: [], erros: ["Nenhuma linha de dados encontrada na primeira aba."] };
    }

    const itens: ContratoItem[] = [];
    const erros: string[] = [];

    // Localizar nomes das colunas de forma flexível (case-insensitive)
    rows.forEach((row, idx) => {
      const keys = Object.keys(row);
      const findKey = (patterns: string[]) =>
        keys.find((k) => patterns.some((p) => k.toLowerCase().includes(p)));

      const descKey = findKey(["descri", "serviço", "servico", "item", "nome"]);
      const unidKey = findKey(["unid", "un"]);
      const qtdKey = findKey(["quant", "qtd", "qnt"]);
      const precoKey = findKey(["preço", "preco", "unit", "valor"]);
      const codKey = findKey(["código", "codigo", "cod"]);
      const etapaKey = findKey(["etapa", "fase", "grupo"]);

      const descricao = String(descKey ? row[descKey] : "").trim();
      if (!descricao) {
        // Linha em branco ou cabeçalho intermediário
        return;
      }

      const unidade = String(unidKey ? row[unidKey] : "un").trim() || "un";
      const quantidade = qtdKey ? converterParaQuantidade(row[qtdKey]) : 1;
      const precoUnitarioCentavos = precoKey ? converterParaCentavos(row[precoKey]) : 0;
      const codigo = codKey ? String(row[codKey]).trim() || null : null;
      const etapa = etapaKey ? String(row[etapaKey]).trim() || "Geral" : "Geral";

      if (quantidade <= 0) {
        erros.push(`Linha ${idx + 2} (${descricao}): Quantidade deve ser maior que zero.`);
        return;
      }

      itens.push({
        codigo,
        descricao,
        unidade,
        etapa,
        quantidadeContratada: quantidade,
        precoUnitarioCentavos,
        origemTipo: "excel",
        ordem: itens.length,
      });
    });

    if (itens.length === 0) {
      erros.push("Nenhum item válido pôde ser importado. Verifique se as colunas 'Descrição', 'Unidade', 'Quantidade' e 'Preço Unitário' existem.");
      return { sucesso: false, itens: [], erros };
    }

    return {
      sucesso: erros.length === 0,
      itens,
      erros,
    };
  } catch (err: any) {
    return {
      sucesso: false,
      itens: [],
      erros: [`Erro ao processar planilha: ${err.message}`],
    };
  }
}

