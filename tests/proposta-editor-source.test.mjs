import test from 'node:test'
import assert from 'node:assert/strict'
import {
  selecionarRevisaoAtiva,
  resumirRevisoes,
} from '../src/lib/propostas/proposta-editor-state.ts'

test('seleciona o rascunho atual e não sobrescreve revisão histórica enviada', () => {
  const ativa = selecionarRevisaoAtiva([
    { id: 'r1', numero: 1, status: 'enviada', configuracao: { tituloProposta: 'Enviada' }, fotografia: {} },
    { id: 'r2', numero: 2, status: 'rascunho', configuracao: { tituloProposta: 'Atual' }, fotografia: {} },
  ])

  assert.equal(ativa.id, 'r2')
  assert.equal(ativa.configuracao.tituloProposta, 'Atual')
})

test('usa a revisão numericamente mais recente quando não existe rascunho', () => {
  const ativa = selecionarRevisaoAtiva([
    { id: 'r2', numero: 2, status: 'rejeitada', configuracao: {}, fotografia: {} },
    { id: 'r1', numero: 1, status: 'enviada', configuracao: {}, fotografia: {} },
  ])

  assert.equal(ativa.id, 'r2')
})

test('resume histórico com valor congelado da fotografia e datas persistidas', () => {
  const resumo = resumirRevisoes([
    {
      id: 'r1', numero: 1, status: 'enviada', configuracao: {},
      fotografia: { totalPrecoCentavos: 987654 },
      created_at: '2026-10-30T10:00:00Z', enviada_at: '2026-10-30T11:00:00Z',
    },
  ])

  assert.deepEqual(resumo, [{
    id: 'r1', numero: 1, status: 'enviada', createdAt: '2026-10-30T10:00:00Z',
    enviadaAt: '2026-10-30T11:00:00Z', valorTotalCentavos: 987654,
  }])
})
