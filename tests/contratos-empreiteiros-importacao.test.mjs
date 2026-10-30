import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  converterParaCentavos,
  converterParaQuantidade,
  mapearAtividadesParaItensContrato,
  processarPlanilhaExcelContrato,
} from "../src/lib/contratos-empreiteiros-importacao.ts";

test("converterParaCentavos: converte formatos numéricos e strings BRL", () => {
  assert.equal(converterParaCentavos(150.5), 15050);
  assert.equal(converterParaCentavos("R$ 1.250,50"), 125050);
  assert.equal(converterParaCentavos("99,90"), 9990);
  assert.equal(converterParaCentavos("100"), 10000);
  assert.equal(converterParaCentavos(""), 0);
  assert.equal(converterParaCentavos(null), 0);
});

test("converterParaQuantidade: converte decimais com vírgula e inteiros", () => {
  assert.equal(converterParaQuantidade(45.25), 45.25);
  assert.equal(converterParaQuantidade("1.250,5"), 1250.5);
  assert.equal(converterParaQuantidade("10,75"), 10.75);
  assert.equal(converterParaQuantidade("0"), 0);
});

test("mapearAtividadesParaItensContrato: calcula custo unitário e BDI", () => {
  const mockAtividades = [
    {
      id: "atv-1",
      codigo: "01.01",
      descricao: "Alvenaria de vedação 14x19x29",
      unidade: "m2",
      quantidade: 100,
      etapaNome: "Estrutura",
      orcamentoId: "orc-1",
      insumos: [
        { coeficiente: 1, preco_unitario_centavos: 3500 }, // R$ 35,00
        { coeficiente: 0.5, preco_unitario_centavos: 1000 }, // R$ 5,00
      ],
      bdiPercentual: 20, // +20% -> 4000 * 1.2 = 4800 (R$ 48,00)
    },
  ];

  const itens = mapearAtividadesParaItensContrato(mockAtividades, 0);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].descricao, "Alvenaria de vedação 14x19x29");
  assert.equal(itens[0].quantidadeContratada, 100);
  assert.equal(itens[0].precoUnitarioCentavos, 4800);
  assert.equal(itens[0].origemTipo, "orcamento_analitico");
  assert.equal(itens[0].origemAtividadeId, "atv-1");
});

test("processarPlanilhaExcelContrato: processa buffer XLSX com colunas reconhecidas", () => {
  const dados = [
    {
      "Descrição do Serviço": "Instalação Elétrica - Ponto de Tomada",
      Unidade: "pt",
      Quantidade: "50",
      "Preço Unitário": "R$ 45,00",
      Etapa: "Instalações",
    },
    {
      "Descrição do Serviço": "Pintura Látex PVA 2 demãos",
      Unidade: "m2",
      Quantidade: "120,5",
      "Preço Unitário": "25,50",
      Etapa: "Pintura",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contrato");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const resultado = processarPlanilhaExcelContrato(buffer);
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.itens.length, 2);
  assert.equal(resultado.itens[0].descricao, "Instalação Elétrica - Ponto de Tomada");
  assert.equal(resultado.itens[0].quantidadeContratada, 50);
  assert.equal(resultado.itens[0].precoUnitarioCentavos, 4500);
  assert.equal(resultado.itens[1].quantidadeContratada, 120.5);
  assert.equal(resultado.itens[1].precoUnitarioCentavos, 2550);
  assert.equal(resultado.itens[1].etapa, "Pintura");
});

