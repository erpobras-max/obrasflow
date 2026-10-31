import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase as client } from '@/integrations/supabase/client.custom'
import {
  adaptarFotografiaParaEditor,
  adaptarItensLegados,
  resolverCandidatasLegado,
} from '@/lib/propostas/proposta-editor-adapter'
import {
  resumirRevisoes,
  selecionarRevisaoAtiva,
  type PropostaRevisaoPersistida,
} from '@/lib/propostas/proposta-editor-state'
import type {
  EstadoPropostaEditor,
  PropostaEditorData,
  RevisaoOrcamentoResumo,
} from '@/lib/propostas/proposta-editor.types'
import {
  normalizarConfiguracaoProposta,
  type ConfiguracaoPropostaComercial,
} from '@/lib/proposta-orcamento.functions'

const supabase = client as any

interface OrigemComercialSegura {
  obra_id: string
  orcamento_id: string
  revisao_id: string
  revisao_numero: number
  revisao_created_at: string
  fotografia: Record<string, unknown> | null
}

interface CargaEditor {
  estado: EstadoPropostaEditor
  revisoesPersistidas: PropostaRevisaoPersistida[]
  revisoesOrcamento: Array<RevisaoOrcamentoResumo & { fotografia: Record<string, unknown> }>
  contexto: Record<string, unknown>
  configuracao: ConfiguracaoPropostaComercial
  fotografia: Record<string, unknown>
  revisaoSelecionadaId?: string
  somenteLeitura?: boolean
  podeMaterializarOrigemAnalitica?: boolean
}

const enderecoObra = (obra: any) =>
  [obra?.logradouro, obra?.numero_endereco, obra?.bairro, obra?.cidade, obra?.uf]
    .filter(Boolean)
    .join(', ') || obra?.endereco || ''

const fotografiaDoEditor = (proposta: PropostaEditorData) => ({
  orcamentoRevisaoId: proposta.orcamentoRevisaoId,
  totalPrecoCentavos: proposta.etapas.reduce((total, etapa) => total + etapa.valorTotalCentavos, 0),
  etapas: proposta.etapas,
})

async function consultarOuFalhar(query: PromiseLike<any>) {
  const { data, error } = await query
  if (error) throw error
  return data
}

async function listarOrigensSeguras(parametros: {
  obraId?: string | null
  revisaoId?: string | null
}): Promise<OrigemComercialSegura[]> {
  return (await consultarOuFalhar(
    supabase.rpc('listar_origens_proposta_editor', {
      p_obra_id: parametros.obraId ?? null,
      p_revisao_id: parametros.revisaoId ?? null,
      p_incluir_fotografia: true,
    }),
  )) ?? []
}

export function usePropostaEditor(propostaId: string | null) {
  const queryClient = useQueryClient()
  const [revisaoAbertaId, setRevisaoAbertaId] = useState<string | null>(null)

  const consulta = useQuery<CargaEditor | null>({
    queryKey: ['proposta-editor', propostaId],
    enabled: Boolean(propostaId),
    queryFn: async () => {
      if (!propostaId) return null
      const proposta = await consultarOuFalhar(
        supabase.from('propostas').select('*').eq('id', propostaId).single(),
      )
      const revisoes = (await consultarOuFalhar(
        supabase
          .from('proposta_revisoes')
          .select('*')
          .eq('proposta_id', propostaId)
          .order('numero', { ascending: false }),
      ) ?? []) as PropostaRevisaoPersistida[]
      const cliente = proposta.cliente_id
        ? await consultarOuFalhar(
            supabase.from('clientes').select('*').eq('id', proposta.cliente_id).maybeSingle(),
          )
        : null

      let obra = await consultarOuFalhar(
        supabase.from('obras').select('*').eq('proposta_id', propostaId).limit(1).maybeSingle(),
      )
      let revisaoOrigem: any = null
      if (proposta.orcamento_revisao_id) {
        const [origemSegura] = await listarOrigensSeguras({ revisaoId: proposta.orcamento_revisao_id })
        if (origemSegura) {
          revisaoOrigem = {
            id: origemSegura.revisao_id,
            numero: origemSegura.revisao_numero,
            created_at: origemSegura.revisao_created_at,
            fotografia: origemSegura.fotografia ?? {},
          }
          if (!obra) {
            obra = await consultarOuFalhar(
              supabase.from('obras').select('*').eq('id', origemSegura.obra_id).maybeSingle(),
            )
          }
        }
      }

      const contextoBase = {
        propostaId: proposta.id,
        numero: proposta.numero,
        clienteNome: cliente?.nome ?? 'Cliente',
        clienteCpfCnpj: cliente?.cpf_cnpj ?? cliente?.cnpj ?? cliente?.cpf ?? '',
        clienteEmail: cliente?.email ?? '',
        obraNome: obra?.nome ?? proposta.titulo,
        obraEndereco: enderecoObra(obra),
        prazoExecucaoTexto: obra?.prazo_meses ? `${obra.prazo_meses} meses` : undefined,
      }

      if (revisoes.length > 0) {
        const ativa = selecionarRevisaoAtiva(revisoes)
        const orcamentoRevisaoId =
          typeof ativa.fotografia.orcamentoRevisaoId === 'string'
            ? ativa.fotografia.orcamentoRevisaoId
            : ativa.orcamento_revisao_id ?? undefined
        const contexto = {
          ...contextoBase,
          orcamentoRevisaoId,
          status: ativa.status,
          revisaoNumero: ativa.numero,
        }
        const editorData = adaptarFotografiaParaEditor(ativa.fotografia, contexto)
        return {
          estado: { tipo: 'pronta', proposta: editorData },
          revisoesPersistidas: revisoes,
          revisoesOrcamento: [],
          contexto,
          configuracao: normalizarConfiguracaoProposta(ativa.configuracao),
          fotografia: ativa.fotografia,
          revisaoSelecionadaId: ativa.id,
          somenteLeitura: false,
        }
      }

      let candidatas: Array<RevisaoOrcamentoResumo & { fotografia: Record<string, unknown> }> = []
      if (obra?.id) {
        const linhas = await listarOrigensSeguras({ obraId: obra.id })
        candidatas = linhas.map((linha) => ({
          id: linha.revisao_id,
          numero: linha.revisao_numero,
          createdAt: linha.revisao_created_at,
          fotografia: linha.fotografia ?? {},
        }))
      }
      if (revisaoOrigem && !candidatas.some((item) => item.id === revisaoOrigem.id)) {
        candidatas.unshift({
          id: revisaoOrigem.id,
          numero: revisaoOrigem.numero,
          createdAt: revisaoOrigem.created_at,
          fotografia: revisaoOrigem.fotografia ?? {},
        })
      }

      const resolucao = resolverCandidatasLegado(candidatas, proposta.orcamento_revisao_id)
      if (resolucao.tipo === 'nenhuma') {
        const itensLegados = await consultarOuFalhar(
          supabase
            .from('propostas_itens')
            .select('*')
            .eq('proposta_id', propostaId)
            .order('ordem'),
        )
        if ((itensLegados ?? []).length > 0) {
          const etapas = adaptarItensLegados(itensLegados)
          const propostaLegada = {
            ...contextoBase,
            status: proposta.status,
            revisaoNumero: 1,
            etapas,
          } as PropostaEditorData
          return {
            estado: { tipo: 'pronta', proposta: propostaLegada },
            revisoesPersistidas: [], revisoesOrcamento: [], contexto: contextoBase,
            configuracao: normalizarConfiguracaoProposta(),
            fotografia: { etapas, totalPrecoCentavos: etapas.reduce((total, etapa) => total + etapa.valorTotalCentavos, 0) },
            somenteLeitura: true,
            podeMaterializarOrigemAnalitica: Boolean(obra?.id),
          }
        }
        return {
          estado: { tipo: 'sem_origem' }, revisoesPersistidas: [], revisoesOrcamento: [],
          contexto: contextoBase, configuracao: normalizarConfiguracaoProposta(), fotografia: {},
          somenteLeitura: true,
        }
      }
      if (resolucao.tipo === 'multipla') {
        return {
          estado: { tipo: 'escolher_revisao', candidatas }, revisoesPersistidas: [],
          revisoesOrcamento: candidatas, contexto: contextoBase,
          configuracao: normalizarConfiguracaoProposta(), fotografia: {},
          somenteLeitura: true,
        }
      }
      const origem = candidatas.find((item) => item.id === resolucao.revisaoId)!
      const contexto = {
        ...contextoBase,
        orcamentoRevisaoId: origem.id,
        status: 'rascunho' as const,
        revisaoNumero: 1,
      }
      const editorData = adaptarFotografiaParaEditor(origem.fotografia, contexto)
      return {
        estado: { tipo: 'pronta', proposta: editorData }, revisoesPersistidas: [],
        revisoesOrcamento: candidatas, contexto, configuracao: normalizarConfiguracaoProposta(),
        fotografia: origem.fotografia, revisaoSelecionadaId: origem.id,
        somenteLeitura: false,
      }
    },
  })

  const invalidar = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['propostas'] }),
      queryClient.invalidateQueries({ queryKey: ['proposta-editor', propostaId] }),
      queryClient.invalidateQueries({ queryKey: ['proposta-revisoes', propostaId] }),
    ])
  }

  const persistir = useMutation({
    mutationFn: async ({ publicar, config }: { publicar: boolean; config: ConfiguracaoPropostaComercial }) => {
      if (!propostaId || consulta.data?.estado.tipo !== 'pronta') throw new Error('Proposta não disponível para edição.')
      const proposta = consulta.data.estado.proposta
      if (consulta.data.revisoesPersistidas.length === 0 && proposta.orcamentoRevisaoId) {
        await consultarOuFalhar(
          supabase.rpc('vincular_proposta_legada_revisao', {
            p_proposta_id: propostaId,
            p_orcamento_revisao_id: proposta.orcamentoRevisaoId,
          }),
        )
      }
      const fotografia = fotografiaDoEditor(proposta)
      if (publicar && consulta.data.revisoesPersistidas.length === 0) {
        await consultarOuFalhar(
          supabase.rpc('salvar_rascunho_proposta', {
            p_proposta_id: propostaId, p_configuracao: config, p_fotografia: fotografia,
          }),
        )
      }
      const rpc = publicar ? 'publicar_rascunho_proposta' : 'salvar_rascunho_proposta'
      await consultarOuFalhar(
        supabase.rpc(rpc, {
          p_proposta_id: propostaId, p_configuracao: config, p_fotografia: fotografia,
        }),
      )
    },
    onSuccess: invalidar,
  })

  const selecionar = useMutation({
    mutationFn: async (revisaoId: string) => {
      if (!propostaId) return
      await consultarOuFalhar(
        supabase.rpc('vincular_proposta_legada_revisao', {
          p_proposta_id: propostaId,
          p_orcamento_revisao_id: revisaoId,
        }),
      )
    },
    onSuccess: invalidar,
  })

  const materializarOrigem = useMutation({
    mutationFn: async () => {
      if (!propostaId) return
      await consultarOuFalhar(
        supabase.rpc('materializar_origem_analitica_proposta', {
          p_proposta_id: propostaId,
        }),
      )
    },
    onSuccess: invalidar,
  })

  const cargaVisual = useMemo(() => {
    const carga = consulta.data
    if (!carga || !revisaoAbertaId || carga.revisoesPersistidas.length === 0) return carga
    const revisao = carga.revisoesPersistidas.find((item) => item.id === revisaoAbertaId)
    if (!revisao) return carga
    const contexto = {
      ...carga.contexto,
      status: revisao.status,
      revisaoNumero: revisao.numero,
      orcamentoRevisaoId:
        typeof revisao.fotografia.orcamentoRevisaoId === 'string'
          ? revisao.fotografia.orcamentoRevisaoId
          : revisao.orcamento_revisao_id ?? undefined,
    }
    const proposta = adaptarFotografiaParaEditor(revisao.fotografia, contexto)
    return {
      ...carga,
      estado: { tipo: 'pronta', proposta } as EstadoPropostaEditor,
      configuracao: normalizarConfiguracaoProposta(revisao.configuracao),
      revisaoSelecionadaId: revisao.id,
    }
  }, [consulta.data, revisaoAbertaId])

  return {
    estado: cargaVisual?.estado ?? null,
    editorData: cargaVisual?.estado.tipo === 'pronta' ? cargaVisual.estado.proposta : null,
    configuracao: cargaVisual?.configuracao ?? null,
    revisoes: resumirRevisoes(consulta.data?.revisoesPersistidas ?? []),
    revisaoSelecionadaId: cargaVisual?.revisaoSelecionadaId,
    somenteLeitura: cargaVisual?.somenteLeitura ?? true,
    podeMaterializarOrigemAnalitica: cargaVisual?.podeMaterializarOrigemAnalitica ?? false,
    salvarRascunho: (config: ConfiguracaoPropostaComercial) => persistir.mutateAsync({ publicar: false, config }),
    publicarRascunho: (config: ConfiguracaoPropostaComercial) => persistir.mutateAsync({ publicar: true, config }),
    selecionarRevisaoLegada: selecionar.mutateAsync,
    materializarOrigemAnalitica: materializarOrigem.mutateAsync,
    abrirRevisaoHistorica: setRevisaoAbertaId,
    isPending: consulta.isPending || persistir.isPending || selecionar.isPending || materializarOrigem.isPending,
    error: consulta.error ?? persistir.error ?? selecionar.error ?? materializarOrigem.error,
  }
}
