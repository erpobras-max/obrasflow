import test from "node:test";
import assert from "node:assert/strict";
import { valorPorExtenso } from "../src/lib/extenso.ts";

test("valorPorExtenso: valores básicos e zero", () => {
  assert.equal(valorPorExtenso(0), "zero reais");
  assert.equal(valorPorExtenso(1), "um real");
  assert.equal(valorPorExtenso(2), "dois reais");
  assert.equal(valorPorExtenso(10), "dez reais");
  assert.equal(valorPorExtenso(100), "cem reais");
  assert.equal(valorPorExtenso(105), "cento e cinco reais");
  assert.equal(valorPorExtenso(320), "trezentos e vinte reais");
});

test("valorPorExtenso: centavos isolados e combinados", () => {
  assert.equal(valorPorExtenso(0.01), "um centavo");
  assert.equal(valorPorExtenso(0.05), "cinco centavos");
  assert.equal(valorPorExtenso(0.50), "cinquenta centavos");
  assert.equal(valorPorExtenso(1.01), "um real e um centavo");
  assert.equal(valorPorExtenso(1.50), "um real e cinquenta centavos");
  assert.equal(valorPorExtenso(2.25), "dois reais e vinte e cinco centavos");
});

test("valorPorExtenso: milhares e valores da construção civil", () => {
  assert.equal(valorPorExtenso(1000), "um mil reais");
  assert.equal(valorPorExtenso(1250.50), "um mil, duzentos e cinquenta reais e cinquenta centavos");
  assert.equal(valorPorExtenso(15420.00), "quinze mil, quatrocentos e vinte reais");
  assert.equal(valorPorExtenso(100000), "cem mil reais");
  assert.equal(valorPorExtenso(1000000), "um milhão de reais");
  assert.equal(valorPorExtenso(2500000), "dois milhões e quinhentos mil reais");
});

test("valorPorExtenso: aceita entrada direta em centavos", () => {
  assert.equal(valorPorExtenso(100, true), "um real");
  assert.equal(valorPorExtenso(150, true), "um real e cinquenta centavos");
  assert.equal(valorPorExtenso(250000, true), "dois mil e quinhentos reais");
});

test("valorPorExtenso: valores negativos e pontuais", () => {
  assert.equal(valorPorExtenso(-50), "menos cinquenta reais");
  assert.equal(valorPorExtenso(-1.50), "menos um real e cinquenta centavos");
  assert.equal(valorPorExtenso(300), "trezentos reais");
  assert.equal(valorPorExtenso(500000), "quinhentos mil reais");
});
