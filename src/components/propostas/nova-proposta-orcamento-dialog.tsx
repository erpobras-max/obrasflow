import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase as client } from '@/integrations/supabase/client.custom'
import {
  configuracaoPropostaComercialPadrao,
  criarFotografiaProposta,
} from '@/lib/proposta-orcamento.functions'
import { validarSelecaoNovaProposta } from '@/lib/propostas/proposta-criacao'

const supabase = client as any

interface NovaPropostaOrcamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriada: (propostaId: string) => void
  duplicar?: boolean
}

async function dados(query: PromiseLike<any>) {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export function NovaPropostaOrcamentoDialog({
  open,
  onOpenChange,
  onCriada,
  duplicar = false,
}: NovaPropostaOrcamentoDialogProps) {
  const [obraId, setObraId] = useState('')
  const [orcamentoId, setOrcamentoId] = useState('')
  const [revisaoId, setRevisaoId] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) {
      setObraId('')
      setOrcamentoId('')
      setRevisaoId('')
    }
  }, [open])

  const obrasQuery = useQuery({
    queryKey: ['obras-com-orcamento-proposta'],
    enabled: open,
    queryFn: () => dados(supabase.from('obras').select('id,numero,nome,cliente_id').order('nome')),
  })
  const orcamentosQuery = useQuery({
    queryKey: ['orcamentos-proposta', obraId],
    enabled: open && Boolean(obraId),
    queryFn: () => dados(supabase.from('orcamentos').select('id,created_at').eq('obra_id', obraId).order('created_at', { ascending: false })),
  })
  const revisoesQuery = useQuery({
    queryKey: ['orcamento-revisoes-proposta', orcamentoId],
    enabled: open && Boolean(orcamentoId),
    queryFn: () => dados(supabase.from('orcamento_revisoes').select('id,numero,created_at,fotografia').eq('orcamento_id', orcamentoId).order('numero', { ascending: false })),
  })

  const obras = useMemo(() => {
    const orcamentos = orcamentosQuery.data ?? []
    if (obraId && orcamentos.length === 0) return obrasQuery.data ?? []
    return obrasQuery.data ?? []
  }, [obraId, obrasQuery.data, orcamentosQuery.data])

  const confirmar = async () => {
    const validacao = validarSelecaoNovaProposta({ obraId, orcamentoId, revisaoId, duplicar })
    if (!validacao.ok) {
      toast.error(validacao.mensagem)
      return
    }
    const revisao = (revisoesQuery.data ?? []).find((item: any) => item.id === revisaoId)
    if (!revisao) {
      toast.error('A revisão selecionada não está mais disponível.')
      return
    }
    setSalvando(true)
    try {
      const fotografia = criarFotografiaProposta(revisao, configuracaoPropostaComercialPadrao)
      const { data: propostaCriadaId, error } = await supabase.rpc('criar_proposta_de_revisao', {
        p_orcamento_revisao_id: revisaoId,
        p_configuracao: configuracaoPropostaComercialPadrao,
        p_fotografia: fotografia,
        p_duplicar: validacao.duplicar,
      })
      if (error) throw error
      await supabase.from('obras').update({ proposta_id: propostaCriadaId }).eq('id', obraId)
      toast.success(validacao.duplicar ? 'Variação comercial criada.' : 'Rascunho comercial aberto a partir do orçamento.')
      onOpenChange(false)
      onCriada(propostaCriadaId)
    } catch (erro) {
      toast.error((erro as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{duplicar ? 'Duplicar proposta comercial' : 'Nova proposta pelo orçamento'}</DialogTitle>
          <DialogDescription>
            Selecione a origem técnica. Preços e etapas serão congelados nesta revisão comercial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Obra</label>
            <Select value={obraId} onValueChange={(valor) => { setObraId(valor); setOrcamentoId(''); setRevisaoId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
              <SelectContent>{obras.map((obra: any) => <SelectItem key={obra.id} value={obra.id}>{obra.numero ? `${obra.numero} — ` : ''}{obra.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Orçamento</label>
            <Select value={orcamentoId} disabled={!obraId} onValueChange={(valor) => { setOrcamentoId(valor); setRevisaoId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecione o orçamento" /></SelectTrigger>
              <SelectContent>{(orcamentosQuery.data ?? []).map((orcamento: any, indice: number) => <SelectItem key={orcamento.id} value={orcamento.id}>Orçamento {indice + 1} · {new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Revisão congelada</label>
            <Select value={revisaoId} disabled={!orcamentoId} onValueChange={setRevisaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione a revisão" /></SelectTrigger>
              <SelectContent>{(revisoesQuery.data ?? []).map((revisao: any) => <SelectItem key={revisao.id} value={revisao.id}>Revisão {revisao.numero} · {new Date(revisao.created_at).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando || !revisaoId}>{salvando ? 'Criando…' : 'Criar e abrir editor'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
