import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Copy, FileSignature, FileText, HardHat, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { EditorPropostaComercial } from '@/components/propostas/editor-proposta-comercial'
import { NovaPropostaOrcamentoDialog } from '@/components/propostas/nova-proposta-orcamento-dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { usePropostaEditor } from '@/hooks/use-proposta-editor'
import { supabase as client } from '@/integrations/supabase/client.custom'
import { STATUS_PROPOSTA_BADGE, STATUS_PROPOSTA_LABEL, statusPropostaEnum, type StatusProposta } from '@/lib/clientes.schema'
import { cn } from '@/lib/utils'

const supabase = client as any

export const Route = createFileRoute('/_app/comercial/propostas')({
  validateSearch: (search: Record<string, unknown>) => ({
    busca: typeof search.busca === 'string' ? search.busca : undefined,
    clienteId: typeof search.clienteId === 'string' ? search.clienteId : undefined,
    propostaId: typeof search.propostaId === 'string' ? search.propostaId : undefined,
  }),
  component: PropostasPage,
})

interface PropostaRow {
  id: string
  numero: string
  cliente_id: string
  titulo: string
  valor_total: number
  status: StatusProposta
  validade: string | null
}
interface ClienteOpt { id: string; nome: string }
const brl = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function PropostasPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { perfil } = useAuth()
  const [propostaId, setPropostaId] = useState<string | null>(search.propostaId ?? null)
  const [novaOpen, setNovaOpen] = useState(false)
  const [duplicarOpen, setDuplicarOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | StatusProposta>('all')
  const [clienteFilter, setClienteFilter] = useState(search.clienteId ?? 'all')
  const podeEditar = ['admin', 'diretor', 'financeiro', 'financeiro_civil', 'financeiro_imobiliaria'].includes(perfil?.perfil ?? '')
  const podeExcluir = perfil?.perfil === 'admin' || perfil?.perfil === 'diretor'

  useEffect(() => setPropostaId(search.propostaId ?? null), [search.propostaId])
  useEffect(() => { if (search.clienteId) setClienteFilter(search.clienteId) }, [search.clienteId])

  const abrirEditor = (id: string | null) => {
    setPropostaId(id)
    navigate({
      to: '/comercial/propostas',
      search: { busca: search.busca, clienteId: search.clienteId, propostaId: id ?? undefined },
      replace: true,
    })
  }

  const propostasQuery = useQuery({
    queryKey: ['propostas'],
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PropostaRow[]
    },
  })
  const clientesQuery = useQuery({
    queryKey: ['clientes-opt'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id,nome').is('deleted_at', null).order('nome')
      if (error) throw error
      return (data ?? []) as ClienteOpt[]
    },
  })
  const editor = usePropostaEditor(propostaId)

  const clientesMap = useMemo(
    () => Object.fromEntries((clientesQuery.data ?? []).map((cliente) => [cliente.id, cliente.nome])),
    [clientesQuery.data],
  )
  const filtradas = useMemo(() => (propostasQuery.data ?? []).filter((proposta) => {
    if (statusFilter !== 'all' && proposta.status !== statusFilter) return false
    if (clienteFilter !== 'all' && proposta.cliente_id !== clienteFilter) return false
    if (search.busca) {
      const termo = search.busca.toLocaleLowerCase('pt-BR')
      return `${proposta.numero} ${proposta.titulo} ${clientesMap[proposta.cliente_id] ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo)
    }
    return true
  }), [propostasQuery.data, statusFilter, clienteFilter, search.busca, clientesMap])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('excluir_proposta_rascunho', { p_proposta_id: id })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Rascunho excluído definitivamente.')
      setDeleteId(null)
      await queryClient.invalidateQueries({ queryKey: ['propostas'] })
    },
    onError: (erro: Error) => toast.error(erro.message),
  })

  const decidirMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'aceita' | 'rejeitada' | 'expirada' }) => {
      const { error } = await supabase.rpc('alterar_status_proposta_editor', {
        p_proposta_id: id,
        p_status: status,
      })
      if (error) throw error
    },
    onSuccess: async (_, variaveis) => {
      toast.success(variaveis.status === 'aceita' ? 'Proposta aceita.' : variaveis.status === 'rejeitada' ? 'Proposta rejeitada.' : 'Proposta expirada.')
      await queryClient.invalidateQueries({ queryKey: ['propostas'] })
    },
    onError: (erro: Error) => toast.error(erro.message),
  })

  if (propostaId) {
    if (editor.isPending) return <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-[560px] w-full" /></div>
    if (editor.error) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4"><h1 className="font-semibold">Não foi possível abrir a proposta</h1><p className="text-sm text-muted-foreground">{(editor.error as Error).message}</p><Button variant="outline" onClick={() => abrirEditor(null)}>Voltar à lista</Button></div>
    if (editor.estado?.tipo === 'escolher_revisao') return <div className="max-w-2xl mx-auto rounded-lg border bg-card p-6 space-y-4"><h1 className="text-xl font-semibold">Escolha a revisão de origem</h1><p className="text-sm text-muted-foreground">Esta proposta antiga possui mais de uma revisão possível. Selecione explicitamente qual orçamento deve ser congelado.</p><div className="space-y-2">{editor.estado.candidatas.map((revisao) => <Button key={revisao.id} variant="outline" className="w-full justify-between" onClick={() => editor.selecionarRevisaoLegada(revisao.id)}><span>Revisão {revisao.numero}</span><span>{new Date(revisao.createdAt).toLocaleDateString('pt-BR')}</span></Button>)}</div><Button variant="ghost" onClick={() => abrirEditor(null)}>Cancelar</Button></div>
    if (editor.estado?.tipo === 'sem_origem') return <div className="max-w-xl mx-auto rounded-lg border bg-card p-6 space-y-4"><h1 className="text-xl font-semibold">Proposta sem orçamento de origem</h1><p className="text-sm text-muted-foreground">Este registro legado não pode ser editado até ser vinculado a uma revisão de orçamento.</p><Button variant="outline" onClick={() => abrirEditor(null)}>Voltar à lista</Button></div>
    if (editor.editorData) return <EditorPropostaComercial proposta={editor.editorData} configuracaoInicial={editor.configuracao} revisoes={editor.revisoes} revisaoSelecionadaId={editor.revisaoSelecionadaId} onSelecionarRevisao={editor.abrirRevisaoHistorica} somenteLeitura={!podeEditar || editor.somenteLeitura} onVoltar={() => abrirEditor(null)} onSalvarRascunho={async (config) => { await editor.salvarRascunho(config); toast.success('Rascunho salvo.') }} onPublicarRevisao={async (config) => { await editor.publicarRascunho(config); toast.success('Revisão publicada e congelada.') }} />
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight">Propostas</h1><p className="text-sm text-muted-foreground">Propostas comerciais geradas exclusivamente de revisões de orçamento.</p></div>{podeEditar && <Button onClick={() => setNovaOpen(true)}><Plus className="size-4" /> Nova proposta</Button>}</header>
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(valor) => setStatusFilter(valor as 'all' | StatusProposta)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{statusPropostaEnum.options.map((status) => <SelectItem key={status} value={status}>{STATUS_PROPOSTA_LABEL[status]}</SelectItem>)}</SelectContent></Select>
        <Select value={clienteFilter} onValueChange={setClienteFilter}><SelectTrigger className="w-64"><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{(clientesQuery.data ?? []).map((cliente) => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="rounded-md border bg-card overflow-hidden"><Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Título</TableHead><TableHead>Cliente</TableHead><TableHead>Status</TableHead><TableHead>Validade</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>
        {propostasQuery.isLoading ? <TableRow><TableCell colSpan={7}><Skeleton className="h-9 w-full" /></TableCell></TableRow> : filtradas.length === 0 ? <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><FileText className="size-8 mx-auto mb-2 opacity-50" />Nenhuma proposta encontrada</TableCell></TableRow> : filtradas.map((proposta) => <TableRow key={proposta.id}><TableCell className="font-mono text-xs">{proposta.numero}</TableCell><TableCell><button className="font-medium text-primary hover:underline inline-flex items-center gap-2" onClick={() => abrirEditor(proposta.id)}><FileText className="size-4" />{proposta.titulo}</button></TableCell><TableCell>{clientesMap[proposta.cliente_id] ?? '—'}</TableCell><TableCell><Badge variant="outline" className={cn('text-xs', STATUS_PROPOSTA_BADGE[proposta.status])}>{STATUS_PROPOSTA_LABEL[proposta.status]}</Badge></TableCell><TableCell>{proposta.validade ? new Date(`${proposta.validade}T12:00:00`).toLocaleDateString('pt-BR') : '—'}</TableCell><TableCell className="text-right font-mono">{brl(Number(proposta.valor_total))}</TableCell><TableCell><div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" title="Abrir editor" onClick={() => abrirEditor(proposta.id)}><Pencil className="size-4" /></Button>
          {proposta.status === 'rascunho' && podeEditar && <Button size="icon" variant="ghost" title="Duplicar de outra revisão" onClick={() => setDuplicarOpen(true)}><Copy className="size-4" /></Button>}
          {proposta.status === 'enviada' && podeEditar && <><Button size="icon" variant="ghost" title="Aceitar" onClick={() => decidirMutation.mutate({ id: proposta.id, status: 'aceita' })}><CheckCircle2 className="size-4 text-emerald-600" /></Button><Button size="icon" variant="ghost" title="Rejeitar" onClick={() => decidirMutation.mutate({ id: proposta.id, status: 'rejeitada' })}><XCircle className="size-4 text-amber-600" /></Button><Button size="icon" variant="ghost" title="Expirar" onClick={() => decidirMutation.mutate({ id: proposta.id, status: 'expirada' })}><Clock3 className="size-4 text-slate-500" /></Button></>}
          {proposta.status === 'aceita' && <><Button size="icon" variant="ghost" title="Abrir obras" onClick={() => navigate({ to: '/obras', search: { busca: proposta.numero, clienteId: undefined } })}><HardHat className="size-4" /></Button><Button size="icon" variant="ghost" title="Abrir contratos" onClick={() => navigate({ to: '/comercial/contratos', search: { propostaId: proposta.id, clienteId: proposta.cliente_id } })}><FileSignature className="size-4" /></Button></>}
          {proposta.status === 'rascunho' && podeExcluir && <Button size="icon" variant="ghost" title="Excluir rascunho" onClick={() => setDeleteId(proposta.id)}><Trash2 className="size-4 text-destructive" /></Button>}
        </div></TableCell></TableRow>)}
      </TableBody></Table></div>
      <NovaPropostaOrcamentoDialog open={novaOpen} onOpenChange={setNovaOpen} onCriada={abrirEditor} />
      <NovaPropostaOrcamentoDialog open={duplicarOpen} onOpenChange={setDuplicarOpen} onCriada={abrirEditor} duplicar />
      <AlertDialog open={Boolean(deleteId)} onOpenChange={(aberto) => { if (!aberto && !deleteMutation.isPending) setDeleteId(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este rascunho definitivamente?</AlertDialogTitle><AlertDialogDescription>A exclusão remove apenas propostas ainda não publicadas. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deleteMutation.isPending} onClick={(evento) => { evento.preventDefault(); if (deleteId) deleteMutation.mutate(deleteId) }}>{deleteMutation.isPending ? 'Excluindo…' : 'Excluir rascunho'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}
