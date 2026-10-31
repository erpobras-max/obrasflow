import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PropostaRevisaoResumo } from '@/lib/propostas/proposta-editor.types'

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface HistoricoRevisoesPropostaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  revisoes: PropostaRevisaoResumo[]
  revisaoSelecionadaId?: string
  onSelecionar?: (id: string) => void
}

export function HistoricoRevisoesProposta({
  open,
  onOpenChange,
  revisoes,
  revisaoSelecionadaId,
  onSelecionar,
}: HistoricoRevisoesPropostaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white text-slate-900 border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            Histórico de Revisões da Proposta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-xs">
          {revisoes.length === 0 ? (
            <p className="rounded border border-dashed p-5 text-center text-slate-500">
              A primeira revisão será registrada ao salvar este rascunho.
            </p>
          ) : revisoes.map((revisao) => (
            <div key={revisao.id} className="bg-slate-50 p-3 rounded border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Revisão {revisao.numero}</span>
                  <Badge variant="outline" className="text-[10px]">{revisao.status}</Badge>
                </div>
                <p className="text-slate-500 text-[11px] mt-1">
                  {brl(revisao.valorTotalCentavos)} · {revisao.createdAt ? new Date(revisao.createdAt).toLocaleString('pt-BR') : 'sem data'}
                </p>
              </div>
              <Button
                variant={revisao.id === revisaoSelecionadaId ? 'secondary' : 'outline'}
                size="sm"
                disabled={revisao.id === revisaoSelecionadaId}
                onClick={() => {
                  onSelecionar?.(revisao.id)
                  onOpenChange(false)
                }}
              >
                {revisao.id === revisaoSelecionadaId ? 'Aberta' : 'Visualizar'}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
