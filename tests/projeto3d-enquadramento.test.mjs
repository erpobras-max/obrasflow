import assert from "node:assert/strict";
import test from "node:test";

import { calcularEnquadramentoPlanta } from "../src/lib/projeto3d.utils.ts";

test("enquadra uma planta deslocada dentro do canvas", () => {
  const dados = {
    paredes: [
      { p1: { x: 1000, y: -500 }, p2: { x: 1010, y: -500 } },
      { p1: { x: 1010, y: -500 }, p2: { x: 1010, y: -495 } },
    ],
    ambientes: [],
    moveis: [],
  };

  const resultado = calcularEnquadramentoPlanta(dados, 1000, 600);

  assert.ok(resultado);
  for (const ponto of dados.paredes.flatMap((parede) => [parede.p1, parede.p2])) {
    const telaX = ponto.x * resultado.zoom + resultado.offset.x;
    const telaY = ponto.y * resultado.zoom + resultado.offset.y;
    assert.ok(telaX >= 48 && telaX <= 952);
    assert.ok(telaY >= 48 && telaY <= 552);
  }
});

test("considera ambientes e móveis mesmo sem paredes", () => {
  const resultado = calcularEnquadramentoPlanta(
    {
      paredes: [],
      ambientes: [{ pontos: [{ x: -4, y: -3 }, { x: 4, y: 3 }] }],
      moveis: [{ x: 20, y: 10, largura: 4, comprimento: 2, rotacao: 90 }],
    },
    800,
    600
  );

  assert.ok(resultado);
  assert.ok(resultado.zoom >= 2);
  assert.ok(21 * resultado.zoom + resultado.offset.x <= 752);
});

test("não altera a vista quando não há geometria", () => {
  assert.equal(
    calcularEnquadramentoPlanta({ paredes: [], ambientes: [], moveis: [] }, 800, 600),
    null
  );
});




