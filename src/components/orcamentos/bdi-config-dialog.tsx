import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BdiConfigDialog({ open, onOpenChange, valor, onSalvar }: { open: boolean; onOpenChange(v: boolean): void; valor: number; onSalvar(v: number): void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Configuração do BDI geral</DialogTitle></DialogHeader><div><label className="text-sm font-medium">BDI geral (%)</label><Input className="mt-2" type="number" min="0" step="0.01" defaultValue={valor} id="bdi-geral-input" /></div><p className="text-xs text-muted-foreground">Uma regra específica da atividade tem prioridade sobre a categoria; a categoria tem prioridade sobre este valor geral. Os percentuais não são somados.</p><DialogFooter><Button onClick={() => { const el = document.getElementById('bdi-geral-input') as HTMLInputElement; onSalvar(Math.max(0, Number(el.value))); onOpenChange(false) }}>Salvar</Button></DialogFooter></DialogContent></Dialog>
}

