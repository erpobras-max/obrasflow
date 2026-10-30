import test from 'node:test';
import assert from 'node:assert/strict';
import { converterItensLegados } from '../src/lib/orcamento-legado.ts';

test('cada item legado vira atividade própria com insumo consolidado e total preservado', () => {
  const resultado = converterItensLegados([
    { id: 'i1', etapa: 'Fundação', codigo: '01', descricao: 'Escavação', unidade: 'm3', quantidade: 2.5, valor_unitario: 1234 },
    { id: 'i2', etapa: 'Fundação', codigo: null, descricao: 'Concreto', unidade: 'm3', quantidade: 1, valor_unitario: 5000 },
  ]);
  assert.equal(resultado.etapas.length, 1);
  assert.equal(resultado.etapas[0].atividades.length, 2);
  assert.equal(resultado.etapas[0].atividades[0].legadoConferir, true);
  assert.deepEqual(resultado.etapas[0].atividades[0].insumos[0], {
    codigo: 'LEGADO-i1', descricao: 'Legado — conferir composição', unidade: 'un',
    categoria: 'outros', coeficiente: 1, precoUnitarioCentavos: 1234,
  });
  assert.equal(resultado.totalCentavos, 8085);
});

