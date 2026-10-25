import assert from "node:assert/strict";
import test from "node:test";

import {
  duplicarSelecao,
  selecionarElementosNaJanela,
  transformarSelecao,
} from "../src/lib/projeto3d-transformacoes.ts";

function projeto() {
  return {
    config: { peDireito: 2.8, espessuraParedePadrao: 0.15, unidade: "m" },
    paredes: [
      { id: "p1", p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 } },
      { id: "p2", p1: { x: 10, y: 10 }, p2: { x: 14, y: 10 } },
    ],
    aberturas: [{ id: "a1", paredeId: "p1", distanciaP1: 2 }],
    ambientes: [{ id: "amb1", pontos: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }] }],
    moveis: [{ id: "m1", x: 2, y: 2, largura: 1, comprimento: 2, rotacao: 0 }],
    cobertura: {},
    layers: {},
  };
}

test("seleção por janela diferencia conter de cruzar", () => {
  const dados = projeto();
  const contidos = selecionarElementosNaJanela(dados, { x: -1, y: -1 }, { x: 3, y: 3 }, "conter");
  const cruzados = selecionarElementosNaJanela(dados, { x: -1, y: -1 }, { x: 3, y: 3 }, "cruzar");

  assert.deepEqual(contidos, [{ tipo: "movel", id: "m1" }]);
  assert.equal(cruzados.some((item) => item.tipo === "parede" && item.id === "p1"), true);
  assert.equal(cruzados.some((item) => item.tipo === "ambiente" && item.id === "amb1"), true);
});

test("seleção considera os limites de móvel em rotação livre", () => {
  const dados = projeto();
  dados.moveis[0].rotacao = 45;

  const selecionados = selecionarElementosNaJanela(dados, { x: 0.9, y: 0.9 }, { x: 3.1, y: 3.1 }, "conter");

  assert.deepEqual(selecionados, [{ tipo: "movel", id: "m1" }]);
});

test("move e rotaciona somente os elementos selecionados com precisão", () => {
  const dados = projeto();
  const transformado = transformarSelecao(
    dados,
    [{ tipo: "parede", id: "p1" }, { tipo: "movel", id: "m1" }],
    { deslocamento: { x: 1.25, y: -0.5 }, rotacaoGraus: 90, centroRotacao: { x: 0, y: 0 } }
  );

  assert.deepEqual(transformado.paredes[0].p1, { x: 1.25, y: -0.5 });
  assert.ok(Math.abs(transformado.paredes[0].p2.x - 1.25) < 1e-12);
  assert.ok(Math.abs(transformado.paredes[0].p2.y - 3.5) < 1e-12);
  assert.deepEqual(transformado.paredes[1], dados.paredes[1]);
  assert.equal(transformado.moveis[0].rotacao, 90);
});

test("atualiza área e perímetro associativos do ambiente", () => {
  const dados = projeto();
  const transformado = transformarSelecao(
    dados,
    [{ tipo: "ambiente", id: "amb1" }],
    { deslocamento: { x: 5, y: 7 } }
  );

  assert.equal(transformado.ambientes[0].area, 6);
  assert.equal(transformado.ambientes[0].perimetro, 12);
});

test("duplicação remapeia paredes e suas aberturas", () => {
  const dados = projeto();
  const resultado = duplicarSelecao(
    dados,
    [{ tipo: "parede", id: "p1" }],
    { x: 3, y: 0 },
    (tipo, original) => `${tipo}_copia_${original}`
  );

  assert.equal(resultado.dados.paredes.length, 3);
  assert.deepEqual(resultado.dados.paredes[2].p1, { x: 3, y: 0 });
  assert.equal(resultado.dados.aberturas.length, 2);
  assert.equal(resultado.dados.aberturas[1].paredeId, "parede_copia_p1");
  assert.deepEqual(resultado.selecao, [{ tipo: "parede", id: "parede_copia_p1" }]);
});

