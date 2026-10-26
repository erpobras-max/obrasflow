import assert from "node:assert/strict";
import test from "node:test";

import { calcularCotaLinear, encontrarCotaLinearProxima } from "../src/lib/projeto3d-cotas.ts";

function projeto() {
  return {
    paredes: [
      { id: "p1", p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 } },
      { id: "p2", p1: { x: 0, y: 3 }, p2: { x: 4, y: 3 } },
    ],
  };
}

test("cota vinculada acompanha os pontos da parede", () => {
  const cota = {
    id: "c1",
    inicio: { tipo: "parede", paredeId: "p1", ponto: "p1", fallback: { x: 0, y: 0 } },
    fim: { tipo: "parede", paredeId: "p1", ponto: "p2", fallback: { x: 4, y: 0 } },
  };

  assert.equal(calcularCotaLinear(projeto(), cota).distancia, 4);

  const movido = projeto();
  movido.paredes[0].p2 = { x: 6, y: 0 };
  assert.equal(calcularCotaLinear(movido, cota).distancia, 6);
});

test("cota preserva a última posição quando a referência não existe", () => {
  const cota = {
    id: "c2",
    inicio: { tipo: "livre", ponto: { x: 1, y: 1 } },
    fim: { tipo: "parede", paredeId: "ausente", ponto: "p2", fallback: { x: 4, y: 5 } },
  };

  assert.deepEqual(calcularCotaLinear(projeto(), cota), {
    inicio: { x: 1, y: 1 },
    fim: { x: 4, y: 5 },
    distancia: 5,
  });
});

test("localiza somente cota próxima do ponto informado", () => {
  const cota = {
    id: "c3",
    inicio: { tipo: "livre", ponto: { x: 0, y: 0 } },
    fim: { tipo: "livre", ponto: { x: 4, y: 0 } },
  };

  assert.equal(encontrarCotaLinearProxima(projeto(), [cota], { x: 2, y: 0.1 }, 0.2)?.id, "c3");
  assert.equal(encontrarCotaLinearProxima(projeto(), [cota], { x: 2, y: 0.3 }, 0.2), null);
});
