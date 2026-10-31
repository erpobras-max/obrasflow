import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptarFotografiaParaEditor,
  adaptarItensLegados,
  resolverCandidatasLegado,
} from '../src/lib/propostas/proposta-editor-adapter.ts'

const contexto = {
  propostaId: 'p1',
  numero: 'PROP-2026-0008',
  status: 'rascunho',
  revisaoNumero: 1,
  orcamentoRevisaoId: 'or1',
  clienteNome: 'Francisco Rodrigues',
  clienteCpfCnpj: '123.456.789-00',
  clienteEmail: 'francisco@example.com',
  obraNome: 'Casa teste',
  obraEndereco: 'Rua A, 10',
  prazoExecucaoTexto: '120 dias',
}

test('adapta fotografia comercial por lista branca e preserva preços em centavos', () => {
  const editor = adaptarFotografiaParaEditor({
    etapas: [{
      id: 'e1', codigo: '01', nome: 'Fundação', valorTotalCentavos: 250000,
      custoTotalCentavos: 170000,
      atividades: [{
        id: 'a1', codigo: '96535', descricaoComercial: 'Escavação da fundação', descricao: 'Técnica',
        unidade: 'm³', quantidade: 10, precoUnitarioCentavos: 25000, precoTotalCentavos: 250000,
        bdi: 25, insumos: [{ nome: 'Operador' }],
      }],
    }],
  }, contexto)

  assert.equal(editor.numero, 'PROP-2026-0008')
  assert.equal(editor.etapas[0].valorTotalCentavos, 250000)
  assert.equal(editor.etapas[0].atividades[0].descricao, 'Escavação da fundação')
  assert.equal(editor.etapas[0].atividades[0].precoUnitarioCentavos, 25000)
  assert.equal('custoTotalCentavos' in editor.etapas[0], false)
  assert.equal('bdi' in editor.etapas[0].atividades[0], false)
  assert.equal('insumos' in editor.etapas[0].atividades[0], false)
})

test('agrupa itens legados por etapa e mantém ordem e totais literais', () => {
  const etapas = adaptarItensLegados([
    { id: 'a2', etapa_codigo: '02', etapa_nome: 'Estrutura', descricao: 'Concreto', unidade: 'm³', quantidade: 2, valor_unitario: 500, ordem: 2 },
    { id: 'a1', etapa_codigo: '01', etapa_nome: 'Preliminares', descricao: 'Limpeza', unidade: 'm²', quantidade: 10, valor_unitario: 7.5, ordem: 1 },
    { id: 'a3', etapa_codigo: '02', etapa_nome: 'Estrutura', descricao: 'Forma', unidade: 'm²', quantidade: 5, valor_unitario: 80, ordem: 3 },
  ])

  assert.deepEqual(etapas.map((etapa) => etapa.codigo), ['01', '02'])
  assert.equal(etapas[0].valorTotalCentavos, 7500)
  assert.equal(etapas[1].valorTotalCentavos, 140000)
  assert.deepEqual(etapas[1].atividades.map((atividade) => atividade.id), ['a2', 'a3'])
})

test('resolve nenhuma, uma ou múltiplas revisões legadas sem escolher preço errado', () => {
  assert.deepEqual(resolverCandidatasLegado([]), { tipo: 'nenhuma' })
  assert.deepEqual(resolverCandidatasLegado([{ id: 'r1', numero: 1, createdAt: '2026-10-01' }]), {
    tipo: 'unica',
    revisaoId: 'r1',
  })
  assert.deepEqual(resolverCandidatasLegado([
    { id: 'r1', numero: 1, createdAt: '2026-10-01' },
    { id: 'r2', numero: 2, createdAt: '2026-10-20' },
  ]), {
    tipo: 'multipla',
    candidatas: ['r1', 'r2'],
  })
})

test('honra a revisão legada escolhida explicitamente mesmo quando existem múltiplas candidatas', () => {
  const candidatas = [
    { id: 'r1', numero: 1, createdAt: '2026-01-01' },
    { id: 'r2', numero: 2, createdAt: '2026-02-01' },
  ]
  assert.deepEqual(resolverCandidatasLegado(candidatas, 'r2'), { tipo: 'unica', revisaoId: 'r2' })
})
