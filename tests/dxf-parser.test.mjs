import assert from "node:assert/strict";
import test from "node:test";

import { exportarParaDxf, extrairParedesDoDxf, importarDxf } from "../src/lib/dxf-parser.ts";

function entidade(tipo, pares) {
  return ["0", tipo, ...pares.flatMap(([codigo, valor]) => [String(codigo), String(valor)])];
}

test("importa somente entidades do desenho e calcula escala pelos limites", () => {
  const dxf = [
    "0", "SECTION", "2", "BLOCKS",
    ...entidade("LINE", [[10, 0], [20, 0], [11, 99999], [21, 0]]),
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entidade("LINE", [[10, 3000], [20, 1000], [11, 3500], [21, 1000]]),
    ...entidade("LINE", [[10, 3000], [20, 1000], [11, 3000], [21, 1000.1]]),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");

  const paredes = extrairParedesDoDxf(dxf);

  assert.equal(paredes.length, 1);
  assert.deepEqual(paredes[0].p1, { x: 0, y: 0 });
  assert.deepEqual(paredes[0].p2, { x: 5, y: 0 });
});

test("respeita unidade declarada e preserva layers", () => {
  const dxf = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entidade("LINE", [[8, "ALVENARIA"], [10, 1000], [20, 2000], [11, 5000], [21, 2000]]),
    ...entidade("INSERT", [[8, "MOBILIARIO"], [2, "MESA"]]),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");

  const resultado = importarDxf(dxf);

  assert.equal(resultado.paredes.length, 1);
  assert.equal(resultado.paredes[0].layer, "ALVENARIA");
  assert.equal(resultado.paredes[0].p2.x, 4);
  assert.equal(resultado.resumo.unidade, "milimetros");
  assert.equal(resultado.resumo.entidadesIgnoradas, 1);
  assert.deepEqual(resultado.resumo.layers, ["ALVENARIA"]);
});

test("converte ARC em segmentos com comprimento aproximado", () => {
  const dxf = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entidade("ARC", [[8, "CURVAS"], [10, 0], [20, 0], [40, 2], [50, 0], [51, 90]]),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");

  const resultado = importarDxf(dxf);
  const comprimento = resultado.paredes.reduce(
    (total, parede) => total + Math.hypot(parede.p2.x - parede.p1.x, parede.p2.y - parede.p1.y),
    0
  );

  assert.equal(resultado.paredes.length, 9);
  assert.ok(Math.abs(comprimento - Math.PI) < 0.05);
  assert.equal(resultado.paredes.every((parede) => parede.layer === "CURVAS"), true);
});

test("converte bulge de LWPOLYLINE em arco", () => {
  const dxf = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "6", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    ...entidade("LWPOLYLINE", [[8, "ARCOS"], [70, 0], [10, 0], [20, 0], [42, 1], [10, 2], [20, 0]]),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");

  const resultado = importarDxf(dxf);
  const comprimento = resultado.paredes.reduce(
    (total, parede) => total + Math.hypot(parede.p2.x - parede.p1.x, parede.p2.y - parede.p1.y),
    0
  );

  assert.equal(resultado.paredes.length, 18);
  assert.ok(Math.abs(comprimento - Math.PI) < 0.05);
});

test("exporta metros e layers em round-trip", () => {
  const dxf = exportarParaDxf({
    paredes: [
      {
        id: "p1",
        p1: { x: 10, y: 20 },
        p2: { x: 14, y: 20 },
        espessura: 0.15,
        altura: 2.8,
        tipo: "alvenaria_vedacao",
        layer: "PAREDES EXTERNAS",
      },
    ],
  });
  const resultado = importarDxf(dxf);

  assert.equal(resultado.resumo.unidade, "metros");
  assert.equal(resultado.paredes[0].layer, "PAREDES EXTERNAS");
  assert.equal(Math.hypot(
    resultado.paredes[0].p2.x - resultado.paredes[0].p1.x,
    resultado.paredes[0].p2.y - resultado.paredes[0].p1.y
  ), 4);
});


