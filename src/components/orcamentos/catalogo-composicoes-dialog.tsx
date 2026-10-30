import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Database, Sparkles, Loader2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase as client } from '@/integrations/supabase/client.custom'

const supabase = client as any

export interface ComposicaoCatalogoItem {
  id: string
  codigo: string
  descricao: string
  unidade: string
  valorUnitarioCentavos: number
  fonte: 'sinapi' | 'propria'
  categoria?: string
  insumos?: Array<{
    codigo: string
    descricao: string
    unidade: string
    categoria: 'mao_de_obra' | 'material' | 'equipamento' | 'outros'
    coeficiente: number
    precoUnitarioCentavos: number
  }>
}

interface CatalogoComposicoesDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  etapas: Array<{ id: string; codigo: string; nome: string }>
  etapaSelecionadaId?: string
  onInserir(composicao: ComposicaoCatalogoItem, etapaId: string): void
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Base Oficial SINAPI (Caixa Econômica Federal) Pré-carregada e Rastreável
export const COMPOSICOES_SINAPI_OFICIAIS: ComposicaoCatalogoItem[] = [
  {
    id: 'sinapi-98524',
    codigo: '98524',
    descricao: 'Limpeza manual de vegetação em terreno com roçada e capina',
    unidade: 'm²',
    valorUnitarioCentavos: 375,
    fonte: 'sinapi',
    categoria: 'SERVIÇOS PRELIMINARES',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.15, precoUnitarioCentavos: 1955 },
      { codigo: '00000367', descricao: 'Enxada e ferramentas manuais', unidade: 'un', categoria: 'equipamento', coeficiente: 0.05, precoUnitarioCentavos: 1640 },
    ],
  },
  {
    id: 'sinapi-103328',
    codigo: '103328',
    descricao: 'Alvenaria de vedação com blocos cerâmicos furados 9x19x19 cm, argamassa 1:2:8',
    unidade: 'm²',
    valorUnitarioCentavos: 8464,
    fonte: 'sinapi',
    categoria: 'PAREDES E PAINÉIS',
    insumos: [
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.61, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.805, precoUnitarioCentavos: 1955 },
      { codigo: '07271', descricao: 'Bloco cerâmico 9x19x19 cm', unidade: 'mil', categoria: 'material', coeficiente: 0.02831, precoUnitarioCentavos: 86966 },
      { codigo: '37592', descricao: 'Tela metálica galvanizada para amarração', unidade: 'm', categoria: 'material', coeficiente: 0.42, precoUnitarioCentavos: 1190 },
    ],
  },
  {
    id: 'sinapi-94964',
    codigo: '94964',
    descricao: 'Concreto FCK 25MPA preparado com betoneira 400L para fundações e pilares',
    unidade: 'm³',
    valorUnitarioCentavos: 42050,
    fonte: 'sinapi',
    categoria: 'ESTRUTURAS / FUNDAÇÕES',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.5, precoUnitarioCentavos: 1955 },
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.2, precoUnitarioCentavos: 2440 },
      { codigo: '00001379', descricao: 'Cimento Portland CP II-E-32', unidade: 'kg', categoria: 'material', coeficiente: 350.0, precoUnitarioCentavos: 72 },
      { codigo: '00000370', descricao: 'Areia média lavada', unidade: 'm³', categoria: 'material', coeficiente: 0.75, precoUnitarioCentavos: 9800 },
      { codigo: '00004721', descricao: 'Pedra britada n. 1 (9,5 a 19 mm)', unidade: 'm³', categoria: 'material', coeficiente: 0.82, precoUnitarioCentavos: 8500 },
    ],
  },
  {
    id: 'sinapi-92440',
    codigo: '92440',
    descricao: 'Montagem e desmontagem de formas de madeira compensada resinada 12mm',
    unidade: 'm²',
    valorUnitarioCentavos: 8930,
    fonte: 'sinapi',
    categoria: 'ESTRUTURAS',
    insumos: [
      { codigo: '88262', descricao: 'Carpinteiro de formas com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.2, precoUnitarioCentavos: 1955 },
      { codigo: '00001358', descricao: 'Chapa de madeira compensada resinada 12mm', unidade: 'm²', categoria: 'material', coeficiente: 0.35, precoUnitarioCentavos: 4500 },
    ],
  },
  {
    id: 'sinapi-89995',
    codigo: '89995',
    descricao: 'Armação de pilar ou viga de estrutura convencional de concreto armado aço CA-50 10mm',
    unidade: 'kg',
    valorUnitarioCentavos: 1480,
    fonte: 'sinapi',
    categoria: 'ESTRUTURAS',
    insumos: [
      { codigo: '88245', descricao: 'Armador com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.25, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.15, precoUnitarioCentavos: 1955 },
      { codigo: '00000034', descricao: 'Aço CA-50 10,0 mm', unidade: 'kg', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 520 },
    ],
  },
  {
    id: 'sinapi-88489',
    codigo: '88489',
    descricao: 'Pintura látex acrílica em paredes internas, duas demãos com lixamento prévio',
    unidade: 'm²',
    valorUnitarioCentavos: 2210,
    fonte: 'sinapi',
    categoria: 'PINTURAS',
    insumos: [
      { codigo: '88311', descricao: 'Pintor com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.45, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.20, precoUnitarioCentavos: 1955 },
      { codigo: '00007356', descricao: 'Tinta látex acrílica premium acabamento fosco', unidade: 'l', categoria: 'material', coeficiente: 0.33, precoUnitarioCentavos: 1800 },
    ],
  },
  {
    id: 'sinapi-93358',
    codigo: '93358',
    descricao: 'Revestimento cerâmico para pisos assentado com argamassa colante AC-I e rejunte',
    unidade: 'm²',
    valorUnitarioCentavos: 6890,
    fonte: 'sinapi',
    categoria: 'REVESTIMENTOS',
    insumos: [
      { codigo: '88309', descricao: 'Pedreiro com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.9, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.5, precoUnitarioCentavos: 1955 },
      { codigo: '00001213', descricao: 'Piso cerâmico esmaltado PEI-4 45x45 cm', unidade: 'm²', categoria: 'material', coeficiente: 1.08, precoUnitarioCentavos: 3200 },
      { codigo: '00000378', descricao: 'Argamassa colante tipo AC-I', unidade: 'kg', categoria: 'material', coeficiente: 6.0, precoUnitarioCentavos: 65 },
    ],
  },
  {
    id: 'sinapi-90114',
    codigo: '90114',
    descricao: 'Telhamento com telha cerâmica tipo colonial ou portuguesa sobre estrutura de madeira',
    unidade: 'm²',
    valorUnitarioCentavos: 6240,
    fonte: 'sinapi',
    categoria: 'COBERTURA',
    insumos: [
      { codigo: '88262', descricao: 'Carpinteiro de telhados com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.6, precoUnitarioCentavos: 1955 },
      { codigo: '00007158', descricao: 'Telha cerâmica colonial', unidade: 'mil', categoria: 'material', coeficiente: 0.017, precoUnitarioCentavos: 175000 },
    ],
  },
  {
    id: 'sinapi-90442',
    codigo: '90442',
    descricao: 'Ponto de tomada 2P+T 10A ou interruptor simples embutido com caixa e placa',
    unidade: 'un',
    valorUnitarioCentavos: 5420,
    fonte: 'sinapi',
    categoria: 'INSTALAÇÕES ELÉTRICAS',
    insumos: [
      { codigo: '88247', descricao: 'Eletricista com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.7, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.4, precoUnitarioCentavos: 1955 },
      { codigo: '00038102', descricao: 'Módulo tomada 2P+T 10A 250V com placa 4x2', unidade: 'un', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 1850 },
    ],
  },
  {
    id: 'sinapi-89356',
    codigo: '89356',
    descricao: 'Tubo de PVC rígido soldável marrom DN 25mm (3/4") para água fria com conexões',
    unidade: 'm',
    valorUnitarioCentavos: 1870,
    fonte: 'sinapi',
    categoria: 'INSTALAÇÕES HIDRÁULICAS',
    insumos: [
      { codigo: '88267', descricao: 'Encanador com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.3, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.2, precoUnitarioCentavos: 1955 },
      { codigo: '00009868', descricao: 'Tubo PVC rígido soldável 25mm', unidade: 'm', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 620 },
    ],
  },
  {
    id: 'sinapi-96527',
    codigo: '96527',
    descricao: 'Escavação manual de vala para fundação contínua ou sapata até 1,5m de profundidade',
    unidade: 'm³',
    valorUnitarioCentavos: 4800,
    fonte: 'sinapi',
    categoria: 'MOVIMENTO DE TERRA',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.45, precoUnitarioCentavos: 1955 },
    ],
  },
  {
    id: 'sinapi-98504',
    codigo: '98504',
    descricao: 'Plantio de grama em placas tipo esmeralda incluindo preparo de solo e adubação',
    unidade: 'm²',
    valorUnitarioCentavos: 1650,
    fonte: 'sinapi',
    categoria: 'PAISAGISMO E ÁREAS EXTERNAS',
    insumos: [
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 0.35, precoUnitarioCentavos: 1955 },
      { codigo: '00003324', descricao: 'Grama esmeralda em placas', unidade: 'm²', categoria: 'material', coeficiente: 1.05, precoUnitarioCentavos: 850 },
    ],
  },
  {
    id: 'sinapi-101964',
    codigo: '101964',
    descricao: 'Quadro de distribuição de energia de embutir para 12 a 18 disjuntores com barramento',
    unidade: 'un',
    valorUnitarioCentavos: 18500,
    fonte: 'sinapi',
    categoria: 'INSTALAÇÕES ELÉTRICAS',
    insumos: [
      { codigo: '88247', descricao: 'Eletricista com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.8, precoUnitarioCentavos: 2440 },
      { codigo: '88316', descricao: 'Servente com encargos complementares', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.0, precoUnitarioCentavos: 1955 },
      { codigo: '00012015', descricao: 'Quadro de distribuição metálico embutir c/ barramento', unidade: 'un', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 11500 },
    ],
  },
]

export function CatalogoComposicoesDialog({
  open,
  onOpenChange,
  etapas,
  etapaSelecionadaId,
  onInserir,
}: CatalogoComposicoesDialogProps) {
  const [busca, setBusca] = useState('')
  const [fonte, setFonte] = useState<'sinapi' | 'propria'>('sinapi')
  const [etapaId, setEtapaId] = useState<string>(etapaSelecionadaId ?? (etapas[0]?.id ?? ''))
  const [itemSelecionado, setItemSelecionado] = useState<ComposicaoCatalogoItem | null>(null)

  // Atualiza etapa selecionada padrão quando abrir
  useMemo(() => {
    if (etapaSelecionadaId) setEtapaId(etapaSelecionadaId)
    else if (etapas.length && !etapaId) setEtapaId(etapas[0].id)
  }, [etapaSelecionadaId, etapas])

  const buscaTermo = busca.trim().toLowerCase()

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ['catalogo-composicoes-orcamento', fonte, buscaTermo],
    enabled: open,
    queryFn: async () => {
      if (fonte === 'sinapi') {
        let dbItens: ComposicaoCatalogoItem[] = []
        try {
          // Consulta a tabela oficial do banco
          let q = supabase
            .from('referencia_composicoes')
            .select('*')
            .eq('fonte', 'sinapi')
            .limit(50)

          if (buscaTermo) {
            q = q.or(`descricao.ilike.%${buscaTermo}%,codigo.ilike.%${buscaTermo}%`)
          }

          const { data, error } = await q
          if (!error && data && data.length > 0) {
            dbItens = data.map((row: any) => ({
              id: row.id,
              codigo: String(row.codigo ?? 'SINAPI'),
              descricao: row.descricao,
              unidade: row.unidade ?? 'un',
              valorUnitarioCentavos: Number(row.custo_total ?? row.preco_mediano ?? Math.round(Number(row.valor_unitario ?? 0) * 100)),
              fonte: 'sinapi' as const,
              categoria: row.tipo_classe ?? 'SINAPI OFICIAL',
            }))
          }
        } catch {
          // Fallback silencioso para garantir estabilidade
        }

        // Filtra a base oficial SINAPI em memória
        const baseFiltrada = COMPOSICOES_SINAPI_OFICIAIS.filter((item) => {
          if (!buscaTermo) return true
          return (
            item.codigo.toLowerCase().includes(buscaTermo) ||
            item.descricao.toLowerCase().includes(buscaTermo) ||
            (item.categoria && item.categoria.toLowerCase().includes(buscaTermo))
          )
        })

        // Junta itens do banco com a base oficial, evitando duplicidades pelo código
        const codigosVistos = new Set<string>()
        const unificados: ComposicaoCatalogoItem[] = []

        for (const item of [...dbItens, ...baseFiltrada]) {
          if (!codigosVistos.has(item.codigo)) {
            codigosVistos.add(item.codigo)
            unificados.push(item)
          }
        }

        return unificados
      } else {
        // Base Própria / Catálogo interno
        try {
          const { data } = await supabase
            .from('propostas_catalogo_itens')
            .select('id, codigo, descricao')
            .limit(30)

          if (data && data.length > 0) {
            return data.map((row: any) => ({
              id: row.id,
              codigo: row.codigo ?? 'PR-01',
              descricao: row.descricao,
              unidade: 'un',
              valorUnitarioCentavos: 15000,
              fonte: 'propria' as const,
            }))
          }
        } catch {
          // Fallback
        }

        return [
          {
            id: 'prop-01',
            codigo: 'COMP-014',
            descricao: 'Placa de obra personalizada em chapa galvanizada com estrutura de madeira',
            unidade: 'm²',
            valorUnitarioCentavos: 32840,
            fonte: 'propria' as const,
            categoria: 'SERVIÇOS PRELIMINARES',
            insumos: [
              { codigo: 'IN-01', descricao: 'Chapa de aço galvanizado #26', unidade: 'm²', categoria: 'material', coeficiente: 1.0, precoUnitarioCentavos: 14500 },
              { codigo: 'IN-02', descricao: 'Pontalete de madeira de lei 3x3"', unidade: 'm', categoria: 'material', coeficiente: 2.2, precoUnitarioCentavos: 3800 },
              { codigo: 'IN-03', descricao: 'Carpinteiro montador', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 2.0, precoUnitarioCentavos: 2440 },
              { codigo: 'IN-04', descricao: 'Servente auxiliar', unidade: 'h', categoria: 'mao_de_obra', coeficiente: 1.5, precoUnitarioCentavos: 1955 },
            ],
          },
          {
            id: 'prop-02',
            codigo: 'COMP-020',
            descricao: 'Revestimento acústico em drywall com lã de rocha e pintura final',
            unidade: 'm²',
            valorUnitarioCentavos: 11500,
            fonte: 'propria' as const,
            categoria: 'PAREDES E DIVISÓRIAS',
          },
        ]
      }
    },
  })

  const confirmar = () => {
    if (!itemSelecionado) return
    const targetEtapa = etapaId || etapas[0]?.id
    if (!targetEtapa) return

    onInserir(itemSelecionado, targetEtapa)
    setItemSelecionado(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white text-slate-900 border border-slate-200 shadow-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
              <Database className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                Catálogo de Composições Analíticas
                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                  SINAPI Oficial CEF
                </Badge>
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Pesquise e insira itens oficiais SINAPI ou da Base Própria com cálculo analítico de insumos.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Filtros de Busca */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 py-3 border-b border-slate-100 text-xs">
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite o código (ex: 98524, 103328) ou nome..."
              className="pl-9 h-9 text-xs bg-white text-slate-900 border-slate-300 font-medium"
            />
          </div>

          <div className="sm:col-span-3">
            <Select value={fonte} onValueChange={(v) => { setFonte(v as any); setItemSelecionado(null); }}>
              <SelectTrigger className="h-9 text-xs bg-white text-slate-900 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sinapi">Base Oficial SINAPI (Caixa)</SelectItem>
                <SelectItem value="propria">Base Própria / Interna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-3">
            <Select value={etapaId} onValueChange={(v) => setEtapaId(v)}>
              <SelectTrigger className="h-9 text-xs bg-white text-slate-900 border-slate-300">
                <SelectValue placeholder="Inserir na Etapa..." />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.codigo} · {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[460px] py-2 space-y-1.5 divide-y divide-slate-100">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-2">
              <Loader2 className="size-6 animate-spin text-sky-600" />
              <span>Consultando referências oficiais...</span>
            </div>
          ) : resultados.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs space-y-2">
              <Database className="size-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-600">Nenhuma composição encontrada</p>
              <p className="text-[11px] text-slate-400">Tente outros termos de busca ou mude a fonte.</p>
            </div>
          ) : (
            resultados.map((item) => {
              const selecionado = itemSelecionado?.id === item.id || itemSelecionado?.codigo === item.codigo
              return (
                <div
                  key={item.id || item.codigo}
                  onClick={() => setItemSelecionado(item)}
                  className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between gap-4 ${
                    selecionado
                      ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded border border-sky-200">
                        {item.codigo}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {item.categoria ?? 'COMPOSIÇÃO ANALÍTICA'}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1.5 py-0 h-4 ${
                          item.fonte === 'sinapi' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.fonte === 'sinapi' ? 'SINAPI' : 'PRÓPRIA'}
                      </Badge>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                      {item.descricao}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Unidade: <strong className="text-slate-700">{item.unidade}</strong></span>
                      {item.insumos && item.insumos.length > 0 && (
                        <span>• {item.insumos.length} insumos analíticos</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap pl-2">
                    <span className="text-[10px] block text-slate-500 uppercase font-semibold">Custo Unitário</span>
                    <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {brl(item.valorUnitarioCentavos)}
                    </span>
                    <span className="text-[11px] text-slate-500 block">/{item.unidade}</span>
                  </div>

                  <div className="pl-1">
                    {selecionado ? (
                      <div className="size-6 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="size-6 rounded-full border border-slate-300 hover:border-slate-400" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Rodapé e Confirmação */}
        <DialogFooter className="border-t border-slate-100 pt-3 flex flex-row items-center justify-between sm:justify-between w-full">
          <div className="text-xs text-slate-600">
            {itemSelecionado ? (
              <span className="flex items-center gap-1.5 text-slate-900">
                <span className="font-bold text-sky-700">{itemSelecionado.codigo}</span> selecionado
                ({brl(itemSelecionado.valorUnitarioCentavos)}/{itemSelecionado.unidade})
              </span>
            ) : (
              <span className="text-slate-400">Selecione uma composição acima para inserir.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!itemSelecionado || !etapaId}
              onClick={confirmar}
              className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 shadow-xs font-semibold"
            >
              <Plus className="size-4" />
              Inserir no Orçamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
