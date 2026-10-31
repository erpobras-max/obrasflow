import type {
  PropostaRevisaoResumo,
  StatusPropostaEditor,
} from './proposta-editor.types'

export interface PropostaRevisaoPersistida {
  id: string
  numero: number
  status: StatusPropostaEditor
  orcamento_revisao_id?: string | null
  configuracao: Record<string, unknown>
  fotografia: Record<string, unknown>
  created_at?: string | null
  enviada_at?: string | null
}

function porNumeroDescendente(
  a: PropostaRevisaoPersistida,
  b: PropostaRevisaoPersistida,
) {
  return b.numero - a.numero
}

export function selecionarRevisaoAtiva(
  revisoes: PropostaRevisaoPersistida[],
): PropostaRevisaoPersistida {
  if (revisoes.length === 0) {
    throw new Error('A proposta ainda não possui revisões comerciais.')
  }

  const ordenadas = [...revisoes].sort(porNumeroDescendente)
  return ordenadas.find((revisao) => revisao.status === 'rascunho') ?? ordenadas[0]
}

export function resumirRevisoes(
  revisoes: PropostaRevisaoPersistida[],
): PropostaRevisaoResumo[] {
  return [...revisoes].sort(porNumeroDescendente).map((revisao) => ({
    id: revisao.id,
    numero: revisao.numero,
    status: revisao.status,
    createdAt: revisao.created_at ?? '',
    enviadaAt: revisao.enviada_at,
    valorTotalCentavos:
      typeof revisao.fotografia.totalPrecoCentavos === 'number'
        ? revisao.fotografia.totalPrecoCentavos
        : 0,
  }))
}
