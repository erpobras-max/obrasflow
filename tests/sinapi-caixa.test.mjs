import test from "node:test";
import assert from "node:assert/strict";
import { SINAPI_GRUPOS } from "../src/lib/sinapi-grupos.ts";

test("SINAPI_GRUPOS contém lista oficial de grupos e cadernos técnicos", () => {
  assert.ok(Array.isArray(SINAPI_GRUPOS), "SINAPI_GRUPOS deve ser um array");
  assert.ok(
    SINAPI_GRUPOS.length >= 170,
    `Esperado pelo menos 170 grupos, obtido ${SINAPI_GRUPOS.length}`,
  );

  // Verificar grupos clássicos do SINAPI
  const acessibilidade = SINAPI_GRUPOS.find((g) => g.g.toLowerCase().includes("acessibilidade"));
  assert.ok(acessibilidade, "Grupo Acessibilidade deve existir");
  assert.ok(
    acessibilidade.l.startsWith("https://www.caixa.gov.br"),
    "Link do caderno técnico deve apontar para Caixa",
  );

  const alvenaria = SINAPI_GRUPOS.find((g) => g.g.toLowerCase().includes("alvenaria"));
  assert.ok(alvenaria, "Grupo Alvenaria deve existir");
});

test("Prefixos de código Caixa (1 para insumo, 2 para composição) são identificados corretamente", () => {
  function inferirTipoECodigo(codigoCompleto) {
    const str = String(codigoCompleto);
    const tipo = str.startsWith("1") ? "I" : str.startsWith("2") ? "C" : "?";
    const codigoBase = str.substring(1);
    return { tipo, codigoBase };
  }

  // Exemplo da tela da Caixa:
  // 104658 -> Composição 2104658
  const comp = inferirTipoECodigo(2104658);
  assert.equal(comp.tipo, "C");
  assert.equal(comp.codigoBase, "104658");

  // Insumo 1379 -> 11379 ou 10001379
  const ins = inferirTipoECodigo(10001379);
  assert.equal(ins.tipo, "I");
  assert.equal(ins.codigoBase, "0001379");
});

test("Algoritmo de busca por palavras-chave com acentos e caixa alta/baixa", () => {
  function normalizar(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function matchBusca(descricao, termoBusca) {
    const palavras = normalizar(termoBusca).split(/\s+/).filter(Boolean);
    const alvo = normalizar(descricao);
    return palavras.every((p) => alvo.includes(p));
  }

  const descricaoReal =
    "RAMPA DE ACESSIBILIDADE PARA ACESSO A EDIFICAÇÕES COM INCLINAÇÃO DE 8,33% EM CONCRETO";

  assert.ok(
    matchBusca(descricaoReal, "rampa acessibilidade"),
    "Deve encontrar rampa acessibilidade",
  );
  assert.ok(matchBusca(descricaoReal, "RAMPA 8,33%"), "Deve encontrar mesmo com pontuação");
  assert.ok(
    matchBusca(descricaoReal, "concreto acessibilidade"),
    "Ordem diferente de palavras deve funcionar",
  );
  assert.equal(
    matchBusca(descricaoReal, "telha ceramica"),
    false,
    "Não deve encontrar termo inexistente",
  );
});

test("Cálculo de custos em composições analíticas (coeficiente x valor unitário)", () => {
  const itemAnalitico = {
    c: 289633, // composição pai
    i: 288267, // item filho
    cf: 0.2757, // coeficiente
    precoUnitario: 100.5,
  };

  const custoTotal = Number((itemAnalitico.cf * itemAnalitico.precoUnitario).toFixed(4));
  assert.equal(custoTotal, 27.7079);
});
