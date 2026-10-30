export const configuracaoPropostaPadrao = Object.freeze({
  mostrarEtapas: true,
  mostrarAtividades: true,
  mostrarQuantidades: true,
  mostrarUnidades: true,
  mostrarPrecoUnitario: false,
  mostrarComposicoes: false,
  mostrarCustosInternos: false,
  mostrarBdi: false,
})

export type ConfiguracaoProposta = typeof configuracaoPropostaPadrao

export function criarFotografiaProposta(
  revisao: { id: string; numero: number; fotografia: Record<string, any> },
  configuracao: ConfiguracaoProposta,
) {
  const origem = structuredClone(revisao.fotografia)
  return {
    orcamentoRevisaoId: revisao.id,
    orcamentoRevisaoNumero: revisao.numero,
    configuracao: structuredClone(configuracao),
    etapas: origem.etapas ?? [],
    atividades: configuracao.mostrarAtividades ? (origem.atividades ?? []) : [],
    totalPrecoCentavos: origem.totalPrecoCentavos ?? 0,
  }
}

export function proximaRevisaoProposta(revisoes: Array<{ numero: number; status: string }>) {
  if (revisoes.some((r) => r.status === 'aceita')) throw new Error('A proposta aceita está bloqueada; duplique para criar uma nova negociação')
  return Math.max(0, ...revisoes.map((r) => r.numero)) + 1
}

