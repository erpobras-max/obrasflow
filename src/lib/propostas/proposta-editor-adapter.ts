import type {
  AtividadeEditor,
  ContextoProposta,
  EtapaEditor,
  ItemPropostaLegado,
  PropostaEditorData,
  PropostaLegadaResolucao,
  RevisaoOrcamentoResumo,
} from './proposta-editor.types'

const registro = (valor: unknown): Record<string, unknown> =>
  valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {}

const lista = (valor: unknown): unknown[] => Array.isArray(valor) ? valor : []
const texto = (valor: unknown, fallback = ''): string => typeof valor === 'string' ? valor : fallback
const numero = (valor: unknown, fallback = 0): number => {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : fallback
}

export function adaptarFotografiaParaEditor(
  fotografia: unknown,
  contexto: ContextoProposta,
): PropostaEditorData {
  const origem = registro(fotografia)
  const etapas = lista(origem.etapas).map((etapaValor, etapaIndice): EtapaEditor => {
    const etapa = registro(etapaValor)
    const atividades = lista(etapa.atividades).map((atividadeValor, atividadeIndice): AtividadeEditor => {
      const atividade = registro(atividadeValor)
      return {
        id: texto(atividade.id, `atividade-${etapaIndice + 1}-${atividadeIndice + 1}`),
        codigo: texto(atividade.codigo) || null,
        descricao: texto(atividade.descricaoComercial, texto(atividade.descricao, 'Serviço')),
        unidade: texto(atividade.unidade, 'un'),
        quantidade: numero(atividade.quantidade, 1),
        precoUnitarioCentavos: Math.round(numero(atividade.precoUnitarioCentavos)),
        precoTotalCentavos: Math.round(numero(atividade.precoTotalCentavos)),
      }
    })
    const totalAtividades = atividades.reduce((total, atividade) => total + atividade.precoTotalCentavos, 0)
    return {
      id: texto(etapa.id, `etapa-${etapaIndice + 1}`),
      codigo: texto(etapa.codigo, String(etapaIndice + 1).padStart(2, '0')),
      nome: texto(etapa.nome, `Etapa ${etapaIndice + 1}`),
      valorTotalCentavos: Math.round(numero(etapa.valorTotalCentavos, totalAtividades)),
      atividades,
    }
  })

  return {
    id: contexto.propostaId,
    numero: contexto.numero,
    clienteNome: contexto.clienteNome,
    clienteCpfCnpj: contexto.clienteCpfCnpj,
    clienteEmail: contexto.clienteEmail,
    obraNome: contexto.obraNome,
    obraEndereco: contexto.obraEndereco,
    prazoExecucaoTexto: contexto.prazoExecucaoTexto,
    orcamentoRevisaoId: contexto.orcamentoRevisaoId,
    status: contexto.status,
    revisaoNumero: contexto.revisaoNumero,
    etapas,
  }
}

export function adaptarItensLegados(itens: ItemPropostaLegado[]): EtapaEditor[] {
  const etapas = new Map<string, EtapaEditor>()
  const ordenados = [...itens].sort((a, b) => numero(a.ordem) - numero(b.ordem))

  ordenados.forEach((item, indice) => {
    const codigo = item.etapa_codigo || '01'
    const etapa = etapas.get(codigo) ?? {
      id: `etapa-${codigo}`,
      codigo,
      nome: item.etapa_nome || 'SERVIÇOS GERAIS',
      valorTotalCentavos: 0,
      atividades: [],
    }
    const precoUnitarioCentavos = Math.round(numero(item.valor_unitario) * 100)
    const precoTotalCentavos = Math.round(numero(item.quantidade) * precoUnitarioCentavos)
    etapa.atividades.push({
      id: item.id,
      codigo: item.codigo_referencia || `${codigo}.${String(indice + 1).padStart(2, '0')}`,
      descricao: item.descricao,
      unidade: item.unidade || 'un',
      quantidade: numero(item.quantidade, 1),
      precoUnitarioCentavos,
      precoTotalCentavos,
    })
    etapa.valorTotalCentavos += precoTotalCentavos
    etapas.set(codigo, etapa)
  })

  return [...etapas.values()]
}

export function resolverCandidatasLegado(
  revisoes: RevisaoOrcamentoResumo[],
): PropostaLegadaResolucao {
  if (revisoes.length === 0) return { tipo: 'nenhuma' }
  if (revisoes.length === 1) return { tipo: 'unica', revisaoId: revisoes[0].id }
  return { tipo: 'multipla', candidatas: revisoes.map((revisao) => revisao.id) }
}
