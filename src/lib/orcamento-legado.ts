export interface ItemOrcamentoLegado {
  id: string
  etapa: string
  codigo: string | null
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
}

export function converterItensLegados(itens: ItemOrcamentoLegado[]) {
  const grupos = new Map<string, ItemOrcamentoLegado[]>()
  for (const item of itens) grupos.set(item.etapa || 'Geral', [...(grupos.get(item.etapa || 'Geral') ?? []), item])
  const etapas = [...grupos].map(([nome, itensEtapa], indiceEtapa) => ({
    codigo: String(indiceEtapa + 1),
    nome,
    ordem: indiceEtapa,
    atividades: itensEtapa.map((item, indice) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: item.quantidade,
      ordem: indice,
      fonte: 'legado' as const,
      legadoConferir: true,
      insumos: [{
        codigo: `LEGADO-${item.id}`,
        descricao: 'Legado — conferir composição',
        unidade: 'un',
        categoria: 'outros' as const,
        coeficiente: 1,
        precoUnitarioCentavos: item.valor_unitario,
      }],
    })),
  }))
  return {
    etapas,
    totalCentavos: itens.reduce((total, item) => total + Math.round(item.quantidade * item.valor_unitario), 0),
  }
}

