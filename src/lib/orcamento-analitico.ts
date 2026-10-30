export type CategoriaCusto = 'mao_de_obra' | 'material' | 'equipamento' | 'outros'

export interface LinhaMemorial { resultado: number }
export interface ItemComposicao {
  id: string
  tipo: 'insumo' | 'composicao'
  composicaoId?: string
  referenciaId?: string
  coeficiente: number
  descricao: string
  categoria?: CategoriaCusto
  precoUnitarioCentavos?: number
}

export interface InsumoAnalitico extends ItemComposicao {
  tipo: 'insumo'
  categoria: CategoriaCusto
  precoUnitarioCentavos: number
  caminhoTecnico: string[]
}

class ParserAritmetico {
  private pos = 0
  private readonly texto: string
  constructor(texto: string) { this.texto = texto }

  parse(): number {
    if (!/^[\d\s.,+\-*/()]+$/.test(this.texto)) throw new Error('Fórmula inválida: use apenas números e operações aritméticas')
    const valor = this.expressao()
    this.espacos()
    if (this.pos !== this.texto.length) throw new Error('Fórmula inválida')
    if (!Number.isFinite(valor)) throw new Error('Resultado inválido')
    return valor
  }

  private expressao(): number {
    let valor = this.termo()
    for (;;) {
      this.espacos()
      if (this.consumir('+')) valor += this.termo()
      else if (this.consumir('-')) valor -= this.termo()
      else return valor
    }
  }

  private termo(): number {
    let valor = this.fator()
    for (;;) {
      this.espacos()
      if (this.consumir('*')) valor *= this.fator()
      else if (this.consumir('/')) {
        const divisor = this.fator()
        if (divisor === 0) throw new Error('Divisão por zero não é permitida')
        valor /= divisor
      } else return valor
    }
  }

  private fator(): number {
    this.espacos()
    if (this.consumir('-')) return -this.fator()
    if (this.consumir('+')) return this.fator()
    if (this.consumir('(')) {
      const valor = this.expressao()
      this.espacos()
      if (!this.consumir(')')) throw new Error('Fórmula inválida: parêntese não fechado')
      return valor
    }
    const inicio = this.pos
    while (/[\d.,]/.test(this.texto[this.pos] ?? '')) this.pos++
    if (inicio === this.pos) throw new Error('Fórmula inválida')
    const literal = this.texto.slice(inicio, this.pos)
    if ((literal.match(/[,.]/g) ?? []).length > 1) throw new Error('Número inválido')
    const numero = Number(literal.replace(',', '.'))
    if (!Number.isFinite(numero)) throw new Error('Número inválido')
    return numero
  }

  private espacos() { while (/\s/.test(this.texto[this.pos] ?? '')) this.pos++ }
  private consumir(char: string) { if (this.texto[this.pos] === char) { this.pos++; return true } return false }
}

export function avaliarFormulaMemorial(formula: string): number {
  return new ParserAritmetico(formula.trim()).parse()
}

export function somarMemorial(linhas: LinhaMemorial[]): number {
  return linhas.reduce((total, linha) => total + linha.resultado, 0)
}

export function achatarComposicao(raiz: string, itens: ItemComposicao[]): InsumoAnalitico[] {
  const visitar = (composicaoId: string, multiplicador: number, caminho: string[], pilha: string[]): InsumoAnalitico[] => {
    if (pilha.includes(composicaoId)) throw new Error(`Ciclo de composição detectado: ${[...pilha, composicaoId].join(' → ')}`)
    const filhos = itens.filter((item) => (item.composicaoId ?? raiz) === composicaoId)
    return filhos.flatMap((item) => {
      const coeficiente = item.coeficiente * multiplicador
      if (item.tipo === 'composicao') {
        if (!item.referenciaId) throw new Error(`Composição auxiliar sem referência: ${item.descricao}`)
        return visitar(item.referenciaId, coeficiente, [...caminho, item.descricao], [...pilha, composicaoId])
      }
      if (!item.categoria || item.precoUnitarioCentavos == null) throw new Error(`Insumo incompleto: ${item.descricao}`)
      return [{ ...item, tipo: 'insumo', coeficiente, categoria: item.categoria, precoUnitarioCentavos: item.precoUnitarioCentavos, caminhoTecnico: caminho }]
    })
  }
  return visitar(raiz, 1, [], [])
}

export interface ResumoCusto {
  maoDeObraCentavos: number
  materialCentavos: number
  equipamentoCentavos: number
  outrosCentavos: number
  totalCentavos: number
}

export function calcularComposicao(insumos: Array<Pick<InsumoAnalitico, 'categoria' | 'coeficiente' | 'precoUnitarioCentavos'>>): ResumoCusto {
  const resumo: ResumoCusto = { maoDeObraCentavos: 0, materialCentavos: 0, equipamentoCentavos: 0, outrosCentavos: 0, totalCentavos: 0 }
  for (const insumo of insumos) {
    const valor = Math.round(insumo.coeficiente * insumo.precoUnitarioCentavos)
    if (insumo.categoria === 'mao_de_obra') resumo.maoDeObraCentavos += valor
    else if (insumo.categoria === 'material') resumo.materialCentavos += valor
    else if (insumo.categoria === 'equipamento') resumo.equipamentoCentavos += valor
    else resumo.outrosCentavos += valor
  }
  resumo.totalCentavos = resumo.maoDeObraCentavos + resumo.materialCentavos + resumo.equipamentoCentavos + resumo.outrosCentavos
  return resumo
}

export function resolverBdi(contexto: { atividade?: number | null; categoria?: number | null; geral: number }) {
  if (contexto.atividade != null) return { percentual: contexto.atividade, origem: 'atividade' as const }
  if (contexto.categoria != null) return { percentual: contexto.categoria, origem: 'categoria' as const }
  return { percentual: contexto.geral, origem: 'geral' as const }
}

export function calcularPrecoAtividade(input: { custoUnitarioCentavos: number; quantidade: number; bdiPercentual: number }) {
  const custoTotalCentavos = Math.round(input.custoUnitarioCentavos * input.quantidade)
  const precoUnitarioCentavos = Math.round(input.custoUnitarioCentavos * (1 + input.bdiPercentual / 100))
  return {
    custoUnitarioCentavos: input.custoUnitarioCentavos,
    custoTotalCentavos,
    precoUnitarioCentavos,
    precoTotalCentavos: Math.round(precoUnitarioCentavos * input.quantidade),
  }
}

