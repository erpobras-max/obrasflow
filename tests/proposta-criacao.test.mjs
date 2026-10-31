import test from 'node:test'
import assert from 'node:assert/strict'
import { validarSelecaoNovaProposta } from '../src/lib/propostas/proposta-criacao.ts'

test('exige obra, orçamento e revisão na criação comercial', () => {
  assert.deepEqual(validarSelecaoNovaProposta({}), { ok: false, mensagem: 'Selecione uma obra.' })
  assert.deepEqual(validarSelecaoNovaProposta({ obraId: 'o1' }), { ok: false, mensagem: 'A obra não possui orçamento selecionado.' })
  assert.deepEqual(validarSelecaoNovaProposta({ obraId: 'o1', orcamentoId: 'b1' }), { ok: false, mensagem: 'Selecione uma revisão do orçamento.' })
})

test('aceita somente seleção encadeada completa e preserva duplicação explícita', () => {
  assert.deepEqual(
    validarSelecaoNovaProposta({ obraId: 'o1', orcamentoId: 'b1', revisaoId: 'r1' }),
    { ok: true, obraId: 'o1', orcamentoId: 'b1', revisaoId: 'r1', duplicar: false },
  )
  assert.equal(
    validarSelecaoNovaProposta({ obraId: 'o1', orcamentoId: 'b1', revisaoId: 'r1', duplicar: true }).duplicar,
    true,
  )
})
