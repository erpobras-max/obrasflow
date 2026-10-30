import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ResumoCusto } from '@/lib/orcamento-analitico'

const brl = (v: number) =>
  (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CATEGORIAS = [
  { nome: 'Mão de obra', chave: 'maoDeObraCentavos', corDot: 'bg-sky-500', corBarra: 'bg-sky-500' },
  { nome: 'Material', chave: 'materialCentavos', corDot: 'bg-emerald-500', corBarra: 'bg-emerald-500' },
  { nome: 'Equipamento', chave: 'equipamentoCentavos', corDot: 'bg-amber-500', corBarra: 'bg-amber-500' },
  { nome: 'Outros', chave: 'outrosCentavos', corDot: 'bg-purple-500', corBarra: 'bg-purple-500' },
] as const

export function ResumoCustosPopover({
  resumo,
  children,
  titulo = 'Composição do custo',
  subtitulo,
}: {
  resumo: ResumoCusto
  children: React.ReactNode
  titulo?: string
  subtitulo?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 bg-white text-slate-900 border border-slate-200 shadow-2xl p-4 text-xs" align="end">
        <div className="mb-3 border-b border-slate-100 pb-2">
          <h4 className="font-bold text-slate-900 text-sm">{titulo}</h4>
          {subtitulo && <p className="text-[11px] text-slate-500">{subtitulo}</p>}
        </div>

        <div className="space-y-3.5 my-3">
          {CATEGORIAS.map((cat) => {
            const valor = resumo[cat.chave] ?? 0
            const pct = resumo.totalCentavos > 0 ? Math.round((valor / resumo.totalCentavos) * 100) : 0
            return (
              <div key={cat.nome}>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.corDot}`} />
                    {cat.nome}
                  </span>
                  <span className="tabular-nums font-semibold text-slate-900">
                    {brl(valor)}{' '}
                    <span className="text-slate-400 font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full ${cat.corBarra}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="font-bold text-slate-800">Custo total</span>
          <span className="font-black text-sky-700 text-sm tabular-nums">{brl(resumo.totalCentavos)}</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}
