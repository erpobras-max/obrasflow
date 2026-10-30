import { useEffect, useMemo, useState } from 'react'
import { Calculator, ChevronDown, ChevronRight, FileText, Gauge, Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { calcularComposicao, calcularPrecoAtividade } from '@/lib/orcamento-analitico'
import { converterItensLegados, type ItemOrcamentoLegado } from '@/lib/orcamento-legado'
import { supabase as client } from '@/integrations/supabase/client.custom'
import { ResumoCustosPopover } from './resumo-custos-popover'
import { MemorialCalculoDialog, type LinhaMemorialEdicao } from './memorial-calculo-dialog'
import { ComposicaoCustoDialog, type InsumoEdicao } from './composicao-custo-dialog'
import { BdiConfigDialog } from './bdi-config-dialog'

const supabase = client as any
const brl = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
type Insumo = InsumoEdicao & { id: string }
type Memorial = LinhaMemorialEdicao & { id?: string }
type Atividade = { id: string; codigo: string | null; descricao: string; unidade: string; quantidade: number; ordem: number; fonte: string; bdi?: number; memoriais: Memorial[]; insumos: Insumo[] }
type Etapa = { id: string; codigo: string; nome: string; ordem: number; atividades: Atividade[] }

export function OrcamentoAnaliticoView({ orcamentoId, itens, bdiInicial = 25, somenteLeitura = false }: { orcamentoId: string; itens: ItemOrcamentoLegado[]; bdiInicial?: number; somenteLeitura?: boolean }) {
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [bdiGeral, setBdiGeral] = useState(bdiInicial)
  const [bdiOpen, setBdiOpen] = useState(false)
  const [memorial, setMemorial] = useState<{ e: number; a: number } | null>(null)
  const [composicao, setComposicao] = useState<{ e: number; a: number } | null>(null)
  useEffect(() => { void carregarOuMigrar() }, [orcamentoId])

  async function carregarOuMigrar() {
    setCarregando(true)
    try {
      let respEtapas = await supabase.from('orcamento_etapas').select('*').eq('orcamento_id', orcamentoId).order('ordem')
      if (respEtapas.error) throw respEtapas.error
      if (!respEtapas.data?.length && itens.length) { await migrarLegado(); respEtapas = await supabase.from('orcamento_etapas').select('*').eq('orcamento_id', orcamentoId).order('ordem'); if (respEtapas.error) throw respEtapas.error }
      const etapaIds = (respEtapas.data ?? []).map((e: any) => e.id)
      const respAtividades = etapaIds.length ? await supabase.from('orcamento_atividades').select('*').in('etapa_id', etapaIds).order('ordem') : { data: [], error: null }
      if (respAtividades.error) throw respAtividades.error
      const atividadeIds = (respAtividades.data ?? []).map((a: any) => a.id)
      const [respInsumos, respMemoriais] = atividadeIds.length ? await Promise.all([supabase.from('orcamento_atividade_insumos').select('*').in('atividade_id', atividadeIds).order('ordem'), supabase.from('orcamento_memoriais').select('*').in('atividade_id', atividadeIds).order('ordem')]) : [{ data: [], error: null }, { data: [], error: null }]
      if (respInsumos.error) throw respInsumos.error
      if (respMemoriais.error) throw respMemoriais.error
      const arvore: Etapa[] = (respEtapas.data ?? []).map((e: any) => ({ id: e.id, codigo: e.codigo, nome: e.nome, ordem: e.ordem, atividades: (respAtividades.data ?? []).filter((a: any) => a.etapa_id === e.id).map((a: any) => ({
        id: a.id, codigo: a.codigo, descricao: a.descricao, unidade: a.unidade, quantidade: Number(a.quantidade), ordem: a.ordem, fonte: a.fonte, bdi: a.bdi_percentual == null ? undefined : Number(a.bdi_percentual),
        insumos: (respInsumos.data ?? []).filter((i: any) => i.atividade_id === a.id).map((i: any) => ({ id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, coeficiente: Number(i.coeficiente), precoUnitarioCentavos: Number(i.preco_unitario_centavos) })),
        memoriais: (respMemoriais.data ?? []).filter((m: any) => m.atividade_id === a.id).map((m: any) => ({ id: m.id, descricao: m.descricao, formula: m.formula, resultado: Number(m.resultado) })),
      })) }))
      setEtapas(arvore); setAbertas(new Set(arvore.map(e => e.codigo)))
    } catch (e) { toast.error(`Falha ao carregar o orçamento analítico: ${(e as Error).message}`) } finally { setCarregando(false) }
  }

  async function migrarLegado() {
    const convertido = converterItensLegados(itens)
    for (const etapa of convertido.etapas) {
      const e = await supabase.from('orcamento_etapas').insert({ orcamento_id: orcamentoId, codigo: etapa.codigo, nome: etapa.nome, ordem: etapa.ordem }).select('id').single(); if (e.error) throw e.error
      for (const atividade of etapa.atividades) {
        const a = await supabase.from('orcamento_atividades').insert({ etapa_id: e.data.id, codigo: atividade.codigo, descricao: atividade.descricao, unidade: atividade.unidade, quantidade: atividade.quantidade, ordem: atividade.ordem, fonte: atividade.fonte, legado_conferir: true }).select('id').single(); if (a.error) throw a.error
        const i = atividade.insumos[0]; const r = await supabase.from('orcamento_atividade_insumos').insert({ atividade_id: a.data.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, coeficiente: i.coeficiente, preco_unitario_centavos: i.precoUnitarioCentavos, ordem: 0 }); if (r.error) throw r.error
      }
    }
    const r = await supabase.from('orcamentos').update({ analitico_ativo: true, bdi_geral: bdiGeral }).eq('id', orcamentoId); if (r.error) throw r.error
  }

  const atualizarLocal = (e: number, a: number, patch: Partial<Atividade>) => setEtapas(x => x.map((et, ei) => ei !== e ? et : ({ ...et, atividades: et.atividades.map((at, ai) => ai === a ? { ...at, ...patch } : at) })))
  async function salvarAtividade(e: number, a: number, patch: Partial<Atividade>) {
    atualizarLocal(e, a, patch); const db: any = {}
    if (patch.descricao !== undefined) db.descricao = patch.descricao
    if (patch.quantidade !== undefined) db.quantidade = patch.quantidade
    if (patch.bdi !== undefined) db.bdi_percentual = patch.bdi
    const r = await supabase.from('orcamento_atividades').update(db).eq('id', etapas[e].atividades[a].id); if (r.error) { toast.error(r.error.message); void carregarOuMigrar() }
  }
  async function salvarMemorial(e: number, a: number, linhas: LinhaMemorialEdicao[]) {
    const atividade = etapas[e].atividades[a]; const quantidade = linhas.reduce((s, l) => s + l.resultado, 0)
    const d = await supabase.from('orcamento_memoriais').delete().eq('atividade_id', atividade.id); if (d.error) return toast.error(d.error.message)
    if (linhas.length) { const r = await supabase.from('orcamento_memoriais').insert(linhas.map((l, ordem) => ({ atividade_id: atividade.id, ...l, ordem }))); if (r.error) return toast.error(r.error.message) }
    await salvarAtividade(e, a, { memoriais: linhas, quantidade }); toast.success('Memorial salvo')
  }
  async function salvarInsumos(e: number, a: number, insumos: InsumoEdicao[]) {
    const atuais = etapas[e].atividades[a].insumos
    const linhas = insumos.map((i, ordem) => ({ id: atuais[ordem]?.id, atividade_id: etapas[e].atividades[a].id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, coeficiente: i.coeficiente, preco_unitario_centavos: i.precoUnitarioCentavos, ordem }))
    const r = await supabase.from('orcamento_atividade_insumos').upsert(linhas).select('*'); if (r.error) return toast.error(r.error.message)
    atualizarLocal(e, a, { insumos: r.data.map((i: any) => ({ id: i.id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, coeficiente: Number(i.coeficiente), precoUnitarioCentavos: Number(i.preco_unitario_centavos) })) })
  }
  async function salvarBdi(v: number) { setBdiGeral(v); const r = await supabase.from('orcamentos').update({ bdi_geral: v }).eq('id', orcamentoId); r.error ? toast.error(r.error.message) : toast.success('BDI salvo') }

  const resumo = (a: Atividade) => calcularComposicao(a.insumos)
  const totais = useMemo(() => etapas.flatMap(e => e.atividades).reduce((x, a) => { const c = resumo(a); const p = calcularPrecoAtividade({ custoUnitarioCentavos: c.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral }); x.custo += p.custoTotalCentavos; x.preco += p.precoTotalCentavos; x.maoDeObraCentavos += Math.round(c.maoDeObraCentavos * a.quantidade); x.materialCentavos += Math.round(c.materialCentavos * a.quantidade); x.equipamentoCentavos += Math.round(c.equipamentoCentavos * a.quantidade); x.outrosCentavos += Math.round(c.outrosCentavos * a.quantidade); x.totalCentavos = x.custo; return x }, { custo: 0, preco: 0, maoDeObraCentavos: 0, materialCentavos: 0, equipamentoCentavos: 0, outrosCentavos: 0, totalCentavos: 0 }), [etapas, bdiGeral])
  if (carregando) return <Card className="flex min-h-48 items-center justify-center"><Loader2 className="mr-2 size-5 animate-spin" />Preparando orçamento analítico...</Card>

  return <Card className="overflow-hidden border-primary/20" data-testid="orcamento-analitico"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-4"><div><div className="flex items-center gap-2"><Calculator className="size-5 text-primary" /><h2 className="font-semibold">Orçamento analítico</h2><Badge variant="secondary">SINAPI + própria</Badge></div><p className="mt-1 text-xs text-muted-foreground">Alterações salvas automaticamente; custos derivados dos insumos.</p></div><div className="flex gap-2"><Button disabled={somenteLeitura} variant="outline" size="sm" onClick={() => setBdiOpen(true)}><Gauge className="mr-2 size-4" />BDI {bdiGeral}%</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline"><Settings2 className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setBdiOpen(true)} disabled={somenteLeitura}>Configurar BDI</DropdownMenuItem><DropdownMenuItem disabled>Exportações em breve</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
    <div className="overflow-x-auto"><div className="min-w-[960px]"><div className="grid grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><span>Descrição</span><span>Qtde.</span><span>Custo unit.</span><span>Custo total</span><span>BDI</span><span>Preço cliente</span></div>{etapas.map((etapa, ei) => { const aberta = abertas.has(etapa.codigo); const valores = etapa.atividades.reduce((x, a) => { const c = resumo(a); const p = calcularPrecoAtividade({ custoUnitarioCentavos: c.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral }); x.c += p.custoTotalCentavos; x.p += p.precoTotalCentavos; return x }, { c: 0, p: 0 }); return <div key={etapa.id}><button className="grid w-full grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px] border-b bg-muted/60 px-3 py-3 text-left text-sm font-semibold" onClick={() => setAbertas(s => { const n = new Set(s); n.has(etapa.codigo) ? n.delete(etapa.codigo) : n.add(etapa.codigo); return n })}><span className="flex gap-2">{aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{etapa.codigo} · {etapa.nome}</span><span /><span /><span>{brl(valores.c)}</span><span>{bdiGeral}%</span><span className="text-primary">{brl(valores.p)}</span></button>{aberta && etapa.atividades.map((a, ai) => { const c = resumo(a); const p = calcularPrecoAtividade({ custoUnitarioCentavos: c.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral }); return <div className="grid grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px] items-center border-b px-3 py-3 text-sm" key={a.id}><div><Input disabled={somenteLeitura} value={a.descricao} onChange={ev => atualizarLocal(ei, ai, { descricao: ev.target.value })} onBlur={ev => void salvarAtividade(ei, ai, { descricao: ev.target.value })} className="h-8 border-transparent px-1 font-medium" /><div className="px-1 text-xs text-muted-foreground">{a.codigo || `${etapa.codigo}.${ai + 1}`} · {a.fonte.toUpperCase()}</div></div><div><Input disabled={somenteLeitura} type="number" value={a.quantidade} onChange={ev => atualizarLocal(ei, ai, { quantidade: Number(ev.target.value) })} onBlur={ev => void salvarAtividade(ei, ai, { quantidade: Math.max(0, Number(ev.target.value)) })} className="h-8 w-20" /><button disabled={somenteLeitura} className="mt-1 flex text-[10px] text-primary disabled:opacity-40" onClick={() => setMemorial({ e: ei, a: ai })}><FileText className="mr-1 size-3" />memorial</button></div><button disabled={somenteLeitura} className="text-left font-medium text-primary disabled:text-foreground" onClick={() => setComposicao({ e: ei, a: ai })}>{brl(c.totalCentavos)}</button><ResumoCustosPopover resumo={{ ...c, totalCentavos: p.custoTotalCentavos }}><button>{brl(p.custoTotalCentavos)}</button></ResumoCustosPopover><Input disabled={somenteLeitura} type="number" value={a.bdi ?? bdiGeral} onChange={ev => atualizarLocal(ei, ai, { bdi: Number(ev.target.value) })} onBlur={ev => void salvarAtividade(ei, ai, { bdi: Math.max(0, Number(ev.target.value)) })} className="h-8 w-20" /><ResumoCustosPopover resumo={c} titulo={`Preço ao cliente · BDI ${a.bdi ?? bdiGeral}%`}><button className="font-semibold text-primary">{brl(p.precoTotalCentavos)}</button></ResumoCustosPopover></div>})}</div>})}</div></div>
    <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Custo total</p><ResumoCustosPopover resumo={totais}><button className="text-xl font-bold">{brl(totais.custo)}</button></ResumoCustosPopover></div><div><p className="text-xs text-muted-foreground">BDI geral</p><button disabled={somenteLeitura} className="text-xl font-bold text-primary" onClick={() => setBdiOpen(true)}>{bdiGeral}%</button></div><div><p className="text-xs text-muted-foreground">Preço a cobrar</p><ResumoCustosPopover resumo={totais}><button className="text-xl font-bold text-primary">{brl(totais.preco)}</button></ResumoCustosPopover></div></div>
    <BdiConfigDialog open={bdiOpen} onOpenChange={setBdiOpen} valor={bdiGeral} onSalvar={v => void salvarBdi(v)} />{memorial && <MemorialCalculoDialog open onOpenChange={v => !v && setMemorial(null)} linhas={etapas[memorial.e].atividades[memorial.a].memoriais} onSalvar={linhas => void salvarMemorial(memorial.e, memorial.a, linhas)} />}{composicao && <ComposicaoCustoDialog open onOpenChange={v => !v && setComposicao(null)} descricao={etapas[composicao.e].atividades[composicao.a].descricao} insumos={etapas[composicao.e].atividades[composicao.a].insumos} onAlterar={insumos => void salvarInsumos(composicao.e, composicao.a, insumos)} />}</Card>
}

