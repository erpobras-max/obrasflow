import { Fragment, useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { EmpresaLogo } from '@/components/empresa-logo'
import { formatCpfCnpj, formatTelefone } from '@/lib/validacao-documento'
import {
  FileText,
  Printer,
  Copy,
  History,
  CheckCircle2,
  Lock,
  Layers,
  Settings2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  User,
  Calendar,
  DollarSign,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  normalizarConfiguracaoProposta,
  formatarRegistroEmpresa,
  type ConfiguracaoPropostaComercial,
} from '@/lib/proposta-orcamento.functions'
import type { PropostaEditorData } from '@/lib/propostas/proposta-editor.types'
import type { PropostaRevisaoResumo } from '@/lib/propostas/proposta-editor.types'
import { HistoricoRevisoesProposta } from './historico-revisoes-proposta'
import { supabase as client } from '@/integrations/supabase/client.custom'

const supabase = client as any
const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface EditorPropostaComercialProps {
  proposta: PropostaEditorData
  configuracaoInicial?: Partial<ConfiguracaoPropostaComercial> | null
  revisoes?: PropostaRevisaoResumo[]
  revisaoSelecionadaId?: string
  onSelecionarRevisao?: (id: string) => void
  somenteLeitura?: boolean
  onSalvarRascunho?: (config: ConfiguracaoPropostaComercial) => Promise<void>
  onPublicarRevisao?: (config: ConfiguracaoPropostaComercial) => Promise<void>
  onVoltar?: () => void
}

export function EditorPropostaComercial({
  proposta,
  configuracaoInicial,
  revisoes = [],
  revisaoSelecionadaId,
  onSelecionarRevisao,
  somenteLeitura = false,
  onSalvarRascunho,
  onPublicarRevisao,
  onVoltar,
}: EditorPropostaComercialProps) {
  const configRecebida = useMemo(
    () => normalizarConfiguracaoProposta({
      ...configuracaoInicial,
      tituloProposta: configuracaoInicial?.tituloProposta ?? `Proposta Comercial · ${proposta.obraNome ?? 'Obra'}`,
      prazoExecucaoTexto: configuracaoInicial?.prazoExecucaoTexto ?? proposta.prazoExecucaoTexto,
    }),
    [configuracaoInicial, proposta.obraNome, proposta.prazoExecucaoTexto],
  )
  const [config, setConfig] = useState<ConfiguracaoPropostaComercial>(configRecebida)

  useEffect(() => {
    setConfig(configRecebida)
  }, [configRecebida])

  // Consulta dados e logo da empresa cadastrada em /empresa
  const { data: empresa } = useQuery({
    queryKey: ['configuracoes-empresa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes_empresa')
        .select('*')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'ObrasFlow Engenharia & Construções'
const cnpjFormatado = empresa?.cnpj ? formatCpfCnpj(empresa.cnpj) : ''
  const registroEmpresa = formatarRegistroEmpresa(empresa)
  const emailEmpresa = empresa?.email || ''
  const telefoneEmpresa = (empresa?.telefone || empresa?.celular)
    ? formatTelefone(empresa.telefone || empresa.celular)
    : '(11) 3456-7890'

  const [modoImpressao, setModoImpressao] = useState(false)
  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Status da proposta
  const isEditavel = proposta.status === 'rascunho' && !somenteLeitura
  const podeCriarNovaRevisao =
    !somenteLeitura && (proposta.status === 'rejeitada' || proposta.status === 'expirada')

  // Atualizador de campo individual
  const updateConfig = (patch: Partial<ConfiguracaoPropostaComercial>) => {
    if (!isEditavel) {
      toast.error('Esta revisão está congelada e disponível somente para leitura e impressão.')
      return
    }
    setConfig((prev) => ({ ...prev, ...patch }))
  }

  // Descrição comercial por atividade
  const updateDescricaoComercial = (atividadeId: string, texto: string) => {
    updateConfig({
      descricoesComerciais: {
        ...config.descricoesComerciais,
        [atividadeId]: texto,
      },
    })
  }

  // Toggle etapa oculta
  const toggleEtapaOculta = (etapaId: string) => {
    const ocultas = config.etapasOcultas.includes(etapaId)
      ? config.etapasOcultas.filter((id) => id !== etapaId)
      : [...config.etapasOcultas, etapaId]
    updateConfig({ etapasOcultas: ocultas })
  }

  // Toggle atividade oculta
  const toggleAtividadeOculta = (atividadeId: string) => {
    const ocultas = config.atividadesOcultas.includes(atividadeId)
      ? config.atividadesOcultas.filter((id) => id !== atividadeId)
      : [...config.atividadesOcultas, atividadeId]
    updateConfig({ atividadesOcultas: ocultas })
  }

  // Filtragem dinâmica para a pré-visualização
  const etapasVisiveis = useMemo(() => {
    return (proposta.etapas ?? [])
      .filter((e) => !config.etapasOcultas.includes(e.id))
      .map((e) => ({
        ...e,
        atividades: config.mostrarApenasEtapa
          ? []
          : e.atividades.filter((a) => !config.atividadesOcultas.includes(a.id)),
      }))
  }, [proposta.etapas, config.etapasOcultas, config.atividadesOcultas, config.mostrarApenasEtapa])

  // Total da proposta visível
  const valorTotalVisivelCentavos = useMemo(() => {
    return etapasVisiveis.reduce((acc, e) => acc + e.valorTotalCentavos, 0)
  }, [etapasVisiveis])

  // Salvar Rascunho
  const salvarRascunho = async () => {
    setSalvando(true)
    try {
      if (onSalvarRascunho) {
        await onSalvarRascunho(config)
      } else {
        toast.success('Rascunho da proposta salvo com sucesso.')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  // Publicar Revisão
  const publicar = async () => {
    setSalvando(true)
    try {
      if (onPublicarRevisao) {
        await onPublicarRevisao(config)
      } else {
        toast.success('Nova revisão publicada e congelada com sucesso!')
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const acionarImpressao = () => {
    window.print()
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] bg-slate-100 text-slate-900">
      {/* ESTILOS DE IMPRESSÃO A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .proposta-print-sheet {
            visibility: visible !important;
            position: absolute !important;
            display: block !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }
          .proposta-print-sheet * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DO EDITOR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-sm no-print">
        <div className="flex items-center gap-3">
          {onVoltar && (
            <Button variant="ghost" size="sm" onClick={onVoltar} className="text-xs text-slate-600">
              ← Voltar
            </Button>
          )}
          <span
            className={`font-bold text-xs px-2.5 py-1 rounded border ${
              !isEditavel
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {isEditavel ? `Rascunho Comercial (Rev. ${proposta.revisaoNumero ?? 1})` : `Revisão ${proposta.revisaoNumero ?? 1} · ${proposta.status} (somente leitura)`}
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Obra: <strong>{proposta.obraNome ?? 'Obra'}</strong> • Preços congelados do orçamento
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoricoOpen(true)}
            className="text-xs bg-white text-slate-700 border-slate-300 flex items-center gap-1.5"
          >
            <History className="size-3.5" />
            Revisões
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={salvarRascunho}
            disabled={salvando || !isEditavel}
            className="text-xs bg-white text-slate-700 border-slate-300"
          >
            Salvar Rascunho
          </Button>

          <Button
            size="sm"
            onClick={publicar}
            disabled={salvando || !isEditavel}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-sm"
          >
            <CheckCircle2 className="mr-1.5 size-3.5" />
            Publicar Nova Revisão
          </Button>

          {podeCriarNovaRevisao && (
            <Button
              size="sm"
              onClick={salvarRascunho}
              disabled={salvando}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm"
            >
              <RefreshCw className="mr-1.5 size-3.5" />
              Criar nova revisão
            </Button>
          )}

          <Button
            size="sm"
            onClick={acionarImpressao}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
          >
            <Printer className="size-3.5" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* ÁREA SPLIT: LADO ESQUERDO (CONFIGURAÇÃO) + LADO DIREITO (PREVIEW A4) */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* PAINEL LATERAL ESQUERDO: CONFIGURAÇÃO */}
        <aside className="w-full lg:w-[460px] bg-white border-r border-slate-200 p-5 overflow-y-auto space-y-6 shrink-0 text-xs shadow-inner max-h-[calc(100vh-170px)] no-print">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Settings2 className="size-4 text-sky-600" />
              Painel de Configuração da Proposta
            </h2>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Personalize a apresentação comercial sem alterar o orçamento técnico original. As mudanças refletem instantaneamente no preview à direita.
            </p>
          </div>

          {/* 1. APRESENTAÇÃO & IDENTIFICAÇÃO */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              1. Apresentação & Identificação
            </span>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-700">Exibir Capa Comercial</span>
                <Switch
                  checked={config.mostrarCapa}
                  onCheckedChange={(v) => updateConfig({ mostrarCapa: v })}
                />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-700">Exibir Logotipo da Empresa</span>
                <Switch
                  checked={config.mostrarLogo}
                  onCheckedChange={(v) => updateConfig({ mostrarLogo: v })}
                />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-700">Exibir Dados do Cliente</span>
                <Switch
                  checked={config.mostrarDadosCliente}
                  onCheckedChange={(v) => updateConfig({ mostrarDadosCliente: v })}
                />
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Título Comercial da Proposta:
                </label>
                <Input
                  value={config.tituloProposta}
                  onChange={(e) => updateConfig({ tituloProposta: e.target.value })}
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300 font-medium"
                />
              </div>

              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Texto de Apresentação ao Cliente:
                </label>
                <Textarea
                  rows={3}
                  value={config.textoApresentacao}
                  onChange={(e) => updateConfig({ textoApresentacao: e.target.value })}
                  className="text-xs bg-white text-slate-900 border-slate-300 leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* 2. VISIBILIDADE DE PREÇOS E ESCOPO */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              2. Visibilidade de Preços e Escopo
            </span>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <div>
                  <span className="text-slate-700 font-medium block">Mostrar Quantidades e Unidades</span>
                  <span className="text-[10px] text-slate-400">Desative para ocultar m², m³, un.</span>
                </div>
                <Switch
                  checked={config.mostrarQuantidades}
                  onCheckedChange={(v) => updateConfig({ mostrarQuantidades: v })}
                />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <div>
                  <span className="text-slate-700 font-medium block">Mostrar Preços Unitários</span>
                  <span className="text-[10px] text-slate-400">Exibe coluna de preço unitário</span>
                </div>
                <Switch
                  checked={config.mostrarPrecoUnitario}
                  onCheckedChange={(v) => updateConfig({ mostrarPrecoUnitario: v })}
                />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                <div>
                  <span className="text-slate-700 font-medium block">Mostrar Apenas Preço Fechado por Etapa</span>
                  <span className="text-[10px] text-slate-400">Oculta itens detalhados e mostra só o macro</span>
                </div>
                <Switch
                  checked={config.mostrarApenasEtapa}
                  onCheckedChange={(v) => updateConfig({ mostrarApenasEtapa: v })}
                />
              </div>
            </div>
          </div>

          {/* 3. SELEÇÃO DE ETAPAS & DESCRIÇÃO COMERCIAL */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              3. Seleção de Etapas & Descrição Comercial
            </span>
            <p className="text-[11px] text-slate-500">
              Edite a descrição visível ao cliente sem afetar o cadastro técnico original.
            </p>

            <div className="space-y-3">
              {(proposta.etapas ?? []).map((etapa) => {
                const etapaOculta = config.etapasOcultas.includes(etapa.id)
                return (
                  <div key={etapa.id} className="bg-white border border-slate-200 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!etapaOculta}
                          onChange={() => toggleEtapaOculta(etapa.id)}
                          className="rounded text-sky-600"
                        />
                        <span>
                          {etapa.codigo} · {etapa.nome}
                        </span>
                      </label>
                      <span className="tabular-nums text-slate-600">{brl(etapa.valorTotalCentavos)}</span>
                    </div>

                    {!etapaOculta && (
                      <div className="pl-4 pt-1 space-y-2">
                        {etapa.atividades.map((atv) => {
                          const atvOculta = config.atividadesOcultas.includes(atv.id)
                          const descComercial = config.descricoesComerciais[atv.id] ?? atv.descricao
                          return (
                            <div key={atv.id} className="space-y-1 border-t border-slate-100 pt-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!atvOculta}
                                    onChange={() => toggleAtividadeOculta(atv.id)}
                                    className="rounded text-sky-600"
                                  />
                                  <span className="font-medium text-slate-800">{atv.descricao}</span>
                                </label>
                                <span className="tabular-nums font-semibold text-slate-700">
                                  {brl(atv.precoTotalCentavos)}
                                </span>
                              </div>

                              {!atvOculta && (
                                <div className="pl-5">
                                  <label className="block text-[10px] text-slate-400">Texto Comercial do Item:</label>
                                  <Input
                                    value={descComercial}
                                    onChange={(e) => updateDescricaoComercial(atv.id, e.target.value)}
                                    className="h-7 text-xs bg-white text-slate-900 border-slate-300 font-medium"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 4. CONDIÇÕES COMERCIAIS & PRAZOS */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] block">
              4. Condições Comerciais & Prazos
            </span>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Prazo de Execução:</label>
                <Input
                  value={config.prazoExecucaoTexto}
                  onChange={(e) => updateConfig({ prazoExecucaoTexto: e.target.value })}
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Validade da Proposta:</label>
                <Input
                  value={config.validadeTexto}
                  onChange={(e) => updateConfig({ validadeTexto: e.target.value })}
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Condições de Pagamento:</label>
                <Textarea
                  rows={3}
                  value={config.condicoesPagamentoTexto}
                  onChange={(e) => updateConfig({ condicoesPagamentoTexto: e.target.value })}
                  className="text-xs bg-white text-slate-900 border-slate-300 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-200/60 pt-2">
                <span className="text-slate-700">Incluir Bloco de Assinaturas</span>
                <Switch
                  checked={config.mostrarAssinaturas}
                  onCheckedChange={(v) => updateConfig({ mostrarAssinaturas: v })}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ÁREA DIREITA: PRÉ-VISUALIZAÇÃO EM TEMPO REAL DA FOLHA A4 */}
        <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-slate-200/60 flex justify-center max-h-[calc(100vh-170px)] print:p-0 print:m-0 print:max-h-none print:overflow-visible print:bg-white print:block">
          <div className="proposta-print-sheet w-full max-w-[820px] bg-white rounded-lg shadow-xl border border-slate-300 p-8 sm:p-12 space-y-8 my-auto print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full print:m-0">
            {/* CAPA COMERCIAL OPCIONAL */}
            {config.mostrarCapa && (
              <div className="text-center py-16 border-b-2 border-slate-200 space-y-5">
                {empresa?.logo_url ? (
                  <div className="flex justify-center">
                    <EmpresaLogo value={empresa.logo_url} className="h-20 w-auto max-w-48 object-contain rounded-2xl shadow" />
                  </div>
                ) : (
                  <div className="w-20 h-20 mx-auto bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow">
                    {nomeEmpresa.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900">{config.tituloProposta}</h1>
                <p className="text-sm text-slate-600">Obra: {proposta.obraNome ?? 'Obra'}</p>
                <div className="pt-8 text-xs text-slate-400">{(empresa?.razao_social || nomeEmpresa).toUpperCase()}</div>
              </div>
            )}

            {/* CABEÇALHO DA PROPOSTA */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-6">
              <div className="flex items-center gap-4">
                {config.mostrarLogo && (
                  empresa?.logo_url ? (
                    <EmpresaLogo value={empresa.logo_url} className="h-14 w-auto max-w-36 object-contain rounded-lg shadow-sm" />
                  ) : (
                    <div className="w-14 h-14 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow">
                      {nomeEmpresa.slice(0, 2).toUpperCase()}
                    </div>
                  )
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900">{nomeEmpresa.toUpperCase()}</h3>
                  <p className="text-xs text-slate-500">{`CNPJ: ${cnpjFormatado} • ${registroEmpresa}`}</p>
                  <p className="text-xs text-slate-500">{`${emailEmpresa} • ${telefoneEmpresa}`}</p>
                </div>
              </div>

              <div className="text-right text-xs">
                <span className="bg-slate-100 text-slate-800 font-bold px-3 py-1 rounded border border-slate-200 uppercase">
                  PROPOSTA COMERCIAL
                </span>
                <div className="mt-2 font-mono text-slate-700 font-medium">
                  {proposta.numero ?? 'PROP-2026-0014'} · Rev. {proposta.revisaoNumero ?? 1}
                </div>
                <div className="text-slate-500">Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
                <div className="text-slate-700 font-semibold mt-0.5">Validade: {config.validadeTexto}</div>
              </div>
            </div>

            {/* DADOS DO CLIENTE E EMPREENDIMENTO */}
            {config.mostrarDadosCliente && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">CONTRATANTE / CLIENTE:</span>
<div className="font-bold text-slate-900 mt-0.5">{proposta.clienteNome || 'Cliente'}</div>
                  <div className="text-slate-600">CPF/CNPJ: {proposta.clienteCpfCnpj || '-'}</div>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">OBRA / LOCALIZAÇÃO:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{proposta.obraNome ?? 'Obra'}</div>
                  <div className="text-slate-600">Endereço: {proposta.obraEndereco || '-'}</div>
                  <div className="text-slate-600">Prazo Previsto: {config.prazoExecucaoTexto || '-'}</div>
                </div>
              </div>
            )}

            {/* TÍTULO E APRESENTAÇÃO */}
            <div>
              <h2 className="text-sm font-bold text-slate-900">{config.tituloProposta}</h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{config.textoApresentacao}</p>
            </div>

            {/* TABELA COMERCIAL DE SERVIÇOS */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                1. Planilha Orçamentária dos Serviços Propostos
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-900 text-white font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">Item</th>
                      <th className="py-2.5 px-3">Discriminação dos Serviços</th>
                      {config.mostrarQuantidades && (
                        <>
                          <th className="py-2.5 px-2 text-center w-14">Unid.</th>
                          <th className="py-2.5 px-3 text-right w-20">Qtde.</th>
                        </>
                      )}
                      {config.mostrarPrecoUnitario && (
                        <th className="py-2.5 px-3 text-right w-28">Preço Unit. (R$)</th>
                      )}
                      <th className="py-2.5 px-4 text-right w-32">Preço Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {etapasVisiveis.map((etapa) => (
                      <Fragment key={etapa.id}>
                        {/* Linha da Etapa */}
                        <tr className="bg-slate-100 font-bold text-slate-900">
                          <td className="py-2.5 px-3 text-center">{etapa.codigo}</td>
                          <td
                            className="py-2.5 px-3"
                            colSpan={
                              1 +
                              (config.mostrarQuantidades ? 2 : 0) +
                              (config.mostrarPrecoUnitario ? 1 : 0)
                            }
                          >
                            {etapa.nome}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {brl(etapa.valorTotalCentavos)}
                          </td>
                        </tr>

                        {/* Atividades detalhadas (se não estiver em modo apenas etapa) */}
                        {!config.mostrarApenasEtapa &&
                          etapa.atividades.map((atv, ai) => {
                            const desc = config.descricoesComerciais[atv.id] ?? atv.descricao
                            return (
                              <tr key={atv.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center text-slate-400">
                                  {atv.codigo ?? `${etapa.codigo}.${ai + 1}`}
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-900">{desc}</td>
                                {config.mostrarQuantidades && (
                                  <>
                                    <td className="py-2 px-2 text-center text-slate-500">{atv.unidade}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      {atv.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                    </td>
                                  </>
                                )}
                                {config.mostrarPrecoUnitario && (
                                  <td className="py-2 px-3 text-right tabular-nums">
                                    {brl(atv.precoUnitarioCentavos)}
                                  </td>
                                )}
                                <td className="py-2 px-4 text-right tabular-nums font-semibold">
                                  {brl(atv.precoTotalCentavos)}
                                </td>
                              </tr>
                            )
                          })}
                      </Fragment>
                    ))}
                  </tbody>

                  {/* Total Global da Proposta */}
                  <tfoot className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
                    <tr>
                      <td
                        colSpan={
                          2 +
                          (config.mostrarQuantidades ? 2 : 0) +
                          (config.mostrarPrecoUnitario ? 1 : 0)
                        }
                        className="py-3 px-4 text-right uppercase tracking-wider text-slate-300"
                      >
                        Valor Global da Proposta:
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-emerald-400 text-base">
                        {brl(valorTotalVisivelCentavos)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">
                * Todos os encargos sociais, tributos municipais e estaduais estão integralmente inclusos no valor global.
              </p>
            </div>

            {/* CONDIÇÕES COMERCIAIS E PRAZOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-200 text-xs">
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  2. Condições de Pagamento
                </h4>
                <div className="text-slate-600 whitespace-pre-line leading-relaxed">
                  {config.condicoesPagamentoTexto}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  3. Prazos e Vigência
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  <strong>Prazo de Execução:</strong> {config.prazoExecucaoTexto}
                  <br />
                  <strong>Validade da Proposta:</strong> {config.validadeTexto}
                </p>
              </div>
            </div>

            {/* TEXTO DE ENCERRAMENTO */}
            {config.textoEncerramento && (
              <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                {config.textoEncerramento}
              </p>
            )}

            {/* BLOCO DE ASSINATURAS */}
            {config.mostrarAssinaturas && (
              <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1" />
                  <strong className="text-slate-900">{nomeEmpresa}</strong>
                  <div className="text-slate-500 text-[11px]">Diretoria Técnica & Comercial</div>
                </div>
                <div>
                  <div className="border-b border-slate-400 w-48 mx-auto mb-1" />
                  <strong className="text-slate-900">{proposta.clienteNome ?? 'Cliente'}</strong>
                  <div className="text-slate-500 text-[11px]">De Acordo do Contratante</div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <HistoricoRevisoesProposta
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        revisoes={revisoes}
        revisaoSelecionadaId={revisaoSelecionadaId}
        onSelecionar={onSelecionarRevisao}
      />
    </div>
  )
}

