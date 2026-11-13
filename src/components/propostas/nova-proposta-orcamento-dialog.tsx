import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  tiposProposta,
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
  const [origem, setOrigem] = useState<'manual' | 'orcamento'>(origemPropostaId || revisaoInicialId ? 'orcamento' : 'manual')
  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipoProposta, setTipoProposta] = useState('Obra')
  const [descricao, setDescricao] = useState('')
  const [valorTotal, setValorTotal] = useState('0')
  const [validade, setValidade] = useState('')
  const [condicoes, setCondicoes] = useState('')
  const [obraId, setObraId] = useState('')
  const [orcamentoId, setOrcamentoId] = useState('')
  const [revisaoId, setRevisaoId] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) {
      setObraId('')
      setOrcamentoId('')
      setRevisaoId('')
      setClienteId('')
      setTitulo('')
      setTipoProposta('Obra')
      setDescricao('')
      setValorTotal('0')
      setValidade('')
      setCondicoes('')
      setOrigem(origemPropostaId || revisaoInicialId ? 'orcamento' : 'manual')
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

  const obrasCadastradasQuery = useQuery<number>({
    queryKey: ['quantidade-obras-cadastradas'],
    enabled: open,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('obras')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })

  const clientesQuery = useQuery<Array<{ id: string; nome: string; cpf_cnpj?: string | null }>>({
    queryKey: ['clientes-proposta-manual'],
    enabled: open && origem === 'manual',
    queryFn: () => dados(supabase.from('clientes').select('id,nome,cpf_cnpj').is('deleted_at', null).order('nome')),
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

  const carregandoOrigens = origensQuery.isPending || obrasCadastradasQuery.isPending
  const erroOrigens = origensQuery.isError || obrasCadastradasQuery.isError
  const semOrigens = !carregandoOrigens && !erroOrigens && obras.length === 0
  const placeholderObra = carregandoOrigens
    ? 'Carregando obras e revisões…'
    : erroOrigens
      ? 'Não foi possível carregar as obras'
      : semOrigens
        ? 'Nenhuma obra com orçamento e revisão congelada disponível'
        : 'Selecione a obra'

  const tentarNovamente = () => {
    void origensQuery.refetch()
    void obrasCadastradasQuery.refetch()
  }

  useEffect(() => {
    if (!open || !revisaoInicialId) return
    const origem = (origensQuery.data ?? []).find((item) => item.revisao_id === revisaoInicialId)
    if (!origem) return
    setObraId(origem.obra_id)
    setOrcamentoId(origem.orcamento_id)
    setRevisaoId(origem.revisao_id)
  }, [open, origensQuery.data, revisaoInicialId])

  const confirmar = async () => {
    if (origem === 'manual') {
      if (!clienteId) { toast.error('Selecione um cliente.'); return }
      if (!titulo.trim()) { toast.error('Informe o título da proposta.'); return }
      const valor = Number(valorTotal.replace(',', '.'))
      if (!Number.isFinite(valor) || valor < 0) { toast.error('Informe um valor válido.'); return }
      setSalvando(true)
      try {
        const { data: propostaCriadaId, error } = await supabase.rpc('criar_proposta_manual', {
          p_cliente_id: clienteId,
          p_titulo: titulo.trim(),
          p_tipo_proposta: tipoProposta,
          p_descricao: descricao.trim() || null,
          p_valor_total: valor,
          p_validade: validade || null,
          p_condicoes: condicoes.trim() || null,
          p_itens: [],
        })
        if (error) throw error
        toast.success('Rascunho de proposta criado.')
        onOpenChange(false)
        onCriada(propostaCriadaId)
      } catch (erro) {
        toast.error((erro as Error).message)
      } finally {
        setSalvando(false)
      }
      return
    }
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
          <DialogTitle>{duplicar ? 'Duplicar proposta comercial' : 'Nova proposta comercial'}</DialogTitle>
          <DialogDescription>
            A proposta pode ser criada antes da obra. O orçamento técnico é opcional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!duplicar && !origemPropostaId && (
            <div className="flex gap-2 rounded-md border p-1">
              <Button type="button" variant={origem === 'manual' ? 'default' : 'ghost'} className="flex-1" onClick={() => setOrigem('manual')}>Proposta manual</Button>
              <Button type="button" variant={origem === 'orcamento' ? 'default' : 'ghost'} className="flex-1" onClick={() => setOrigem('orcamento')}>A partir de orçamento</Button>
            </div>
          )}
          {origem === 'manual' ? (
            <div className="space-y-4">
              <div className="space-y-1.5"><label className="text-sm font-medium">Cliente</label><Select value={clienteId} onValueChange={setClienteId} disabled={clientesQuery.isPending}><SelectTrigger><SelectValue placeholder={clientesQuery.isPending ? 'Carregando clientes…' : 'Selecione o cliente'} /></SelectTrigger><SelectContent>{(clientesQuery.data ?? []).map((cliente) => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.cpf_cnpj ? ` · ${cliente.cpf_cnpj}` : ''}</SelectItem>)}</SelectContent></Select>{clientesQuery.isError && <p className="text-xs text-destructive">Não foi possível carregar os clientes.</p>}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-sm font-medium">Título</label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reforma da residência" /></div><div className="space-y-1.5"><label className="text-sm font-medium">Classificação</label><Select value={tipoProposta} onValueChange={setTipoProposta}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{tiposProposta.map((tipo) => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Escopo/descrição</label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o que será proposto" /></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><label className="text-sm font-medium">Valor total (R$)</label><Input inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} /></div><div className="space-y-1.5"><label className="text-sm font-medium">Validade</label><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div></div>
              <div className="space-y-1.5"><label className="text-sm font-medium">Condições de pagamento</label><Textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} placeholder="Condições comerciais" /></div>
            </div>
          ) : (
            <>
          {carregandoOrigens && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando obras e revisões…
            </div>
          )}
          {erroOrigens && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Não foi possível carregar as obras disponíveis.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={tentarNovamente}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          )}
          {semOrigens && (
            <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Nenhuma obra com orçamento e revisão congelada disponível</p>
              <p className="mt-1">
                {(obrasCadastradasQuery.data ?? 0) === 0
                  ? 'Nenhuma obra cadastrada. Cadastre uma obra antes de criar a proposta.'
                  : 'As obras cadastradas ainda não possuem orçamento com revisão congelada.'}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Obra</label>
            <Select value={obraId} disabled={Boolean(origemPropostaId) || carregandoOrigens || erroOrigens || semOrigens} onValueChange={(valor) => { setObraId(valor); setOrcamentoId(''); setRevisaoId('') }}>
              <SelectTrigger><SelectValue placeholder={placeholderObra} /></SelectTrigger>
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
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirmar} disabled={salvando || (origem === 'orcamento' && !revisaoId)}>{salvando ? 'Criando…' : 'Criar e abrir editor'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
