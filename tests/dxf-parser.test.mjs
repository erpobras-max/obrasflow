import assert from "node:assert/strict";
import test from "node:test";

import { extrairParedesDoDxf } from "../src/lib/dxf-parser.ts";

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

