import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularResultadoObra,
  classificarSaudeResultado,
  normalizarResultadoObraLinha,
} from "../src/lib/resultado-obra.ts";

const filtros = {
  obraId: "obra-1",
  regime: "competencia",
  periodo: "obra_inteira",
  dataInicio: null,
  dataFim: null,
  hoje: "2026-11-02",
};

function linha(overrides = {}) {
  return {
    obraId: "obra-1",
    obraNome: "Residencial Aurora",
    etapaId: "etapa-1",
    etapaNome: "Fundação",
    origem: "orcamento",
    origemId: "origem-1",
    origemVinculoId: null,
    descricao: "Fundação",
    dataReferencia: "2026-10-01",
    dataVencimento: null,
    valorEmAbertoCentavos: 0,
    valorOrcadoCentavos: 0,
    valorReceitaCentavos: 0,
    valorComprometidoCentavos: 0,
    valorRealizadoCentavos: 0,
    valorPagoCentavos: 0,
    avancoFisicoPercentual: null,
    legadoSemSaldo: false,
    competenciaFallback: false,
    origemUrl: null,
    ...overrides,
  };
}

test("agrega centavos exatamente e fecha o consolidado com duas etapas e Sem apropriação", () => {
  const resultado = calcularResultadoObra(
    [
      linha({ origemId: "orc-1", valorOrcadoCentavos: 10_001 }),
      linha({
        etapaId: "etapa-2",
        etapaNome: "Estrutura",
        origemId: "orc-2",
        valorOrcadoCentavos: 20_002,
      }),
      linha({
        origem: "receita",
        origemId: "rec-1",
        etapaId: null,
        etapaNome: null,
        valorReceitaCentavos: 50_007,
      }),
      linha({
        origem: "pedido",
        origemId: "ped-1",
        valorComprometidoCentavos: 4_003,
      }),
      linha({
        origem: "conta_pagar",
        origemId: "cp-1",
        etapaId: "etapa-2",
        etapaNome: "Estrutura",
        valorRealizadoCentavos: 5_005,
        valorPagoCentavos: 2_001,
      }),
      linha({
        origem: "conta_pagar",
        origemId: "cp-sem-etapa",
        etapaId: null,
        etapaNome: null,
        valorRealizadoCentavos: 1_001,
        valorPagoCentavos: 501,
      }),
    ],
    filtros,
  );

  assert.equal(resultado.bacCentavos, 30_003);
  assert.equal(resultado.receitaContratadaCentavos, 50_007);
  assert.equal(resultado.comprometidoCentavos, 4_003);
  assert.equal(resultado.realizadoCentavos, 6_006);
  assert.equal(resultado.pagoCentavos, 2_502);
  assert.equal(resultado.margemPrevistaCentavos, 20_004);
  assert.equal(resultado.etapas.length, 3);
  assert.equal(
    resultado.etapas.reduce((total, etapa) => total + etapa.realizadoCentavos, 0),
    resultado.realizadoCentavos,
  );
  assert.equal(resultado.etapas.at(-1).nome, "Sem apropriação");
});

test("mantém indicadores derivados como null quando orçamento e receita não existem", () => {
  const resultado = calcularResultadoObra(
    [linha({ origem: "conta_pagar", origemId: "cp-1", valorPagoCentavos: 100 })],
    filtros,
  );

  assert.equal(resultado.bacCentavos, null);
  assert.equal(resultado.receitaContratadaCentavos, null);
  assert.equal(resultado.margemPrevistaCentavos, null);
  assert.equal(resultado.eacPrincipalCentavos, null);
  assert.equal(resultado.desvioProjetadoPercentual, null);
});

test("deduplica conta vinculada sem perder realizado e pago", () => {
  const resultado = calcularResultadoObra(
    [
      linha({ origemId: "orc-1", valorOrcadoCentavos: 100_000 }),
      linha({
        origem: "pedido",
        origemId: "ped-1",
        valorComprometidoCentavos: 40_000,
        valorRealizadoCentavos: 10_000,
      }),
      linha({
        origem: "conta_pagar",
        origemId: "cp-1",
        origemVinculoId: "ped-1",
        valorComprometidoCentavos: 40_000,
        valorRealizadoCentavos: 10_000,
        valorPagoCentavos: 7_000,
      }),
    ],
    filtros,
  );

  assert.equal(resultado.comprometidoCentavos, 40_000);
  assert.equal(resultado.realizadoCentavos, 10_000);
  assert.equal(resultado.pagoCentavos, 7_000);
});

test("rejeita transferências internas no normalizador", () => {
  assert.equal(normalizarResultadoObraLinha(linha({ origem: "transferencia" })), null);
});

test("calcula IDC e destaca o maior EAC válido", () => {
  const resultado = calcularResultadoObra(
    [
      linha({ origemId: "orc-1", valorOrcadoCentavos: 1_000_000 }),
      linha({
        origem: "conta_pagar",
        origemId: "cp-1",
        valorRealizadoCentavos: 400_000,
      }),
      linha({
        origem: "contrato",
        origemId: "ct-1",
        valorComprometidoCentavos: 700_000,
      }),
      linha({
        origem: "avanco",
        origemId: "av-1",
        avancoFisicoPercentual: 20,
      }),
    ],
    filtros,
  );

  assert.equal(resultado.valorAgregadoCentavos, 200_000);
  assert.equal(resultado.idc, 0.5);
  assert.equal(resultado.eacContratualCentavos, 1_100_000);
  assert.equal(resultado.eacDesempenhoCentavos, 2_000_000);
  assert.equal(resultado.eacPrincipalCentavos, 2_000_000);
  assert.equal(resultado.desvioProjetadoCentavos, 1_000_000);
  assert.equal(resultado.saude, "critico");
});

test("não usa cenário de desempenho antes dos limiares mínimos", () => {
  const semAvanco = calcularResultadoObra(
    [
      linha({ origemId: "orc-1", valorOrcadoCentavos: 1_000_000 }),
      linha({ origem: "conta_pagar", origemId: "cp-1", valorRealizadoCentavos: 9_999 }),
    ],
    filtros,
  );
  const poucoAvanco = calcularResultadoObra(
    [
      linha({ origemId: "orc-1", valorOrcadoCentavos: 1_000_000 }),
      linha({ origem: "conta_pagar", origemId: "cp-1", valorRealizadoCentavos: 20_000 }),
      linha({ origem: "avanco", origemId: "av-1", avancoFisicoPercentual: 4.99 }),
    ],
    filtros,
  );

  assert.equal(semAvanco.idc, null);
  assert.equal(semAvanco.eacDesempenhoCentavos, null);
  assert.equal(poucoAvanco.idc, 2.495);
  assert.equal(poucoAvanco.eacDesempenhoCentavos, null);
});

test("classifica saúde nos limites de 5% e 10%", () => {
  assert.equal(classificarSaudeResultado(null), "sem_dados");
  assert.equal(classificarSaudeResultado(5), "saudavel");
  assert.equal(classificarSaudeResultado(5.01), "atencao");
  assert.equal(classificarSaudeResultado(10), "atencao");
  assert.equal(classificarSaudeResultado(10.01), "critico");
});

test("expõe alertas de qualidade, vencimento relevante e posição atual histórica", () => {
  const resultado = calcularResultadoObra(
    [
      linha({
        origem: "pedido",
        origemId: "legado-1",
        etapaId: null,
        etapaNome: null,
        valorComprometidoCentavos: 150_000,
        legadoSemSaldo: true,
      }),
      linha({
        origem: "conta_pagar",
        origemId: "cp-vencida",
        etapaId: null,
        etapaNome: null,
        dataVencimento: "2026-10-01",
        valorEmAbertoCentavos: 120_000,
        competenciaFallback: true,
      }),
    ],
    {
      ...filtros,
      periodo: "mes",
      dataInicio: "2026-10-01",
      dataFim: "2026-10-31",
    },
  );

  assert.equal(resultado.compromissoEhPosicaoAtual, true);
  assert.equal(resultado.qualidade.temDadosParciais, true);
  assert.equal(resultado.qualidade.quantidadeSemEtapa, 2);
  assert.equal(resultado.qualidade.quantidadeFallbackCompetencia, 1);
  assert.deepEqual(
    new Set(resultado.alertas.map((alerta) => alerta.tipo)),
    new Set([
      "sem_orcamento",
      "sem_receita",
      "legado_sem_saldo",
      "sem_apropriacao",
      "titulo_vencido",
    ]),
  );
});
