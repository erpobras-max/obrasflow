import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ResumoCusto } from '@/lib/orcamento-analitico'

const brl = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ResumoCustosPopover({ resumo, children, titulo = 'Composição do custo' }: { resumo: ResumoCusto; children: React.ReactNode; titulo?: string }) {
  const linhas = [
    ['Mão de obra', resumo.maoDeObraCentavos], ['Material', resumo.materialCentavos],
    ['Equipamento', resumo.equipamentoCentavos], ['Outros', resumo.outrosCentavos],
  ] as const
  return <Popover><PopoverTrigger asChild>{children}</PopoverTrigger><PopoverContent className="w-80" align="end">
    <p className="mb-3 text-sm font-semibold">{titulo}</p>
    <div className="space-y-3">{linhas.map(([nome, valor]) => {
      const pct = resumo.totalCentavos ? Math.round(valor / resumo.totalCentavos * 100) : 0
      return <div key={nome}><div className="flex justify-between text-xs"><span>{nome}</span><span className="font-medium">{brl(valor)} · {pct}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div></div>
    })}</div>
  </PopoverContent></Popover>
}

