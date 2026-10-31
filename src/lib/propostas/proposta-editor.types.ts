export type StatusPropostaEditor = 'rascunho' | 'enviada' | 'aceita' | 'rejeitada' | 'expirada'

export interface AtividadeEditor {
  id: string
  codigo?: string | null
  descricao: string
  unidade: string
  quantidade: number
  precoUnitarioCentavos: number
  precoTotalCentavos: number
}

export interface EtapaEditor {
  id: string
  codigo: string
  nome: string
  valorTotalCentavos: number
  atividades: AtividadeEditor[]
}

export interface PropostaEditorData {
  id?: string
  numero?: string
  clienteNome?: string
  clienteCpfCnpj?: string
  clienteEmail?: string
  obraNome?: string
  obraEndereco?: string
  prazoExecucaoTexto?: string
  orcamentoRevisaoId?: string
  status?: StatusPropostaEditor
  revisaoNumero?: number
  etapas: EtapaEditor[]
}

export interface ContextoProposta {
  propostaId?: string
  numero?: string
  clienteNome?: string
  clienteCpfCnpj?: string
  clienteEmail?: string
  obraNome?: string
  obraEndereco?: string
  prazoExecucaoTexto?: string
  orcamentoRevisaoId?: string
  status?: StatusPropostaEditor
  revisaoNumero?: number
}

export interface PropostaRevisaoResumo {
  id: string
  numero: number
  status: StatusPropostaEditor
  createdAt: string
  enviadaAt?: string | null
  valorTotalCentavos: number
}

export interface RevisaoOrcamentoResumo {
  id: string
  numero: number
  createdAt: string
}

export interface ItemPropostaLegado {
  id: string
  etapa_codigo?: string | null
  etapa_nome?: string | null
  codigo_referencia?: string | null
  descricao: string
  unidade?: string | null
  quantidade: number
  valor_unitario: number
  ordem?: number | null
}

export type PropostaLegadaResolucao =
  | { tipo: 'nenhuma' }
  | { tipo: 'unica'; revisaoId: string }
  | { tipo: 'multipla'; candidatas: string[] }

export type EstadoPropostaEditor =
  | { tipo: 'pronta'; proposta: PropostaEditorData }
  | { tipo: 'escolher_revisao'; candidatas: RevisaoOrcamentoResumo[] }
  | { tipo: 'sem_origem' }
