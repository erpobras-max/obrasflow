import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import type { CategoriaCusto } from '@/lib/orcamento-analitico'

export interface InsumoEdicao { codigo?: string | null; descricao: string; unidade: string; categoria: CategoriaCusto; coeficiente: number; precoUnitarioCentavos: number }
const brl = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export function ComposicaoCustoDialog({ open, onOpenChange, descricao, insumos, onAlterar }: { open: boolean; onOpenChange(v: boolean): void; descricao: string; insumos: InsumoEdicao[]; onAlterar(v: InsumoEdicao[]): void }) {
  const alterar = (i: number, campo: 'coeficiente' | 'precoUnitarioCentavos', valor: number) => onAlterar(insumos.map((item, idx) => idx === i ? { ...item, [campo]: Math.max(0, valor) } : item))
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>Composição do custo · {descricao}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">O custo unitário é calculado exclusivamente pelos consumos e preços abaixo.</p><Table><TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead>Categoria</TableHead><TableHead>Un.</TableHead><TableHead>Consumo</TableHead><TableHead>Preço</TableHead><TableHead>Total</TableHead></TableRow></TableHeader><TableBody>
      {insumos.map((i, idx) => <TableRow key={`${i.codigo}-${idx}`}><TableCell><div className="font-medium">{i.descricao}</div><div className="text-xs text-muted-foreground">{i.codigo}</div></TableCell><TableCell>{i.categoria.replaceAll('_', ' ')}</TableCell><TableCell>{i.unidade}</TableCell><TableCell><Input className="w-28" type="number" step="0.0001" value={i.coeficiente} onChange={e => alterar(idx, 'coeficiente', Number(e.target.value))} /></TableCell><TableCell><Input className="w-28" type="number" step="0.01" value={i.precoUnitarioCentavos / 100} onChange={e => alterar(idx, 'precoUnitarioCentavos', Math.round(Number(e.target.value) * 100))} /></TableCell><TableCell className="font-medium">{brl(Math.round(i.coeficiente * i.precoUnitarioCentavos))}</TableCell></TableRow>)}
    </TableBody></Table></DialogContent></Dialog>
}

