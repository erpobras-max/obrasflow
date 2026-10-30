export function validarCompetencia(itens: Array<{ codigo: string; precoUnitarioCentavos: number }>) {
  if (!itens.length) throw new Error('A competência SINAPI está vazia')
  const precosZerados = itens.filter(i => i.precoUnitarioCentavos === 0).length
  if (precosZerados > 0) throw new Error(`Competência bloqueada: ${precosZerados} preços zerados encontrados`)
  const codigos = new Set(itens.map(i => i.codigo))
  if (codigos.size !== itens.length) throw new Error('Competência bloqueada: códigos duplicados')
  return { total: itens.length, precosZerados, publicavel: true }
}

