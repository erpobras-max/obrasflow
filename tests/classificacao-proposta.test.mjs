import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarConfiguracaoProposta, tiposProposta } from '../src/lib/proposta-orcamento.functions.ts'

test('preserva os sete tipos e usa Obra para configurações antigas ou inválidas', () => {
  assert.deepEqual([...tiposProposta], ['Obra', 'Projeto', 'Serviço', 'Regularização', 'Vistoria', 'Consultoria', 'Outro'])
  assert.equal(normalizarConfiguracaoProposta(null).tipoProposta, 'Obra')
  assert.equal(normalizarConfiguracaoProposta({ tipoProposta: 'Projeto' }).tipoProposta, 'Projeto')
  assert.equal(normalizarConfiguracaoProposta({ tipoProposta: 'inválido' }).tipoProposta, 'Obra')
})
