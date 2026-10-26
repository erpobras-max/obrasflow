import test from "node:test";
import assert from "node:assert/strict";
import {
  formatarDataRdo,
  gerarCodigoRdo,
  calcularTotalEfetivo,
  formatarEnderecoObra,
  obterClimaDetalhado,
} from "../src/lib/rdo-pdf.utils.ts";

test("formatarDataRdo formata data por extenso e dia da semana corretamente", () => {
  const res = formatarDataRdo("2026-10-26");
  assert.equal(res.dataFormatada, "26/10/2026");
  assert.equal(res.diaSemana, "Segunda-feira");
  assert.equal(res.dataCompletaExtenso, "Segunda-feira, 26 de Outubro de 2026");
});

test("formatarDataRdo trata entradas vazias sem quebrar", () => {
  const res = formatarDataRdo("");
  assert.equal(res.dataFormatada, "—");
  assert.equal(res.diaSemana, "—");
});

test("gerarCodigoRdo gera identificador padronizado para o RDO", () => {
  const cod = gerarCodigoRdo("OB-102", "2026-10-26");
  assert.equal(cod, "RDO-OB-102-20261026");
});

test("calcularTotalEfetivo soma as quantidades de trabalhadores", () => {
  const efetivo = [
    { funcao: "Engenheiro Residente", quantidade: 1 },
    { funcao: "Pedreiro", quantidade: 4 },
    { funcao: "Servente", quantidade: 6 },
    { funcao: "Eletricista", quantidade: 2 },
  ];
  assert.equal(calcularTotalEfetivo(efetivo), 13);
  assert.equal(calcularTotalEfetivo([]), 0);
  assert.equal(calcularTotalEfetivo(null), 0);
});

test("formatarEnderecoObra une partes do logradouro, bairro, cidade e UF", () => {
  const end = formatarEnderecoObra({
    logradouro: "Av. Paulista",
    numero_endereco: "1000",
    complemento: "Torre A",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    uf: "SP",
  });
  assert.equal(end, "Av. Paulista, 1000 - Torre A, Bela Vista, São Paulo/SP");
});

test("obterClimaDetalhado retorna rótulos e condições de trabalho coerentes", () => {
  const chuva = obterClimaDetalhado("chuva_forte", 19.5);
  assert.equal(chuva.label, "Chuva Forte / Temporal");
  assert.equal(chuva.condicaoTrabalho, "Impraticável / Reduzido");
  assert.equal(chuva.temperaturaTexto, "19.5°C");

  const sol = obterClimaDetalhado("claro", 28);
  assert.equal(sol.label, "Ensolarado / Céu Aberto");
  assert.equal(sol.condicaoTrabalho, "Normal (Sem impedimentos)");
  assert.equal(sol.temperaturaTexto, "28°C");
});
