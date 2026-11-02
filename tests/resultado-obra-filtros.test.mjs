import test from "node:test";
import assert from "node:assert/strict";
import {
  parseResultadoObraSearch,
  serializarResultadoObraSearch,
} from "../src/lib/resultado-obra-filtros.ts";
import { carregarResultadoObra, resultadoObraQueryKey } from "../src/hooks/use-resultado-obras.ts";

const OBRA_ID = "4da7e40b-b64f-4f55-9a38-705f9d8fd4e1";

test("parser aplica defaults seguros e não lança com parâmetros inválidos", () => {
  assert.deepEqual(parseResultadoObraSearch({ tab: "resultado" }), {
    tab: "resultado",
    obraId: null,
    regime: "competencia",
    periodo: "obra_inteira",
    dataInicio: null,
    dataFim: null,
  });
  assert.deepEqual(
    parseResultadoObraSearch({
      tab: "resultado",
      obra: "não-é-uuid",
      regime: "inventado",
      periodo: "mes",
      inicio: "2026-11-31",
      fim: "ontem",
    }),
    {
      tab: "resultado",
      obraId: null,
      regime: "competencia",
      periodo: "obra_inteira",
      dataInicio: null,
      dataFim: null,
    },
  );
});

test("parser preserva obra, caixa e mês somente com intervalo completo e ordenado", () => {
  const valido = parseResultadoObraSearch({
    tab: "resultado",
    obra: OBRA_ID,
    regime: "caixa",
    periodo: "mes",
    inicio: "2026-10-01",
    fim: "2026-10-31",
  });
  assert.deepEqual(valido, {
    tab: "resultado",
    obraId: OBRA_ID,
    regime: "caixa",
    periodo: "mes",
    dataInicio: "2026-10-01",
    dataFim: "2026-10-31",
  });

  assert.equal(
    parseResultadoObraSearch({ periodo: "mes", inicio: "2026-10-01" }).periodo,
    "obra_inteira",
  );
  assert.equal(
    parseResultadoObraSearch({
      periodo: "mes",
      inicio: "2026-10-31",
      fim: "2026-10-01",
    }).periodo,
    "obra_inteira",
  );
});

test("serializador produz query string estável e reversível", () => {
  const filtros = {
    tab: "resultado",
    obraId: OBRA_ID,
    regime: "caixa",
    periodo: "mes",
    dataInicio: "2026-10-01",
    dataFim: "2026-10-31",
  };
  const busca = serializarResultadoObraSearch(filtros);
  assert.deepEqual(busca, {
    tab: "resultado",
    obra: OBRA_ID,
    regime: "caixa",
    periodo: "mes",
    inicio: "2026-10-01",
    fim: "2026-10-31",
  });
  assert.deepEqual(parseResultadoObraSearch(busca), filtros);
});

test("até hoje preserva limite final mesmo sem data inicial", () => {
  const busca = serializarResultadoObraSearch({
    tab: "resultado",
    obraId: OBRA_ID,
    regime: "competencia",
    periodo: "ate_hoje",
    dataInicio: null,
    dataFim: "2026-11-02",
  });
  assert.equal(busca.fim, "2026-11-02");
  assert.equal(parseResultadoObraSearch(busca).dataFim, "2026-11-02");
});

test("query key muda com obra, regime e datas", () => {
  const base = {
    obraId: OBRA_ID,
    regime: "competencia",
    periodo: "mes",
    dataInicio: "2026-10-01",
    dataFim: "2026-10-31",
  };
  assert.deepEqual(resultadoObraQueryKey(base), [
    "resultado-obras",
    OBRA_ID,
    "competencia",
    "mes",
    "2026-10-01",
    "2026-10-31",
  ]);
  assert.notDeepEqual(
    resultadoObraQueryKey(base),
    resultadoObraQueryKey({ ...base, regime: "caixa" }),
  );
});

test("loader faz uma RPC, mapeia snake_case e preserva movimentos já filtrados no banco", async () => {
  const chamadas = [];
  const executor = async (nome, parametros, signal) => {
    chamadas.push({ nome, parametros, signal });
    return {
      data: [
        {
          obra_id: OBRA_ID,
          obra_nome: "Obra Aurora",
          etapa_id: null,
          etapa_nome: null,
          origem: "conta_pagar",
          origem_id: "11111111-1111-4111-8111-111111111111",
          origem_vinculo_id: null,
          descricao: "Pagamento no período",
          data_referencia: "2026-09-01",
          data_vencimento: "2026-09-10",
          valor_em_aberto_centavos: 0,
          valor_orcado_centavos: 0,
          valor_receita_centavos: 0,
          valor_comprometido_centavos: 0,
          valor_realizado_centavos: 0,
          valor_pago_centavos: 12_345,
          avanco_fisico_percentual: null,
          legado_sem_saldo: false,
          competencia_fallback: true,
          origem_url: "/financeiro",
          metadados: { regime: "competencia" },
        },
      ],
      error: null,
    };
  };
  const signal = new AbortController().signal;
  const resultado = await carregarResultadoObra(
    {
      obraId: OBRA_ID,
      regime: "competencia",
      periodo: "mes",
      dataInicio: "2026-10-01",
      dataFim: "2026-10-31",
    },
    executor,
    signal,
  );

  assert.equal(chamadas.length, 1, "não deve consultar uma vez por etapa");
  assert.deepEqual(chamadas[0], {
    nome: "obter_resultado_obra",
    parametros: {
      p_obra_id: OBRA_ID,
      p_data_inicio: "2026-10-01",
      p_data_fim: "2026-10-31",
      p_regime: "competencia",
    },
    signal,
  });
  assert.equal(resultado.linhas[0].obraNome, "Obra Aurora");
  assert.equal(resultado.linhas[0].valorPagoCentavos, 12_345);
  assert.equal(resultado.resumo.pagoCentavos, 12_345);
});

test("loader propaga erro sanitizado da RPC e não consulta sem obra", async () => {
  let chamadas = 0;
  const executor = async () => {
    chamadas += 1;
    return { data: null, error: new Error("consulta recusada") };
  };
  await assert.rejects(
    carregarResultadoObra(
      {
        obraId: OBRA_ID,
        regime: "competencia",
        periodo: "obra_inteira",
        dataInicio: null,
        dataFim: null,
      },
      executor,
    ),
    /consulta recusada/,
  );
  assert.equal(chamadas, 1);

  await assert.rejects(
    carregarResultadoObra(
      {
        obraId: null,
        regime: "competencia",
        periodo: "obra_inteira",
        dataInicio: null,
        dataFim: null,
      },
      executor,
    ),
    /Selecione uma obra/,
  );
  assert.equal(chamadas, 1);
});
