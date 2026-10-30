import { useEffect, useMemo, useState } from 'react'
import {
  Calculator,
  ChevronDown,
  ChevronRight,
  FileText,
  Gauge,
  Loader2,
  Settings2,
  Plus,
  Trash2,
  Download,
  Copy,
  History,
  Layers,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { calcularComposicao, calcularPrecoAtividade } from '@/lib/orcamento-analitico'
import { converterItensLegados, type ItemOrcamentoLegado } from '@/lib/orcamento-legado'
import { supabase as client } from '@/integrations/supabase/client.custom'
import { ResumoCustosPopover } from './resumo-custos-popover'
import { MemorialCalculoDialog, type LinhaMemorialEdicao } from './memorial-calculo-dialog'
import { ComposicaoCustoDialog, type InsumoEdicao } from './composicao-custo-dialog'
import { BdiConfigDialog } from './bdi-config-dialog'
import { CatalogoComposicoesDialog, type ComposicaoCatalogoItem } from './catalogo-composicoes-dialog'

const supabase = client as any
const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type Insumo = InsumoEdicao & { id: string }
type Memorial = LinhaMemorialEdicao & { id?: string }
type Atividade = {
  id: string
  codigo: string | null
  descricao: string
  unidade: string
  quantidade: number
  ordem: number
  fonte: string
  bdi?: number
  memoriais: Memorial[]
  insumos: Insumo[]
}
type Etapa = {
  id: string
  codigo: string
  nome: string
  ordem: number
  atividades: Atividade[]
}

interface OrcamentoAnaliticoViewProps {
  orcamentoId: string
  obraId?: string
  itens?: ItemOrcamentoLegado[]
  bdiInicial?: number
  somenteLeitura?: boolean
  onGerarProposta?: () => void
}

export function OrcamentoAnaliticoView({
  orcamentoId,
  obraId,
  itens = [],
  bdiInicial = 25,
  somenteLeitura = false,
  onGerarProposta,
}: OrcamentoAnaliticoViewProps) {
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [bdiGeral, setBdiGeral] = useState(bdiInicial)
  const [bdiOpen, setBdiOpen] = useState(false)
  const [catalogoOpen, setCatalogoOpen] = useState(false)
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false)
  const [novaAtividadeEtapaId, setNovaAtividadeEtapaId] = useState<string | null>(null)

  // Modais de detalhamento
  const [memorial, setMemorial] = useState<{ e: number; a: number } | null>(null)
  const [composicao, setComposicao] = useState<{ e: number; a: number } | null>(null)

  // Formulário de Nova Etapa
  const [novoCodigoEtapa, setNovoCodigoEtapa] = useState('')
  const [novoNomeEtapa, setNovoNomeEtapa] = useState('')

  // Formulário de Nova Atividade
  const [novaDescricaoAtividade, setNovaDescricaoAtividade] = useState('')
  const [novaUnidadeAtividade, setNovaUnidadeAtividade] = useState('un')
  const [novaQtdAtividade, setNovaQtdAtividade] = useState('1')
  const [novoCustoUnitarioAtividade, setNovoCustoUnitarioAtividade] = useState('100')

  useEffect(() => {
    void carregarOuMigrar()
  }, [orcamentoId])

  async function carregarOuMigrar() {
    setCarregando(true)
    try {
      let respEtapas = await supabase
        .from('orcamento_etapas')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('ordem')
      if (respEtapas.error) throw respEtapas.error

      // Se não há etapas mas há itens legados, migra uma única vez
      if (!respEtapas.data?.length && itens.length) {
        await migrarLegado()
        respEtapas = await supabase
          .from('orcamento_etapas')
          .select('*')
          .eq('orcamento_id', orcamentoId)
          .order('ordem')
        if (respEtapas.error) throw respEtapas.error
      }

      const etapaIds = (respEtapas.data ?? []).map((e: any) => e.id)
      const respAtividades = etapaIds.length
        ? await supabase
            .from('orcamento_atividades')
            .select('*')
            .in('etapa_id', etapaIds)
            .order('ordem')
        : { data: [], error: null }
      if (respAtividades.error) throw respAtividades.error

      const atividadeIds = (respAtividades.data ?? []).map((a: any) => a.id)
      const [respInsumos, respMemoriais] = atividadeIds.length
        ? await Promise.all([
            supabase
              .from('orcamento_atividade_insumos')
              .select('*')
              .in('atividade_id', atividadeIds)
              .order('ordem'),
            supabase
              .from('orcamento_memoriais')
              .select('*')
              .in('atividade_id', atividadeIds)
              .order('ordem'),
          ])
        : [{ data: [], error: null }, { data: [], error: null }]

      if (respInsumos.error) throw respInsumos.error
      if (respMemoriais.error) throw respMemoriais.error

      const arvore: Etapa[] = (respEtapas.data ?? []).map((e: any) => ({
        id: e.id,
        codigo: e.codigo,
        nome: e.nome,
        ordem: e.ordem,
        atividades: (respAtividades.data ?? [])
          .filter((a: any) => a.etapa_id === e.id)
          .map((a: any) => ({
            id: a.id,
            codigo: a.codigo,
            descricao: a.descricao,
            unidade: a.unidade,
            quantidade: Number(a.quantidade),
            ordem: a.ordem,
            fonte: a.fonte,
            bdi: a.bdi_percentual == null ? undefined : Number(a.bdi_percentual),
            insumos: (respInsumos.data ?? [])
              .filter((i: any) => i.atividade_id === a.id)
              .map((i: any) => ({
                id: i.id,
                codigo: i.codigo,
                descricao: i.descricao,
                unidade: i.unidade,
                categoria: i.categoria,
                coeficiente: Number(i.coeficiente),
                precoUnitarioCentavos: Number(i.preco_unitario_centavos),
              })),
            memoriais: (respMemoriais.data ?? [])
              .filter((m: any) => m.atividade_id === a.id)
              .map((m: any) => ({
                id: m.id,
                descricao: m.descricao,
                formula: m.formula,
                resultado: Number(m.resultado),
              })),
          })),
      }))

      setEtapas(arvore)
      // Mantém todas as etapas abertas inicialmente
      setAbertas(new Set(arvore.map((e) => e.codigo)))
    } catch (e) {
      toast.error(`Falha ao carregar o orçamento analítico: ${(e as Error).message}`)
    } finally {
      setCarregando(false)
    }
  }

  async function migrarLegado() {
    const convertido = converterItensLegados(itens)
    for (const etapa of convertido.etapas) {
      const e = await supabase
        .from('orcamento_etapas')
        .insert({
          orcamento_id: orcamentoId,
          codigo: etapa.codigo,
          nome: etapa.nome,
          ordem: etapa.ordem,
        })
        .select('id')
        .single()
      if (e.error) throw e.error

      for (const atividade of etapa.atividades) {
        const a = await supabase
          .from('orcamento_atividades')
          .insert({
            etapa_id: e.data.id,
            codigo: atividade.codigo,
            descricao: atividade.descricao,
            unidade: atividade.unidade,
            quantidade: atividade.quantidade,
            ordem: atividade.ordem,
            fonte: atividade.fonte,
            legado_conferir: true,
          })
          .select('id')
          .single()
        if (a.error) throw a.error

        const i = atividade.insumos[0]
        const r = await supabase.from('orcamento_atividade_insumos').insert({
          atividade_id: a.data.id,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          categoria: i.categoria,
          coeficiente: i.coeficiente,
          preco_unitario_centavos: i.precoUnitarioCentavos,
          ordem: 0,
        })
        if (r.error) throw r.error
      }
    }
    const r = await supabase
      .from('orcamentos')
      .update({ analitico_ativo: true, bdi_geral: bdiGeral })
      .eq('id', orcamentoId)
    if (r.error) throw r.error
  }

  const atualizarLocal = (e: number, a: number, patch: Partial<Atividade>) =>
    setEtapas((x) =>
      x.map((et, ei) =>
        ei !== e
          ? et
          : { ...et, atividades: et.atividades.map((at, ai) => (ai === a ? { ...at, ...patch } : at)) }
      )
    )

  async function salvarAtividade(e: number, a: number, patch: Partial<Atividade>) {
    atualizarLocal(e, a, patch)
    const db: any = {}
    if (patch.descricao !== undefined) db.descricao = patch.descricao
    if (patch.quantidade !== undefined) db.quantidade = patch.quantidade
    if (patch.bdi !== undefined) db.bdi_percentual = patch.bdi
    const r = await supabase.from('orcamento_atividades').update(db).eq('id', etapas[e].atividades[a].id)
    if (r.error) {
      toast.error(r.error.message)
      void carregarOuMigrar()
    }
  }

  async function salvarMemorial(e: number, a: number, linhas: LinhaMemorialEdicao[]) {
    const atividade = etapas[e].atividades[a]
    const quantidade = linhas.reduce((s, l) => s + l.resultado, 0)
    const d = await supabase.from('orcamento_memoriais').delete().eq('atividade_id', atividade.id)
    if (d.error) return toast.error(d.error.message)
    if (linhas.length) {
      const r = await supabase
        .from('orcamento_memoriais')
        .insert(linhas.map((l, ordem) => ({ atividade_id: atividade.id, ...l, ordem })))
      if (r.error) return toast.error(r.error.message)
    }
    await salvarAtividade(e, a, { memoriais: linhas, quantidade })
    toast.success('Memorial de cálculo salvo')
  }

  async function salvarInsumos(e: number, a: number, insumos: InsumoEdicao[]) {
    const atuais = etapas[e].atividades[a].insumos
    const linhas = insumos.map((i, ordem) => ({
      id: atuais[ordem]?.id,
      atividade_id: etapas[e].atividades[a].id,
      codigo: i.codigo,
      descricao: i.descricao,
      unidade: i.unidade,
      categoria: i.categoria,
      coeficiente: i.coeficiente,
      preco_unitario_centavos: i.precoUnitarioCentavos,
      ordem,
    }))
    const r = await supabase.from('orcamento_atividade_insumos').upsert(linhas).select('*')
    if (r.error) return toast.error(r.error.message)
    atualizarLocal(e, a, {
      insumos: r.data.map((i: any) => ({
        id: i.id,
        codigo: i.codigo,
        descricao: i.descricao,
        unidade: i.unidade,
        categoria: i.categoria,
        coeficiente: Number(i.coeficiente),
        precoUnitarioCentavos: Number(i.preco_unitario_centavos),
      })),
    })
    toast.success('Composição de custos atualizada')
  }

  async function salvarBdi(v: number) {
    setBdiGeral(v)
    const r = await supabase.from('orcamentos').update({ bdi_geral: v }).eq('id', orcamentoId)
    r.error ? toast.error(r.error.message) : toast.success('BDI salvo com sucesso')
  }

  // Criar Etapa
  async function criarEtapa() {
    if (!novoCodigoEtapa.trim() || !novoNomeEtapa.trim()) {
      return toast.error('Informe o código e o nome da etapa.')
    }
    const ordem = etapas.length + 1
    const { data, error } = await supabase
      .from('orcamento_etapas')
      .insert({
        orcamento_id: orcamentoId,
        codigo: novoCodigoEtapa.trim(),
        nome: novoNomeEtapa.trim(),
        ordem,
      })
      .select('*')
      .single()

    if (error) return toast.error(error.message)
    setEtapas((prev) => [
      ...prev,
      {
        id: data.id,
        codigo: data.codigo,
        nome: data.nome,
        ordem: data.ordem,
        atividades: [],
      },
    ])
    setAbertas((prev) => new Set([...prev, data.codigo]))
    setNovaEtapaOpen(false)
    setNovoCodigoEtapa('')
    setNovoNomeEtapa('')
    toast.success('Etapa criada com sucesso')
  }

  // Criar Atividade Própria na Etapa
  async function criarAtividadePropria() {
    if (!novaAtividadeEtapaId) return
    if (!novaDescricaoAtividade.trim()) return toast.error('Informe a descrição da atividade.')

    const qtd = Math.max(0.0001, Number(novaQtdAtividade) || 1)
    const custoCentavos = Math.max(0, Math.round(Number(novoCustoUnitarioAtividade) * 100))
    const etapaIndex = etapas.findIndex((e) => e.id === novaAtividadeEtapaId)
    if (etapaIndex === -1) return

    const ordem = etapas[etapaIndex].atividades.length + 1
    const codigo = `${etapas[etapaIndex].codigo}.${String(ordem).padStart(2, '0')}`

    const { data: atv, error: atvErr } = await supabase
      .from('orcamento_atividades')
      .insert({
        etapa_id: novaAtividadeEtapaId,
        codigo,
        descricao: novaDescricaoAtividade.trim(),
        unidade: novaUnidadeAtividade.trim(),
        quantidade: qtd,
        ordem,
        fonte: 'propria',
      })
      .select('*')
      .single()

    if (atvErr) return toast.error(atvErr.message)

    // Insere insumo padrão inicial
    await supabase.from('orcamento_atividade_insumos').insert({
      atividade_id: atv.id,
      codigo: 'IN-01',
      descricao: novaDescricaoAtividade.trim(),
      unidade: novaUnidadeAtividade.trim(),
      categoria: 'material',
      coeficiente: 1,
      preco_unitario_centavos: custoCentavos,
      ordem: 0,
    })

    await carregarOuMigrar()
    setNovaAtividadeEtapaId(null)
    setNovaDescricaoAtividade('')
    toast.success('Atividade inserida com sucesso')
  }

  // Inserir Composição do Catálogo (SINAPI ou Própria)
  async function inserirComposicaoDoCatalogo(comp: ComposicaoCatalogoItem, etapaAlvoId: string) {
    const etapaIndex = etapas.findIndex((e) => e.id === etapaAlvoId)
    if (etapaIndex === -1) return

    const ordem = etapas[etapaIndex].atividades.length + 1
    const { data: atv, error: atvErr } = await supabase
      .from('orcamento_atividades')
      .insert({
        etapa_id: etapaAlvoId,
        codigo: comp.codigo,
        descricao: comp.descricao,
        unidade: comp.unidade,
        quantidade: 1,
        ordem,
        fonte: comp.fonte,
      })
      .select('*')
      .single()

    if (atvErr) return toast.error(atvErr.message)

    // Se possui insumos detalhados no catálogo, copia-os; caso contrário, cria insumos com o preço unitário
    const insumosParaInserir = comp.insumos?.length
      ? comp.insumos.map((i, idx) => ({
          atividade_id: atv.id,
          codigo: i.codigo,
          descricao: i.descricao,
          unidade: i.unidade,
          categoria: i.categoria,
          coeficiente: i.coeficiente,
          preco_unitario_centavos: i.precoUnitarioCentavos,
          ordem: idx,
        }))
      : [
          {
            atividade_id: atv.id,
            codigo: comp.codigo,
            descricao: comp.descricao,
            unidade: comp.unidade,
            categoria: 'material',
            coeficiente: 1,
            preco_unitario_centavos: comp.valorUnitarioCentavos,
            ordem: 0,
          },
        ]

    await supabase.from('orcamento_atividade_insumos').insert(insumosParaInserir)
    await carregarOuMigrar()
    toast.success(`Composição ${comp.codigo} inserida com sucesso`)
  }

  // Excluir Atividade
  async function excluirAtividade(atividadeId: string) {
    if (!confirm('Deseja realmente remover esta atividade do orçamento?')) return
    const { error } = await supabase.from('orcamento_atividades').delete().eq('id', atividadeId)
    if (error) return toast.error(error.message)
    await carregarOuMigrar()
    toast.success('Atividade removida')
  }

  // Resumo de Custos
  const resumo = (a: Atividade) => calcularComposicao(a.insumos)

  const totais = useMemo(() => {
    return etapas
      .flatMap((e) => e.atividades)
      .reduce(
        (x, a) => {
          const c = resumo(a)
          const p = calcularPrecoAtividade({
            custoUnitarioCentavos: c.totalCentavos,
            quantidade: a.quantidade,
            bdiPercentual: a.bdi ?? bdiGeral,
          })
          x.custo += p.custoTotalCentavos
          x.preco += p.precoTotalCentavos
          x.maoDeObraCentavos += Math.round(c.maoDeObraCentavos * a.quantidade)
          x.materialCentavos += Math.round(c.materialCentavos * a.quantidade)
          x.equipamentoCentavos += Math.round(c.equipamentoCentavos * a.quantidade)
          x.outrosCentavos += Math.round(c.outrosCentavos * a.quantidade)
          x.totalCentavos = x.custo
          return x
        },
        {
          custo: 0,
          preco: 0,
          maoDeObraCentavos: 0,
          materialCentavos: 0,
          equipamentoCentavos: 0,
          outrosCentavos: 0,
          totalCentavos: 0,
        }
      )
  }, [etapas, bdiGeral])

  const bdiEfetivo =
    totais.custo > 0 ? (((totais.preco - totais.custo) / totais.custo) * 100).toFixed(2) : '0,00'

  if (carregando) {
    return (
      <div className="flex min-h-64 items-center justify-center bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
        <Loader2 className="mr-3 size-6 animate-spin text-sky-600" />
        <span className="text-sm font-medium text-slate-700">Carregando orçamento analítico...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5" data-testid="orcamento-analitico">
      {/* Subtítulo da Competência SINAPI Oficial Congelada */}
      <div className="text-xs text-sky-800 font-medium">
        Base SINAPI atualizada automaticamente - MG · 09/2025 - orçamento congelado nesta competência
      </div>

      {/* BLOCO SUPERIOR: BDI, PREÇO AO CLIENTE E BOTÕES DE AÇÃO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              BDI GERAL
            </label>
            <div className="flex items-center">
              <Input
                type="text"
                disabled={somenteLeitura}
                value={`${bdiGeral}%`}
                onClick={() => setBdiOpen(true)}
                readOnly
                className="w-28 text-sm font-bold text-slate-900 bg-white border-slate-300 shadow-sm cursor-pointer hover:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              PREÇO AO CLIENTE
            </label>
            <Input
              type="text"
              value={brl(totais.preco)}
              readOnly
              className="w-44 text-sm font-black text-slate-900 bg-white border-slate-300 shadow-sm tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800">
            Importar Excel
          </Button>
          <Button variant="outline" size="sm" className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800">
            Duplicar orçamento
          </Button>
          <Button
            size="sm"
            disabled={somenteLeitura}
            onClick={() => {
              setNovoCodigoEtapa(String(etapas.length + 1))
              setNovoNomeEtapa('')
              setNovaEtapaOpen(true)
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            + Inserir etapa
          </Button>
          <Button
            size="sm"
            disabled={somenteLeitura}
            onClick={() => setCatalogoOpen(true)}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Sparkles className="size-3.5" />
            + Inserir composição
          </Button>

          {/* Engrenagem de Opções Técnicas */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50">
                <Settings2 className="size-4 text-slate-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-xs bg-white text-slate-900 border border-slate-200 shadow-xl">
              <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400">
                Ações Técnicas do Orçamento
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setBdiOpen(true)}>
                <Gauge className="mr-2 size-3.5 text-sky-600" />
                Configurar BDI (Geral e Categorias)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCatalogoOpen(true)}>
                <Sparkles className="mr-2 size-3.5 text-sky-600" />
                Bases e Competências SINAPI
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info('Exportando planilha sintética...')}>
                <Download className="mr-2 size-3.5 text-emerald-600" />
                Exportação Sintética (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Exportando planilha analítica...')}>
                <Download className="mr-2 size-3.5 text-emerald-600" />
                Exportação Analítica (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info('Exportando memoriais de quantidade...')}>
                <Download className="mr-2 size-3.5 text-emerald-600" />
                Exportação dos Memoriais (XLSX)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onGerarProposta && (
                <DropdownMenuItem onClick={onGerarProposta} className="font-semibold text-sky-700">
                  <FileText className="mr-2 size-3.5" />
                  Gerar Proposta da Revisão
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ESTADO VAZIO: Quando a nova obra não possui etapas */}
      {etapas.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-12 text-center max-w-3xl mx-auto space-y-4 shadow-sm my-8">
          <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto text-2xl font-bold">
            📋
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Este orçamento ainda não possui etapas nem atividades
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Inicie adicionando a primeira etapa (ex: Serviços Preliminares) ou importe uma composição do catálogo unificado SINAPI/Base própria.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Button
              onClick={() => {
                setNovoCodigoEtapa('01')
                setNovoNomeEtapa('SERVIÇOS PRELIMINARES')
                setNovaEtapaOpen(true)
              }}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold px-5 py-2.5 shadow-sm"
            >
              + Adicionar Etapa
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setNovoCodigoEtapa('01')
                setNovoNomeEtapa('SERVIÇOS GERAIS')
                setNovaEtapaOpen(true)
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300 text-xs font-semibold px-5 py-2.5 shadow-sm"
            >
              + Adicionar Atividade Própria
            </Button>
            <Button
              onClick={() => setCatalogoOpen(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-5 py-2.5 shadow-sm"
            >
              Buscar Composição SINAPI
            </Button>
          </div>
        </div>
      ) : (
        /* TABELA ANALÍTICA PRINCIPAL (IDÊNTICA À FOTO 1) */
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-xs text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-sky-600 text-white font-bold">
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4 w-28 text-center">Qtd.</th>
                <th className="py-3 px-4 w-32 text-center">Custo unit.</th>
                <th className="py-3 px-4 w-32 text-right">Custo total</th>
                <th className="py-3 px-4 w-24 text-center">BDI</th>
                <th className="py-3 px-4 w-36 text-right">Preço total</th>
                <th className="py-3 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {etapas.map((etapa, ei) => {
                const aberta = abertas.has(etapa.codigo)
                const valoresEtapa = etapa.atividades.reduce(
                  (x, a) => {
                    const c = resumo(a)
                    const p = calcularPrecoAtividade({
                      custoUnitarioCentavos: c.totalCentavos,
                      quantidade: a.quantidade,
                      bdiPercentual: a.bdi ?? bdiGeral,
                    })
                    x.c += p.custoTotalCentavos
                    x.p += p.precoTotalCentavos
                    return x
                  },
                  { c: 0, p: 0 }
                )

                const bdiEtapaEfetivo =
                  valoresEtapa.c > 0
                    ? (((valoresEtapa.p - valoresEtapa.c) / valoresEtapa.c) * 100).toFixed(2)
                    : `${bdiGeral},00`

                return (
                  <div key={etapa.id} className="contents">
                    {/* LINHA DA ETAPA */}
                    <tr className="bg-slate-100/90 font-bold text-slate-900 border-t border-slate-200">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left font-bold text-slate-900 hover:text-sky-700"
                          onClick={() =>
                            setAbertas((s) => {
                              const n = new Set(s)
                              n.has(etapa.codigo) ? n.delete(etapa.codigo) : n.add(etapa.codigo)
                              return n
                            })
                          }
                        >
                          {aberta ? <ChevronDown className="size-4 text-slate-600" /> : <ChevronRight className="size-4 text-slate-600" />}
                          <span>
                            {etapa.codigo} · {etapa.nome}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">-</td>
                      <td className="py-3 px-4 text-center">-</td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        {brl(valoresEtapa.c)}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-700">
                        {bdiEtapaEfetivo}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-900 font-bold">
                        {brl(valoresEtapa.p)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[11px] text-sky-700 hover:text-sky-900 hover:bg-sky-50 h-7 px-2"
                          onClick={() => setNovaAtividadeEtapaId(etapa.id)}
                          title="Adicionar atividade nesta etapa"
                        >
                          + Ativ.
                        </Button>
                      </td>
                    </tr>

                    {/* ITENS / ATIVIDADES DA ETAPA */}
                    {aberta &&
                      etapa.atividades.map((a, ai) => {
                        const c = resumo(a)
                        const p = calcularPrecoAtividade({
                          custoUnitarioCentavos: c.totalCentavos,
                          quantidade: a.quantidade,
                          bdiPercentual: a.bdi ?? bdiGeral,
                        })

                        return (
                          <tr key={a.id} className="hover:bg-slate-50 transition border-b border-slate-100">
                            <td className="py-3 px-4">
                              <Input
                                disabled={somenteLeitura}
                                value={a.descricao}
                                onChange={(ev) => atualizarLocal(ei, ai, { descricao: ev.target.value })}
                                onBlur={(ev) => void salvarAtividade(ei, ai, { descricao: ev.target.value })}
                                className="h-7 border-transparent hover:border-slate-300 focus:border-sky-500 px-1 font-semibold text-slate-900 text-xs bg-transparent"
                              />
                              <div className="text-[11px] text-slate-500 mt-0.5 px-1">
                                {a.insumos.length} insumos ·{' '}
                                {a.memoriais.length ? `${a.memoriais.length} parcelas no memorial` : 'quantidade direta'}
                              </div>
                              <div className="mt-1 px-1">
                                <span
                                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    a.fonte === 'sinapi'
                                      ? 'bg-sky-100 text-sky-800 border-sky-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-300'
                                  }`}
                                >
                                  {a.fonte === 'sinapi' ? 'SINAPI · ADAPTADA' : 'BASE PRÓPRIA'}
                                </span>
                              </div>
                            </td>

                            {/* Quantidade com Memorial */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                disabled={somenteLeitura}
                                onClick={() => setMemorial({ e: ei, a: ai })}
                                className="text-sky-700 font-semibold underline underline-offset-2 hover:text-sky-900 tabular-nums"
                                title="Abrir memorial de cálculo"
                              >
                                {a.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {a.unidade}
                              </button>
                            </td>

                            {/* Custo Unitário Clicável */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                disabled={somenteLeitura}
                                onClick={() => setComposicao({ e: ei, a: ai })}
                                className="text-sky-700 font-semibold underline underline-offset-2 hover:text-sky-900 tabular-nums"
                                title="Ver e editar composição de custos"
                              >
                                {brl(c.totalCentavos)} ↗
                              </button>
                            </td>

                            {/* Custo Total com Hover Popover */}
                            <td className="py-3 px-4 text-right tabular-nums text-slate-700 font-medium">
                              <ResumoCustosPopover
                                resumo={{ ...c, totalCentavos: p.custoTotalCentavos }}
                                titulo={a.descricao}
                                subtitulo={`Item ${a.codigo ?? `${etapa.codigo}.${ai + 1}`}`}
                              >
                                <span className="cursor-help underline decoration-dotted hover:text-slate-900">
                                  {brl(p.custoTotalCentavos)}
                                </span>
                              </ResumoCustosPopover>
                            </td>

                            {/* BDI Individual da Atividade */}
                            <td className="py-3 px-4 text-center">
                              <Input
                                disabled={somenteLeitura}
                                type="number"
                                value={a.bdi ?? bdiGeral}
                                onChange={(ev) =>
                                  atualizarLocal(ei, ai, { bdi: Number(ev.target.value) })
                                }
                                onBlur={(ev) =>
                                  void salvarAtividade(ei, ai, { bdi: Math.max(0, Number(ev.target.value)) })
                                }
                                className="h-7 w-16 text-center text-xs bg-white text-slate-900 border-slate-300 mx-auto font-medium"
                              />
                            </td>

                            {/* Preço Total ao Cliente */}
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                              {brl(p.precoTotalCentavos)}
                            </td>

                            {/* Ações */}
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                disabled={somenteLeitura}
                                onClick={() => excluirAtividade(a.id)}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="Remover atividade"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                  </div>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RODAPÉ TOTALIZADOR (IDÊNTICO À FOTO 1) */}
      <div className="flex flex-wrap items-center justify-end gap-10 pt-4 pr-2 text-xs">
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CUSTO TOTAL</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums">{brl(totais.custo)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BDI EFETIVO</div>
          <div className="text-lg font-bold text-slate-800 tabular-nums">{bdiEfetivo}%</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">PREÇO AO CLIENTE</div>
          <div className="text-2xl font-black text-sky-700 tabular-nums">{brl(totais.preco)}</div>
        </div>
      </div>

      {/* DIÁLOGOS DE SUPORTE */}
      <BdiConfigDialog
        open={bdiOpen}
        onOpenChange={setBdiOpen}
        valor={bdiGeral}
        onSalvar={(v) => void salvarBdi(v)}
      />

      {memorial && (
        <MemorialCalculoDialog
          open
          onOpenChange={(v) => !v && setMemorial(null)}
          titulo={etapas[memorial.e].atividades[memorial.a].descricao}
          unidade={etapas[memorial.e].atividades[memorial.a].unidade}
          linhas={etapas[memorial.e].atividades[memorial.a].memoriais}
          onSalvar={(linhas) => void salvarMemorial(memorial.e, memorial.a, linhas)}
        />
      )}

      {composicao && (
        <ComposicaoCustoDialog
          open
          onOpenChange={(v) => !v && setComposicao(null)}
          codigo={etapas[composicao.e].atividades[composicao.a].codigo}
          descricao={etapas[composicao.e].atividades[composicao.a].descricao}
          fonte={etapas[composicao.e].atividades[composicao.a].fonte}
          insumos={etapas[composicao.e].atividades[composicao.a].insumos}
          onAlterar={(insumos) => void salvarInsumos(composicao.e, composicao.a, insumos)}
        />
      )}

      <CatalogoComposicoesDialog
        open={catalogoOpen}
        onOpenChange={setCatalogoOpen}
        etapas={etapas.map((e) => ({ id: e.id, codigo: e.codigo, nome: e.nome }))}
        onInserir={(comp, etapaId) => void inserirComposicaoDoCatalogo(comp, etapaId)}
      />

      {/* Modal Nova Etapa */}
      <Dialog open={novaEtapaOpen} onOpenChange={setNovaEtapaOpen}>
        <DialogContent className="max-w-md bg-white text-slate-900 border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Adicionar Nova Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Código da Etapa (Ex: 01, 02):</label>
              <Input
                value={novoCodigoEtapa}
                onChange={(e) => setNovoCodigoEtapa(e.target.value)}
                placeholder="01"
                className="h-8 text-xs bg-white text-slate-900 border-slate-300"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Nome da Etapa:</label>
              <Input
                value={novoNomeEtapa}
                onChange={(e) => setNovoNomeEtapa(e.target.value)}
                placeholder="Ex: SERVIÇOS PRELIMINARES"
                className="h-8 text-xs bg-white text-slate-900 border-slate-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNovaEtapaOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={criarEtapa} className="bg-sky-600 hover:bg-sky-700 text-white">
              Salvar Etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Nova Atividade Própria */}
      <Dialog open={!!novaAtividadeEtapaId} onOpenChange={(v) => !v && setNovaAtividadeEtapaId(null)}>
        <DialogContent className="max-w-md bg-white text-slate-900 border border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Inserir Atividade na Etapa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Descrição do Serviço:</label>
              <Input
                value={novaDescricaoAtividade}
                onChange={(e) => setNovaDescricaoAtividade(e.target.value)}
                placeholder="Ex: Limpeza manual de terreno"
                className="h-8 text-xs bg-white text-slate-900 border-slate-300"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Unidade:</label>
                <Input
                  value={novaUnidadeAtividade}
                  onChange={(e) => setNovaUnidadeAtividade(e.target.value)}
                  placeholder="m²"
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Quantidade:</label>
                <Input
                  type="number"
                  value={novaQtdAtividade}
                  onChange={(e) => setNovaQtdAtividade(e.target.value)}
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Custo Unit. (R$):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={novoCustoUnitarioAtividade}
                  onChange={(e) => setNovoCustoUnitarioAtividade(e.target.value)}
                  className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNovaAtividadeEtapaId(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={criarAtividadePropria} className="bg-sky-600 hover:bg-sky-700 text-white">
              Adicionar Atividade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
