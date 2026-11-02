import test from "node:test";
import assert from "node:assert/strict";
import {
  ACOES_RESULTADO_OBRA,
  criarKpisResultadoObra,
  filtrarAlertasAcionaveis,
  formatarCentavosResultado,
  obterEstadoCockpitResultado,
  rotuloEtapaResultado,
} from "../src/lib/resultado-obra-apresentacao.ts";

const resumoBase = {
  obraId: "obra-1",
  obraNome: "Obra Aurora",
  bacCentavos: 1_000_000,
  receitaContratadaCentavos: 1_500_000,
  comprometidoCentavos: 300_000,
  realizadoCentavos: 200_000,
  pagoCentavos: 150_000,
  avancoFisicoPercentual: 25,
  valorAgregadoCentavos: 250_000,
  idc: 1.25,
  eacContratualCentavos: 1_000_000,
  eacDesempenhoCentavos: 800_000,
  eacPrincipalCentavos: 1_000_000,
  margemPrevistaCentavos: 500_000,
  margemPrevistaPercentual: 33.333,
  margemProjetadaCentavos: 500_000,
  margemProjetadaPercentual: 33.333,
  desvioProjetadoCentavos: 0,
  desvioProjetadoPercentual: 0,
  saude: "saudavel",
  compromissoEhPosicaoAtual: true,
  etapas: [],
  alertas: [],
  qualidade: {
    temDadosParciais: false,
    quantidadeSemEtapa: 0,
    valorSemEtapaCentavos: 0,
    quantidadeSemVinculo: 0,
    quantidadeFallbackCompetencia: 0,
    quantidadeLegadoSemSaldo: 0,
  },
};

test("modelo executivo entrega os oito KPIs com fórmula e rótulo de posição atual", () => {
  const kpis = criarKpisResultadoObra(resumoBase);
  assert.deepEqual(
    kpis.map((kpi) => kpi.titulo),
    [
      "Receita contratada",
      "Custo orçado (BAC)",
      "Custo comprometido",
      "Custo realizado",
      "Custo pago",
      "Custo projetado (EAC)",
      "Margem projetada",
      "Desvio projetado",
    ],
  );
  assert.equal(kpis.length, 8);
  assert.ok(kpis.every((kpi) => kpi.formula.length > 10));
  assert.match(kpis.find((kpi) => kpi.id === "comprometido").complemento, /posição atual/i);
});

test("dados ausentes são Não informado e etapa nula é Sem apropriação", () => {
  assert.equal(formatarCentavosResultado(null), "Não informado");
  assert.equal(rotuloEtapaResultado({ id: null, nome: "" }), "Sem apropriação");
  const kpis = criarKpisResultadoObra({
    ...resumoBase,
    receitaContratadaCentavos: null,
    bacCentavos: null,
    eacPrincipalCentavos: null,
    margemProjetadaCentavos: null,
    desvioProjetadoCentavos: null,
  });
  assert.equal(kpis.find((kpi) => kpi.id === "receita").valor, "Não informado");
  assert.equal(kpis.find((kpi) => kpi.id === "eac").valor, "Não informado");
});

test("estados distinguem seleção, carregamento, erro, sem orçamento, parcial e completo", () => {
  assert.equal(obterEstadoCockpitResultado({ obraId: null }), "selecione_obra");
  assert.equal(obterEstadoCockpitResultado({ obraId: "obra", isLoading: true }), "carregando");
  assert.equal(obterEstadoCockpitResultado({ obraId: "obra", isError: true }), "erro");
  assert.equal(
    obterEstadoCockpitResultado({ obraId: "obra", resumo: { ...resumoBase, bacCentavos: null } }),
    "sem_orcamento",
  );
  assert.equal(
    obterEstadoCockpitResultado({
      obraId: "obra",
      resumo: {
        ...resumoBase,
        qualidade: { ...resumoBase.qualidade, temDadosParciais: true },
      },
    }),
    "dados_parciais",
  );
  assert.equal(obterEstadoCockpitResultado({ obraId: "obra", resumo: resumoBase }), "completo");
});

test("somente alertas com destino são acionáveis e o cockpit não oferece mutação", () => {
  const alertas = [
    { id: "1", etapaId: null, origemUrl: null },
    { id: "2", etapaId: "etapa-1", origemUrl: null },
    { id: "3", etapaId: null, origemUrl: "/financeiro" },
  ];
  assert.deepEqual(
    filtrarAlertasAcionaveis(alertas).map((alerta) => alerta.id),
    ["2", "3"],
  );
  assert.deepEqual(ACOES_RESULTADO_OBRA, ["detalhar", "abrir_origem"]);
  assert.ok(!ACOES_RESULTADO_OBRA.includes("editar"));
  assert.ok(!ACOES_RESULTADO_OBRA.includes("excluir"));
  assert.ok(!ACOES_RESULTADO_OBRA.includes("pagar"));
});
