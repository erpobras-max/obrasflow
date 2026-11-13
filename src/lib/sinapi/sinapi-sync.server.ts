import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_PROJECT_URL } from '@/integrations/supabase/client.custom'
import { createSupabaseAdminClient } from '@/integrations/supabase/client.server.custom'
import { descobrirCompetencia } from './sinapi-descoberta'

const PAGINA_CAIXA = 'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/referencias-precos-insumos/Paginas/default.aspx'

const parseCurrencyToCentavos = (value: unknown) => {
  if (typeof value === 'number') return Math.round(value * 100)
  const text = String(value ?? '').replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.').trim()
  const number = Number.parseFloat(text)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}

function getSupabaseAuthClient() {
  return createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function sincronizarSinapiNoServidor(token: string, uf: string, mes: string) {
  const auth = await getSupabaseAuthClient().auth.getUser(token)
  if (auth.error || !auth.data.user) throw new Error('Sessão inválida ou expirada')

  const pagina = await fetch(PAGINA_CAIXA, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(30_000) })
  if (!pagina.ok) throw new Error(`Caixa respondeu ${pagina.status}`)
  const descoberta = descobrirCompetencia(await pagina.text())
  const pacote = await fetch(descoberta.url, { signal: AbortSignal.timeout(120_000) })
  if (!pacote.ok) throw new Error(`Falha ao baixar pacote SINAPI (${pacote.status})`)
  const zip = await JSZip.loadAsync(await pacote.arrayBuffer())
  const planilhas = Object.keys(zip.files).filter((nome) => /\.(xlsx|xls)$/i.test(nome) && !nome.includes('__MACOSX'))
  if (!planilhas.length) throw new Error('O pacote SINAPI não contém planilhas')

  const composicoes: any[] = []
  const insumos: any[] = []
  for (const nome of planilhas) {
    const workbook = XLSX.read(await zip.files[nome].async('arraybuffer'), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
    const headerIndex = linhas.findIndex((linha) => {
      const texto = String(linha?.join(' ') ?? '').toLowerCase()
      return texto.includes('descri') && texto.includes('unid')
    })
    if (headerIndex < 0) continue
    const header = linhas[headerIndex].map((cell) => String(cell ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    const findColumn = (terms: string[]) => header.findIndex((value) => terms.some((term) => value.includes(term)))
    const codigo = findColumn(['codigo', 'cod'])
    const descricao = findColumn(['descricao'])
    const unidade = findColumn(['unidade', 'unid'])
    const preco = findColumn(['preco', 'custo', 'valor', 'mediano'])
    if ([codigo, descricao, unidade, preco].some((column) => column < 0)) continue
    const ehComposicao = /compos|servic|sintet/i.test(nome) || header.some((value) => value.includes('custo total'))
    for (const linha of linhas.slice(headerIndex + 1)) {
      const codigoValor = String(linha[codigo] ?? '').trim()
      const descricaoValor = String(linha[descricao] ?? '').trim()
      if (!codigoValor || !descricaoValor) continue
      const valor = parseCurrencyToCentavos(linha[preco])
      if (!valor) continue
      const registro = { fonte: 'sinapi', uf, mes_referencia: mes || descoberta.competencia, codigo: codigoValor, descricao: descricaoValor, unidade: String(linha[unidade] ?? 'un').trim() || 'un' }
      if (ehComposicao) composicoes.push({ ...registro, custo_total: valor, tipo_classe: null })
      else insumos.push({ ...registro, preco_mediano: valor })
    }
  }
  if (!composicoes.length && !insumos.length) throw new Error('Nenhuma linha válida foi encontrada nas planilhas SINAPI')

  const admin = createSupabaseAdminClient()
  for (let index = 0; index < composicoes.length; index += 500) {
    const { error } = await admin.from('referencia_composicoes').upsert(composicoes.slice(index, index + 500), { onConflict: 'fonte,uf,mes_referencia,codigo' })
    if (error) throw error
  }
  for (let index = 0; index < insumos.length; index += 500) {
    const { error } = await admin.from('referencia_insumos').upsert(insumos.slice(index, index + 500), { onConflict: 'fonte,uf,mes_referencia,codigo' })
    if (error) throw error
  }
  return { competencia: descoberta.competencia, composicoes: composicoes.length, insumos: insumos.length }
}
