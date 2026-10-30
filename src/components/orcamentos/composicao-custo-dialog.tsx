import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CategoriaCusto } from '@/lib/orcamento-analitico'

export interface InsumoEdicao {
  id?: string
  codigo?: string | null
  descricao: string
  unidade: string
  categoria: CategoriaCusto
  coeficiente: number
  precoUnitarioCentavos: number
  fonte?: string
}

interface ComposicaoCustoDialogProps {
  open: boolean
  onOpenChange(v: boolean): void
  codigo?: string | null
  descricao: string
  fonte?: string
  insumos: InsumoEdicao[]
  onAlterar(insumos: InsumoEdicao[]): void
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ComposicaoCustoDialog({
  open,
  onOpenChange,
  codigo,
  descricao,
  fonte = 'SINAPI',
  insumos,
  onAlterar,
}: ComposicaoCustoDialogProps) {
  const [lista, setLista] = useState<InsumoEdicao[]>(insumos)

  useEffect(() => {
    if (open) {
      setLista(insumos)
    }
  }, [open, insumos])

  const alterar = (idx: number, patch: Partial<InsumoEdicao>) => {
    setLista((atuais) => atuais.map((item, i) => (i === idx ? { ...item, ...patch } : item)))
  }

  const remover = (idx: number) => {
    setLista((atuais) => atuais.filter((_, i) => i !== idx))
  }

  const adicionarNovoInsumo = () => {
    setLista((atuais) => [
      ...atuais,
      {
        codigo: `PR-${atuais.length + 1}`,
        descricao: 'Novo insumo próprio',
        unidade: 'un',
        categoria: 'material',
        coeficiente: 1,
        precoUnitarioCentavos: 0,
        fonte: 'propria',
      },
    ])
  }

  // Totais por categoria
  const totais = useMemo(() => {
    let maoDeObra = 0
    let material = 0
    let equipamento = 0
    let outros = 0

    for (const item of lista) {
      const parcial = Math.round(item.coeficiente * item.precoUnitarioCentavos)
      if (item.categoria === 'mao_de_obra') maoDeObra += parcial
      else if (item.categoria === 'material') material += parcial
      else if (item.categoria === 'equipamento') equipamento += parcial
      else outros += parcial
    }

    const total = maoDeObra + material + equipamento + outros
    return { maoDeObra, material, equipamento, outros, total }
  }, [lista])

  const salvar = () => {
    onAlterar(lista)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-white text-slate-900 border border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[10px] px-2 py-0.5 rounded">
                  {codigo ? `${fonte.toUpperCase()} · ${codigo}` : fonte.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">Valores aplicados exclusivamente neste orçamento</span>
              </div>
              <DialogTitle className="text-base font-bold text-slate-900 mt-1">
                Composição do custo unitário · {descricao}
              </DialogTitle>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                CUSTO UNITÁRIO CALCULADO
              </span>
              <span className="text-2xl font-black text-sky-700 tabular-nums">
                {brl(totais.total)}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo por Categoria */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 border border-slate-200 rounded-lg p-3 bg-slate-50/60 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">MÃO DE OBRA</span>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{brl(totais.maoDeObra)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">MATERIAL</span>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{brl(totais.material)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">EQUIPAMENTO</span>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{brl(totais.equipamento)}</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">SERVIÇOS AUXILIARES</span>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">R$ 0,00</div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">OUTROS</span>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{brl(totais.outros)}</div>
          </div>
        </div>

        {/* Aviso Amarelo Invariante */}
        <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-900 font-medium">
          ℹ O custo unitário não pode ser digitado diretamente. Edite o consumo ou o preço de cada insumo abaixo.
        </div>

        {/* Tabela de Insumos */}
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-2.5 px-3 w-32">CATEGORIA</th>
                <th className="py-2.5 px-3">CÓDIGO E INSUMO</th>
                <th className="py-2.5 px-2 text-center w-14">UN.</th>
                <th className="py-2.5 px-3 text-right w-28">CONSUMO</th>
                <th className="py-2.5 px-3 text-right w-32">PREÇO UNITÁRIO</th>
                <th className="py-2.5 px-3 text-right w-28">CUSTO PARCIAL</th>
                <th className="py-2.5 px-3 text-center w-20">FONTE</th>
                <th className="py-2.5 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {lista.map((item, idx) => {
                const custoParcialCentavos = Math.round(item.coeficiente * item.precoUnitarioCentavos)
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <Select
                        value={item.categoria}
                        onValueChange={(val) => alterar(idx, { categoria: val as CategoriaCusto })}
                      >
                        <SelectTrigger className="h-7 text-xs bg-white text-slate-900 border-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mao_de_obra">Mão de obra</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="equipamento">Equipamento</SelectItem>
                          <SelectItem value="outros">Outros</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="py-2 px-3">
                      <Input
                        value={item.descricao}
                        onChange={(e) => alterar(idx, { descricao: e.target.value })}
                        className="h-7 text-xs bg-white text-slate-900 border-slate-300 font-medium"
                      />
                      {item.codigo && (
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Cód: {item.codigo}
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-2 text-center">
                      <Input
                        value={item.unidade}
                        onChange={(e) => alterar(idx, { unidade: e.target.value })}
                        className="h-7 w-12 text-center text-xs bg-white text-slate-900 border-slate-300"
                      />
                    </td>

                    <td className="py-2 px-3 text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        value={item.coeficiente}
                        onChange={(e) => alterar(idx, { coeficiente: Math.max(0, Number(e.target.value)) })}
                        className="h-7 w-24 text-right text-xs bg-white text-slate-900 border-slate-300 tabular-nums font-medium"
                      />
                    </td>

                    <td className="py-2 px-3 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={(item.precoUnitarioCentavos / 100).toFixed(2)}
                        onChange={(e) =>
                          alterar(idx, {
                            precoUnitarioCentavos: Math.max(0, Math.round(Number(e.target.value) * 100)),
                          })
                        }
                        className="h-7 w-24 text-right text-xs bg-white text-slate-900 border-slate-300 tabular-nums font-semibold"
                      />
                    </td>

                    <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {brl(custoParcialCentavos)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded uppercase">
                        {item.fonte ?? 'SINAPI'}
                      </span>
                    </td>

                    <td className="py-2 px-2 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => remover(idx)}
                        title="Remover insumo"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Adicionar Insumo */}
        <div className="flex items-center justify-between text-xs pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={adicionarNovoInsumo}
            className="text-xs text-sky-700 hover:text-sky-900 border-sky-300 hover:bg-sky-50"
          >
            <Plus className="mr-1 size-3.5" />
            Adicionar insumo próprio
          </Button>
          <span className="text-[11px] text-slate-500 italic">
            Todas as mudanças ficam restritas a este orçamento.
          </span>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 flex items-center justify-between sm:justify-between w-full">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wide block font-semibold">
              Custo total unitário da composição
            </span>
            <span className="text-xl font-black text-sky-700 tabular-nums">{brl(totais.total)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="size-4" />
              Aplicar composição
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
