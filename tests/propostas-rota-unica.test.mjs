import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rota = await readFile(new URL('../src/routes/_app/comercial.propostas.tsx', import.meta.url), 'utf8')
const hookEditor = await readFile(new URL('../src/hooks/use-proposta-editor.ts', import.meta.url), 'utf8')
const dialogCriacao = await readFile(new URL('../src/components/propostas/nova-proposta-orcamento-dialog.tsx', import.meta.url), 'utf8')

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

test('editor consulta origens por RPC sanitizada sem ler fotografia técnica diretamente', () => {
  assert.match(hookEditor, /listar_origens_proposta_editor/)
  assert.match(dialogCriacao, /listar_origens_proposta_editor/)
  assert.doesNotMatch(hookEditor, /from\(['"]orcamento_revisoes['"]\)/)
  assert.doesNotMatch(dialogCriacao, /from\(['"]orcamento_revisoes['"]\)/)
  assert.doesNotMatch(dialogCriacao, /from\(['"]orcamentos['"]\)/)
})

test('nova proposta informa carregamento, falha e ausência de origens elegíveis', () => {
  assert.match(dialogCriacao, /origensQuery\.isPending/)
  assert.match(dialogCriacao, /origensQuery\.isError/)
  assert.match(dialogCriacao, /origensQuery\.refetch/)
  assert.match(dialogCriacao, /obrasCadastradasQuery/)
  assert.match(dialogCriacao, /Carregando obras e revisões/)
  assert.match(dialogCriacao, /Nenhuma obra com orçamento e revisão congelada disponível/)
  assert.match(dialogCriacao, /Nenhuma obra cadastrada/)
  assert.match(dialogCriacao, /As obras cadastradas ainda não possuem orçamento com revisão congelada/)
})

test('duplicação preserva a proposta de origem e fica disponível após congelamento', () => {
  assert.match(rota, /origemPropostaId=\{duplicarOrigem\?\.id\}/)
  assert.match(rota, /revisaoInicialId=\{duplicarOrigem\?\.orcamento_revisao_id\}/)
  assert.doesNotMatch(rota, /proposta\.status === ['"]rascunho['"] && podeEditar && <Button[^>]+Duplicar/)
})

test('preview legado oferece materialização do orçamento analítico atual', () => {
  assert.match(rota, /podeMaterializarOrigemAnalitica/)
  assert.match(rota, /Importar orçamento atual/)
})
