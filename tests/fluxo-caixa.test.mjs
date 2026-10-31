import test from "node:test";
import assert from "node:assert/strict";
import {
  gerarSlotsPeriodos,
  calcularFluxoCaixa,
  formatarDataYMD,
  parseDataYMD,
} from "../src/lib/fluxo-caixa.ts";

test("gerarSlotsPeriodos: gera 30 slots diários contínuos", () => {
  const slots = gerarSlotsPeriodos("diario", "2026-11-01", 30);
  assert.equal(slots.length, 30);
  assert.equal(slots[0].chave, "2026-11-01");
  assert.equal(slots[29].chave, "2026-11-30");
  assert.match(slots[0].label, /01\/11/);
});

test("gerarSlotsPeriodos: gera slots semanais a partir de segunda-feira", () => {
  const slots = gerarSlotsPeriodos("semanal", "2026-11-04", 30, 4);
  assert.equal(slots.length, 4);
  assert.match(slots[0].chave, /^SEM-/);
  assert.match(slots[0].label, /Semana 1/);
});

test("gerarSlotsPeriodos: gera slots mensais", () => {
  const slots = gerarSlotsPeriodos("mensal", "2026-11-01", 0, 0, 1, 2);
  assert.equal(slots.length, 4); // -1, 0, +1, +2
  assert.equal(slots[0].chave, "2026-10");
  assert.equal(slots[1].chave, "2026-11");
  assert.equal(slots[2].chave, "2026-12");
  assert.equal(slots[3].chave, "2027-01");
});

test("calcularFluxoCaixa: projeta saldo diário acumulado e detecta saldo negativo", () => {
  const contas = [
    {
      id: "cr-1",
      tipo: "receber",
      descricao: "Medição Cliente 1",
      valor_total_centavos: 1000000, // R$ 10.000,00
      data_vencimento: "2026-11-02",
      status: "pendente",
    },
    {
      id: "cp-1",
      tipo: "pagar",
      descricao: "Fornecedor Concreto",
      valor_total_centavos: 1500000, // R$ 15.000,00
      data_vencimento: "2026-11-03",
      status: "pendente",
    },
    {
      id: "cp-cancelada",
      tipo: "pagar",
      descricao: "Cancelada",
      valor_total_centavos: 9999999,
      data_vencimento: "2026-11-02",
      status: "cancelada",
    },
  ];

  // Saldo inicial de R$ 2.000,00 (200.000 centavos)
  const resumo = calcularFluxoCaixa(contas, 200000, {
    granularidade: "diario",
    dataReferencia: "2026-11-01",
    diasProjecao: 5,
  });

  assert.equal(resumo.saldoInicialCentavos, 200000);
  assert.equal(resumo.totalEntradasCentavos, 1000000);
  assert.equal(resumo.totalSaidasCentavos, 1500000);
  assert.equal(resumo.resultadoPeriodoCentavos, -500000);
  assert.equal(resumo.saldoFinalProjetadoCentavos, -300000); // 2.000 + 10.000 - 15.000 = -3.000

  // Dia 2026-11-01: saldo inicial 2.000, sem movimentação, saldo final 2.000
  const dia1 = resumo.periodos.find((p) => p.chave === "2026-11-01");
  assert.equal(dia1.saldoFinalCentavos, 200000);
  assert.equal(dia1.saldoNegativo, false);

  // Dia 2026-11-02: entra 10.000, saldo final 12.000
  const dia2 = resumo.periodos.find((p) => p.chave === "2026-11-02");
  assert.equal(dia2.entradasPrevistasCentavos, 1000000);
  assert.equal(dia2.saldoFinalCentavos, 1200000);
  assert.equal(dia2.saldoNegativo, false);

  // Dia 2026-11-03: sai 15.000, saldo final -3.000 (negativo!)
  const dia3 = resumo.periodos.find((p) => p.chave === "2026-11-03");
  assert.equal(dia3.saidasPrevistasCentavos, 1500000);
  assert.equal(dia3.saldoFinalCentavos, -300000);
  assert.equal(dia3.saldoNegativo, true);

  assert.equal(resumo.menorSaldoProjetadoCentavos, -300000);
  assert.equal(resumo.dataMenorSaldo, dia3.label);
});

test("calcularFluxoCaixa: filtra estritamente por Obra", () => {
  const contas = [
    {
      id: "cr-obra-A",
      tipo: "receber",
      descricao: "Entrada Obra A",
      obra_id: "obra-A",
      valor_total_centavos: 500000,
      data_vencimento: "2026-11-05",
      status: "pendente",
    },
    {
      id: "cr-obra-B",
      tipo: "receber",
      descricao: "Entrada Obra B",
      obra_id: "obra-B",
      valor_total_centavos: 800000,
      data_vencimento: "2026-11-05",
      status: "pendente",
    },
  ];

  const resumoObraA = calcularFluxoCaixa(contas, 0, {
    granularidade: "diario",
    obraId: "obra-A",
    dataReferencia: "2026-11-01",
    diasProjecao: 10,
  });

  assert.equal(resumoObraA.totalEntradasCentavos, 500000);

  const resumoTodas = calcularFluxoCaixa(contas, 0, {
    granularidade: "diario",
    obraId: "todas",
    dataReferencia: "2026-11-01",
    diasProjecao: 10,
  });

  assert.equal(resumoTodas.totalEntradasCentavos, 1300000);
});

test("calcularFluxoCaixa: respeita liquidações realizadas na data efetiva", () => {
  const contas = [
    {
      id: "cr-paga",
      tipo: "receber",
      descricao: "Quitada antecipada",
      valor_total_centavos: 500000,
      valor_liquidado_centavos: 480000, // com desconto
      data_vencimento: "2026-11-15",
      data_liquidacao: "2026-11-02",
      status: "recebida",
    },
  ];

  const resumo = calcularFluxoCaixa(contas, 0, {
    granularidade: "diario",
    dataReferencia: "2026-11-01",
    diasProjecao: 10,
  });

  const dia2 = resumo.periodos.find((p) => p.chave === "2026-11-02");
  assert.equal(dia2.entradasRealizadasCentavos, 480000);
  assert.equal(dia2.entradasPrevistasCentavos, 0);

  const dia15 = resumo.periodos.find((p) => p.chave === "2026-11-15");
  assert.equal(dia15, undefined); // fora dos 10 dias
});
