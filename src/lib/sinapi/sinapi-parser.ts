import type { CategoriaCusto } from '../orcamento-analitico'

const categorias: Record<string, CategoriaCusto> = { MATERIAL: 'material', MAO_DE_OBRA: 'mao_de_obra', 'MÃO DE OBRA': 'mao_de_obra', EQUIPAMENTO: 'equipamento', OUTROS: 'outros' }
const numero = (valor: unknown) => Number(String(valor ?? '').trim().replace(/\./g, '').replace(',', '.'))

export function parsearLinhasSinapi(linhas: Array<Record<string, unknown>>) {
  return linhas.map((linha, indice) => {
    const obrigatorios = ['CODIGO', 'DESCRICAO', 'UNIDADE', 'TIPO', 'COEFICIENTE', 'PRECO']
    if (obrigatorios.some(c => linha[c] == null || String(linha[c]).trim() === '')) throw new Error(`Cabeçalho ou valor obrigatório ausente na linha ${indice + 2}`)
    const coeficiente = numero(linha.COEFICIENTE); const preco = numero(linha.PRECO)
    if (!Number.isFinite(coeficiente) || !Number.isFinite(preco) || coeficiente < 0 || preco < 0) throw new Error(`Valor numérico inválido na linha ${indice + 2}`)
    return { codigo: String(linha.CODIGO).trim(), descricao: String(linha.DESCRICAO).trim(), unidade: String(linha.UNIDADE).trim(), categoria: categorias[String(linha.TIPO).trim().toUpperCase()] ?? 'outros' as CategoriaCusto, coeficiente, precoUnitarioCentavos: Math.round(preco * 100) }
  })
}

