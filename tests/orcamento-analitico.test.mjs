import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarFormulaMemorial,
  somarMemorial,
  achatarComposicao,
  calcularComposicao,
  resolverBdi,
  calcularPrecoAtividade,
} from '../src/lib/orcamento-analitico.ts';

test('avalia somente aritmética segura com decimal brasileiro', () => {
  assert.equal(avaliarFormulaMemorial('(3,5 + 1,5) * 2'), 10);
  assert.equal(avaliarFormulaMemorial('10 - 2 * 3'), 4);
  assert.equal(avaliarFormulaMemorial('8 / 4'), 2);
  assert.throws(() => avaliarFormulaMemorial('process.exit()'), /inválid/i);
  assert.throws(() => avaliarFormulaMemorial('1 / 0'), /zero/i);
  assert.throws(() => avaliarFormulaMemorial('-1'), /negativ/i);
  assert.equal(somarMemorial([{ resultado: 2.5 }, { resultado: 7.25 }]), 9.75);
});

test('achata composições auxiliares e detecta ciclos', () => {
  const itens = [
    { id: 'aux', tipo: 'composicao', referenciaId: 'argamassa', coeficiente: 2, descricao: 'Argamassa' },
    { id: 'cimento', tipo: 'insumo', composicaoId: 'argamassa', coeficiente: 3, descricao: 'Cimento', categoria: 'material', precoUnitarioCentavos: 100 },
    { id: 'pedreiro', tipo: 'insumo', composicaoId: 'raiz', coeficiente: 0.5, descricao: 'Pedreiro', categoria: 'mao_de_obra', precoUnitarioCentavos: 2000 },
  ];
  const achatados = achatarComposicao('raiz', itens);
  assert.deepEqual(achatados.map((i) => [i.id, i.coeficiente]), [['cimento', 6], ['pedreiro', 0.5]]);
  assert.deepEqual(achatados[0].caminhoTecnico, ['Argamassa']);
  assert.throws(() => achatarComposicao('a', [
    { id: 'a-b', tipo: 'composicao', composicaoId: 'a', referenciaId: 'b', coeficiente: 1, descricao: 'B' },
    { id: 'b-a', tipo: 'composicao', composicaoId: 'b', referenciaId: 'a', coeficiente: 1, descricao: 'A' },
  ]), /ciclo/i);
});

test('calcula custos por categoria em centavos', () => {
  const resumo = calcularComposicao([
    { categoria: 'material', coeficiente: 1.25, precoUnitarioCentavos: 101 },
    { categoria: 'mao_de_obra', coeficiente: 0.5, precoUnitarioCentavos: 1999 },
    { categoria: 'equipamento', coeficiente: 1, precoUnitarioCentavos: 0 },
  ]);
  assert.deepEqual(resumo, {
    maoDeObraCentavos: 1000,
    materialCentavos: 126,
    equipamentoCentavos: 0,
    outrosCentavos: 0,
    totalCentavos: 1126,
  });
});

test('BDI usa atividade, depois categoria e por fim geral, sem somar', () => {
  assert.deepEqual(resolverBdi({ atividade: 18, categoria: 25, geral: 30 }), { percentual: 18, origem: 'atividade' });
  assert.deepEqual(resolverBdi({ atividade: null, categoria: 25, geral: 30 }), { percentual: 25, origem: 'categoria' });
  assert.deepEqual(resolverBdi({ atividade: null, categoria: null, geral: 0 }), { percentual: 0, origem: 'geral' });
  assert.deepEqual(calcularPrecoAtividade({ custoUnitarioCentavos: 1126, quantidade: 2, bdiPercentual: 25 }), {
    custoUnitarioCentavos: 1126,
    custoTotalCentavos: 2252,
    precoUnitarioCentavos: 1408,
    precoTotalCentavos: 2816,
  });
});

