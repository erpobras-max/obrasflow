import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rota = await readFile(new URL('../src/routes/_app/comercial.propostas.tsx', import.meta.url), 'utf8')

test('rota usa somente editor persistente e criação pelo orçamento', () => {
  assert.match(rota, /NovaPropostaOrcamentoDialog/)
  assert.match(rota, /usePropostaEditor/)
  assert.doesNotMatch(rota, /PropostaFormDialog|PropostaImpressao|CatalogoPropostas|react-hook-form/)
  assert.doesNotMatch(rota, /setEditTarget|setPrintTarget|Abrir Editor Comercial/)
})

test('exclusão chama RPC sem remoção otimista e é restrita a rascunho', () => {
  assert.match(rota, /excluir_proposta_rascunho/)
  assert.doesNotMatch(rota, /onMutate/)
  assert.match(rota, /proposta\.status === ['"]rascunho['"] && podeExcluir/)
})

test('aceite e rejeição usam transição atômica do editor', () => {
  assert.match(rota, /alterar_status_proposta_editor/)
  assert.doesNotMatch(rota, /from\(['"]propostas['"]\)\.update\(\{ status \}\)/)
})
