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
} from '@/lib/proposta-orcamento.functions'
import { validarSelecaoNovaProposta } from '@/lib/propostas/proposta-criacao'

const supabase = client as any

interface OrigemProposta {
  obra_id: string
  obra_numero?: string | null
  obra_nome: string
  cliente_id: string
  orcamento_id: string
  orcamento_created_at: string
  revisao_id: string
  revisao_numero: number
  revisao_created_at: string
}

interface NovaPropostaOrcamentoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCriada: (propostaId: string) => void
  duplicar?: boolean
  origemPropostaId?: string
  revisaoInicialId?: string | null
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
  origemPropostaId,
  revisaoInicialId,
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

  const origensQuery = useQuery<OrigemProposta[]>({
    queryKey: ['origens-comerciais-proposta'],
    enabled: open,
    queryFn: () => dados(supabase.rpc('listar_origens_proposta_editor', {
      p_obra_id: null,
      p_revisao_id: null,
      p_incluir_fotografia: false,
    })),
  })

  const obras = useMemo(() => {
    const unicas = new Map<string, { id: string; numero?: string | null; nome: string; cliente_id: string }>()
    for (const origem of origensQuery.data ?? []) {
      unicas.set(origem.obra_id, {
        id: origem.obra_id,
        numero: origem.obra_numero,
        nome: origem.obra_nome,
        cliente_id: origem.cliente_id,
      })
    }
    return [...unicas.values()]
  }, [origensQuery.data])

  const orcamentos = useMemo(() => {
    const unicos = new Map<string, { id: string; created_at: string }>()
    for (const origem of origensQuery.data ?? []) {
      if (origem.obra_id === obraId) {
        unicos.set(origem.orcamento_id, {
          id: origem.orcamento_id,
          created_at: origem.orcamento_created_at,
        })
      }
    }
    return [...unicos.values()]
  }, [obraId, origensQuery.data])

  const revisoes = useMemo(
    () => (origensQuery.data ?? [])
      .filter((origem) => origem.orcamento_id === orcamentoId)
      .map((origem) => ({
        id: origem.revisao_id,
        numero: origem.revisao_numero,
        created_at: origem.revisao_created_at,
      })),
    [orcamentoId, origensQuery.data],
  )

  useEffect(() => {
    if (!open || !revisaoInicialId) return
    const origem = (origensQuery.data ?? []).find((item) => item.revisao_id === revisaoInicialId)
    if (!origem) return
    setObraId(origem.obra_id)
    setOrcamentoId(origem.orcamento_id)
    setRevisaoId(origem.revisao_id)
  }, [open, origensQuery.data, revisaoInicialId])

  const confirmar = async () => {
    const validacao = validarSelecaoNovaProposta({ obraId, orcamentoId, revisaoId, duplicar })
    if (!validacao.ok) {
      toast.error(validacao.mensagem)
      return
    }
    const revisao = revisoes.find((item) => item.id === revisaoId)
    if (!revisao) {
      toast.error('A revisão selecionada não está mais disponível.')
      return
    }
    setSalvando(true)
    try {
      const obraSelecionada = obras.find((obra: any) => obra.id === obraId)
      const configuracaoInicial = {
        ...configuracaoPropostaComercialPadrao,
        tituloProposta: `Proposta Comercial - ${obraSelecionada?.nome ?? 'Obra'}`,
      }
      const chamada = validacao.duplicar && origemPropostaId
        ? supabase.rpc('duplicar_proposta_editor', {
            p_proposta_origem_id: origemPropostaId,
            p_orcamento_revisao_id: revisaoId,
            p_configuracao: configuracaoInicial,
          })
        : supabase.rpc('criar_proposta_de_revisao', {
            p_orcamento_revisao_id: revisaoId,
            p_configuracao: configuracaoInicial,
            p_fotografia: {},
            p_duplicar: validacao.duplicar,
          })
      const { data: propostaCriadaId, error } = await chamada
      if (error) throw error
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
            <Select value={obraId} disabled={Boolean(origemPropostaId)} onValueChange={(valor) => { setObraId(valor); setOrcamentoId(''); setRevisaoId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
              <SelectContent>{obras.map((obra: any) => <SelectItem key={obra.id} value={obra.id}>{obra.numero ? `${obra.numero} — ` : ''}{obra.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Orçamento</label>
            <Select value={orcamentoId} disabled={!obraId || Boolean(origemPropostaId)} onValueChange={(valor) => { setOrcamentoId(valor); setRevisaoId('') }}>
              <SelectTrigger><SelectValue placeholder="Selecione o orçamento" /></SelectTrigger>
              <SelectContent>{orcamentos.map((orcamento, indice) => <SelectItem key={orcamento.id} value={orcamento.id}>Orçamento {indice + 1} · {new Date(orcamento.created_at).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Revisão congelada</label>
            <Select value={revisaoId} disabled={!orcamentoId || Boolean(origemPropostaId)} onValueChange={setRevisaoId}>
              <SelectTrigger><SelectValue placeholder="Selecione a revisão" /></SelectTrigger>
              <SelectContent>{revisoes.map((revisao) => <SelectItem key={revisao.id} value={revisao.id}>Revisão {revisao.numero} · {new Date(revisao.created_at).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
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
