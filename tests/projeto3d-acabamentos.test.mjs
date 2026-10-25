import assert from "node:assert/strict";
import test from "node:test";

import { calcularQuantitativosBIM } from "../src/lib/projeto3d.utils.ts";

test("leva acabamentos personalizados para os quantitativos sem misturar ambientes", () => {
  const dados = {
    config: { peDireito: 2.8, espessuraParedePadrao: 0.15, unidade: "m" },
    paredes: [
      { p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, altura: 2.8, acabamento: "Tinta mineral azul" },
      { p1: { x: 4, y: 0 }, p2: { x: 4, y: 3 }, altura: 2.8 },
      { p1: { x: 4, y: 3 }, p2: { x: 0, y: 3 }, altura: 2.8 },
    ],
    aberturas: [],
    ambientes: [
      {
        area: 12,
        perimetro: 14,
        pisoAcabamento: "Granilite personalizado",
        paredeAcabamento: "Pintura acetinada bege",
      },
      {
        area: 6,
        perimetro: 10,
        pisoAcabamento: "Madeira natural",
        paredeAcabamento: "Pintura acetinada bege",
      },
    ],
    cobertura: { tipo: "colonial_duas_aguas", inclinacao: 30, beiral: 0.6 },
    layers: { telhado: true, forro: true, paredes: true, esquadrias: true, piso: true, estrutura: true },
  };

  const resumo = calcularQuantitativosBIM(dados);
  const piso = resumo.itens.find((item) => item.tipoItem === "piso" && item.id === "item_piso");
  const pintura = resumo.itens.find((item) => item.tipoItem === "pintura");

  assert.match(piso.descricao, /Granilite personalizado/);
  assert.match(piso.descricao, /Madeira natural/);
  assert.match(pintura.descricao, /Pintura acetinada bege/);
  assert.match(pintura.descricao, /Tinta mineral azul/);
  assert.equal(pintura.descricao.match(/Pintura acetinada bege/g).length, 1);
});

