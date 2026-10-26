import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMADA_CAD_PADRAO_ID,
  aplicarCamadaNaSelecao,
  atualizarCamadaCad,
  criarCamadaCad,
  elementoCadVisivel,
  filtrarSelecaoEditavel,
  listarCamadasCad,
  obterCamadaId,
  removerCamadaCad,
  renomearCamadaCad,
} from "../src/lib/projeto3d-camadas.ts";

function projeto() {
  return {
    config: { peDireito: 2.8, espessuraParedePadrao: 0.15, unidade: "m" },
    paredes: [
      {
        id: "p1",
        p1: { x: 0, y: 0 },
        p2: { x: 4, y: 0 },
        espessura: 0.15,
        altura: 2.8,
        tipo: "interna",
        layer: "ALVENARIA",
      },
    ],
    aberturas: [],
    ambientes: [
      { id: "a1", nome: "Sala", pontos: [], area: 0, perimetro: 0 },
    ],
    moveis: [
      {
        id: "m1",
        tipo: "sofa",
        nome: "Sofá",
        x: 1,
        y: 1,
        largura: 2.2,
        comprimento: 0.9,
        altura: 0.85,
        rotacao: 0,
      },
    ],
    cobertura: { tipo: "uma_agua", inclinacao: 10, beiral: 0.5 },
    layers: {
      telhado: true,
      forro: true,
      paredes: true,
      esquadrias: true,
      piso: true,
      estrutura: true,
      moveis: true,
    },
  };
}

test("converte layers legados do DXF em camadas CAD editáveis", () => {
  const dados = projeto();

  assert.equal(obterCamadaId(dados.paredes[0]), "dxf:ALVENARIA");
  assert.equal(listarCamadasCad(dados).some((camada) => camada.nome === "ALVENARIA"), true);
});

test("cria, associa e renomeia uma camada na seleção", () => {
  let dados = criarCamadaCad(projeto(), "acabamento", "Acabamento");
  dados = aplicarCamadaNaSelecao(
    dados,
    [
      { tipo: "parede", id: "p1" },
      { tipo: "ambiente", id: "a1" },
      { tipo: "movel", id: "m1" },
    ],
    "acabamento"
  );
  dados = renomearCamadaCad(dados, "acabamento", "Interiores");

  assert.equal(dados.paredes[0].camadaId, "acabamento");
  assert.equal(dados.paredes[0].layer, "Interiores");
  assert.equal(dados.ambientes[0].camadaId, "acabamento");
  assert.equal(dados.moveis[0].camadaId, "acabamento");
});

test("camada oculta ou bloqueada impede edição de seus elementos", () => {
  const selecao = [{ tipo: "parede", id: "p1" }];
  let dados = atualizarCamadaCad(projeto(), "dxf:ALVENARIA", { visivel: false });

  assert.equal(elementoCadVisivel(dados, dados.paredes[0]), false);
  assert.deepEqual(filtrarSelecaoEditavel(dados, selecao), []);

  dados = atualizarCamadaCad(dados, "dxf:ALVENARIA", { visivel: true, bloqueada: true });
  assert.equal(elementoCadVisivel(dados, dados.paredes[0]), true);
  assert.deepEqual(filtrarSelecaoEditavel(dados, selecao), []);
});

test("excluir camada preserva os elementos movendo-os para Geral", () => {
  let dados = criarCamadaCad(projeto(), "acabamento", "Acabamento");
  dados = aplicarCamadaNaSelecao(dados, [{ tipo: "parede", id: "p1" }], "acabamento");
  dados.cotas = [
    {
      id: "c1",
      inicio: { tipo: "livre", ponto: { x: 0, y: 0 } },
      fim: { tipo: "livre", ponto: { x: 1, y: 0 } },
      camadaId: "acabamento",
    },
  ];
  dados = removerCamadaCad(dados, "acabamento");

  assert.equal(obterCamadaId(dados.paredes[0]), CAMADA_CAD_PADRAO_ID);
  assert.equal(obterCamadaId(dados.cotas[0]), CAMADA_CAD_PADRAO_ID);
  assert.equal(dados.paredes[0].layer, undefined);
  assert.equal(listarCamadasCad(dados).some((camada) => camada.id === "acabamento"), false);
});
