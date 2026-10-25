import assert from "node:assert/strict";
import test from "node:test";

import { calcularQuantitativosBIM, PROJETO_EM_BRANCO } from "../src/lib/projeto3d.utils.ts";

function criarProjeto(ativa) {
  return {
    config: { peDireito: 2.8, espessuraParedePadrao: 0.15, unidade: "m" },
    paredes: [
      { p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, altura: 2.8 },
      { p1: { x: 4, y: 0 }, p2: { x: 4, y: 3 }, altura: 2.8 },
      { p1: { x: 4, y: 3 }, p2: { x: 0, y: 3 }, altura: 2.8 },
    ],
    aberturas: [],
    ambientes: [{ area: 12, perimetro: 14 }],
    cobertura: { ativa, tipo: "colonial_duas_aguas", inclinacao: 30, beiral: 0.6 },
    layers: { telhado: true, forro: true, paredes: true, esquadrias: true, piso: true, estrutura: true },
  };
}

test("projeto novo começa sem cobertura", () => {
  assert.equal(PROJETO_EM_BRANCO.cobertura.ativa, false);
  assert.equal(calcularQuantitativosBIM(PROJETO_EM_BRANCO).areaTotalCobertura, 0);
});

test("sem cobertura não calcula área nem custo de telhado", () => {
  const resumo = calcularQuantitativosBIM(criarProjeto(false));
  const itemCobertura = resumo.itens.find((item) => item.tipoItem === "cobertura");

  assert.equal(resumo.areaTotalCobertura, 0);
  assert.equal(itemCobertura.quantidade, 0);
  assert.equal(itemCobertura.descricao, "Cobertura não prevista no projeto");
});

test("projeto antigo sem campo ativa preserva a cobertura", () => {
  const resumo = calcularQuantitativosBIM(criarProjeto(undefined));
  assert.ok(resumo.areaTotalCobertura > 0);
});


