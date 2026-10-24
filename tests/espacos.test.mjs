import test from "node:test";
import assert from "node:assert/strict";
import { calcularValorReserva, combinarComodidades } from "../src/lib/espacos.ts";

test("calcula a locação por horas iniciadas", () => {
  const inicio = new Date("2026-10-24T12:00:00Z");
  assert.equal(calcularValorReserva(80, inicio, new Date("2026-10-24T13:00:00Z")), 80);
  assert.equal(calcularValorReserva(80, inicio, new Date("2026-10-24T13:01:00Z")), 160);
  assert.equal(calcularValorReserva(80, inicio, inicio), 0);
});

test("combina comodidades prontas e manuais sem duplicar", () => {
  assert.deepEqual(combinarComodidades(["Wi-Fi", "TV"], "Café, Wi-Fi,  "), [
    "Wi-Fi",
    "TV",
    "Café",
  ]);
});
