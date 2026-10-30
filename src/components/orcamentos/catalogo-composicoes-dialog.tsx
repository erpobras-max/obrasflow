import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Database, Sparkles, Loader2 } from 'lucide-react'
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

  const buscaTermo = busca.trim()

  const { data: resultados = [], isLoading } = useQuery({
    queryKey: ['catalogo-composicoes-orcamento', fonte, buscaTermo],
    enabled: open,
    queryFn: async () => {
      if (fonte === 'sinapi') {
        let q = supabase
          .from('referencia_composicoes')
          .select('id, codigo, descricao, unidade, valor_unitario, mes_referencia, uf')
          .eq('fonte', 'sinapi')
          .limit(40)

        if (buscaTermo) {
          q = q.or(`descricao.ilike.%${buscaTermo}%,codigo.ilike.%${buscaTermo}%`)
        }

        const { data, error } = await q
        if (error) {
          // Fallback caso ocorra erro na busca
          return []
        }

        return (data ?? []).map((row: any) => ({
          id: row.id,
          codigo: row.codigo ?? 'SINAPI',
          descricao: row.descricao,
          unidade: row.unidade ?? 'un',
          valorUnitarioCentavos: Math.round(Number(row.valor_unitario ?? 0) * 100),
          fonte: 'sinapi' as const,
        }))
      } else {
        // Base Própria / Catálogo interno
        const { data } = await supabase
          .from('propostas_catalogo_itens')
          .select('id, codigo, descricao')
          .limit(30)

        return (data ?? []).map((row: any) => ({
          id: row.id,
          codigo: row.codigo ?? 'PR-01',
          descricao: row.descricao,
          unidade: 'un',
          valorUnitarioCentavos: 15000,
          fonte: 'propria' as const,
        }))
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
            <span className="p-1 rounded bg-sky-100 text-sky-800">
              <Database className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Catálogo de Composições Analíticas
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Pesquise e insira itens oficiais SINAPI ou da Base Própria com cálculo analítico.
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
              placeholder="Digite o código ou nome da composição..."
              className="pl-9 h-9 text-xs bg-white text-slate-900 border-slate-300 font-medium"
            />
          </div>

          <div className="sm:col-span-3">
            <Select value={fonte} onValueChange={(v) => setFonte(v as any)}>
              <SelectTrigger className="h-9 text-xs bg-white text-slate-900 border-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sinapi">Base Oficial SINAPI</SelectItem>
                <SelectItem value="propria">Base Própria / Interna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-3">
            <Select value={etapaId} onValueChange={setEtapaId}>
              <SelectTrigger className="h-9 text-xs bg-white text-slate-900 border-slate-300">
                <SelectValue placeholder="Inserir na Etapa..." />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((et) => (
                  <SelectItem key={et.id} value={et.id}>
                    {et.codigo} · {et.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Lista de Resultados */}
        <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[420px] divide-y divide-slate-100 text-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="size-6 animate-spin mb-2 text-sky-600" />
              <span>Buscando composições no catálogo...</span>
            </div>
          ) : resultados.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="font-semibold">Nenhuma composição encontrada</p>
              <p className="text-[11px] text-slate-400 mt-1">Tente outros termos de busca ou mude a fonte.</p>
            </div>
          ) : (
            resultados.map((comp: ComposicaoCatalogoItem) => {
              const selecionado = itemSelecionado?.id === comp.id
              return (
                <div
                  key={comp.id}
                  onClick={() => setItemSelecionado(comp)}
                  className={`p-3.5 flex items-center justify-between gap-4 cursor-pointer transition ${
                    selecionado
                      ? 'bg-sky-50 border-l-4 border-sky-600'
                      : 'hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sky-900 text-xs">
                        {comp.codigo}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {comp.fonte}
                      </Badge>
                      <span className="text-slate-400 text-[11px]">• Unid: {comp.unidade}</span>
                    </div>
                    <div className="font-medium text-slate-900 text-xs leading-snug">
                      {comp.descricao}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-slate-900 tabular-nums">
                      {brl(comp.valorUnitarioCentavos)}
                    </div>
                    <span className="text-[10px] text-slate-400 block">Custo Unitário</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 flex items-center justify-between sm:justify-between w-full">
          <div>
            {itemSelecionado ? (
              <span className="text-xs text-slate-700">
                Selecionado: <strong className="text-slate-900">{itemSelecionado.codigo}</strong> (
                {brl(itemSelecionado.valorUnitarioCentavos)})
              </span>
            ) : (
              <span className="text-xs text-slate-400">Selecione uma composição acima para inserir.</span>
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
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
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

