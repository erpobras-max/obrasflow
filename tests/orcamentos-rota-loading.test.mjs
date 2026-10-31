import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const rota = await readFile(new URL('../src/routes/_app/orcamentos.tsx', import.meta.url), 'utf8')

test('consulta do orçamento expõe estados de carregamento, erro e nova tentativa', () => {
  assert.match(rota, /isPending:\s*loadingOrcamento/)
  assert.match(rota, /isError:\s*erroOrcamento/)
  assert.match(rota, /refetch:\s*recarregarOrcamento/)
  assert.match(rota, /Carregando orçamento da obra/)
  assert.match(rota, /Não foi possível carregar o orçamento/)
  assert.match(rota, /recarregarOrcamento\(\)/)
})

test('tela legada não é escolhida enquanto o orçamento está pendente', () => {
  const indiceCarregamento = rota.indexOf('loadingOrcamento ?')
  const indiceAnalitico = rota.indexOf('<OrcamentoAnaliticoView')
  const indiceLegado = rota.indexOf('{/* Summary KPIs */}')

  assert.ok(indiceCarregamento > -1)
  assert.ok(indiceCarregamento < indiceAnalitico)
  assert.ok(indiceAnalitico < indiceLegado)
})
