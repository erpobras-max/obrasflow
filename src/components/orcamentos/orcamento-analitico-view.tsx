import { useMemo, useState } from 'react'
import { Calculator, ChevronDown, ChevronRight, FileText, Gauge, MoreVertical, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { calcularComposicao, calcularPrecoAtividade } from '@/lib/orcamento-analitico'
import { converterItensLegados, type ItemOrcamentoLegado } from '@/lib/orcamento-legado'
import { ResumoCustosPopover } from './resumo-custos-popover'
import { MemorialCalculoDialog, type LinhaMemorialEdicao } from './memorial-calculo-dialog'
import { ComposicaoCustoDialog, type InsumoEdicao } from './composicao-custo-dialog'
import { BdiConfigDialog } from './bdi-config-dialog'

const brl = (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
type AtividadeLegada = ReturnType<typeof converterItensLegados>['etapas'][number]['atividades'][number]
type Atividade = Omit<AtividadeLegada, 'insumos' | 'fonte'> & { fonte: string; bdi?: number; memoriais?: LinhaMemorialEdicao[]; insumos: InsumoEdicao[] }

export function OrcamentoAnaliticoView({ itens, somenteLeitura = false }: { itens: ItemOrcamentoLegado[]; somenteLeitura?: boolean }) {
  const inicial = useMemo(() => converterItensLegados(itens), [itens])
  const [etapas, setEtapas] = useState(() => inicial.etapas.map(e => ({ ...e, atividades: e.atividades as Atividade[] })))
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(inicial.etapas.map(e => e.codigo)))
  const [bdiGeral, setBdiGeral] = useState(25)
  const [bdiOpen, setBdiOpen] = useState(false)
  const [memorial, setMemorial] = useState<{ e: number; a: number } | null>(null)
  const [composicao, setComposicao] = useState<{ e: number; a: number } | null>(null)

  const atualizarAtividade = (e: number, a: number, patch: Partial<Atividade>) => setEtapas(atual => atual.map((etapa, ei) => ei !== e ? etapa : ({ ...etapa, atividades: etapa.atividades.map((at, ai) => ai === a ? { ...at, ...patch } : at) })))
  const resumoAtividade = (a: Atividade) => calcularComposicao(a.insumos)
  const totais = useMemo(() => etapas.flatMap(e => e.atividades).reduce((acc, a) => {
    const custo = resumoAtividade(a); const preco = calcularPrecoAtividade({ custoUnitarioCentavos: custo.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral })
    acc.custo += preco.custoTotalCentavos; acc.preco += preco.precoTotalCentavos
    acc.maoDeObraCentavos += Math.round(custo.maoDeObraCentavos * a.quantidade); acc.materialCentavos += Math.round(custo.materialCentavos * a.quantidade); acc.equipamentoCentavos += Math.round(custo.equipamentoCentavos * a.quantidade); acc.outrosCentavos += Math.round(custo.outrosCentavos * a.quantidade); acc.totalCentavos = acc.custo
    return acc
  }, { custo: 0, preco: 0, maoDeObraCentavos: 0, materialCentavos: 0, equipamentoCentavos: 0, outrosCentavos: 0, totalCentavos: 0 }), [etapas, bdiGeral])

  return <Card className="overflow-hidden border-primary/20 shadow-sm" data-testid="orcamento-analitico">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 p-4"><div><div className="flex items-center gap-2"><Calculator className="size-5 text-primary" /><h2 className="font-semibold">Orçamento analítico</h2><Badge variant="secondary">SINAPI + própria</Badge></div><p className="mt-1 text-xs text-muted-foreground">Custos derivados dos insumos; edite nome, quantidade, composição e BDI.</p></div>
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setBdiOpen(true)}><Gauge className="mr-2 size-4" />BDI {bdiGeral.toLocaleString('pt-BR')}%</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="outline" aria-label="Opções do orçamento"><Settings2 className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem>Lista de insumos</DropdownMenuItem><DropdownMenuItem>Lista de composições</DropdownMenuItem><DropdownMenuItem>Lista de bases</DropdownMenuItem><DropdownMenuItem>Exportar sintético</DropdownMenuItem><DropdownMenuItem>Exportar analítico</DropdownMenuItem><DropdownMenuItem onClick={() => setBdiOpen(true)}>Configurar BDI</DropdownMenuItem><DropdownMenuItem>Histórico de revisões</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
    <div className="overflow-x-auto"><div className="min-w-[1000px]"><div className="grid grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px_40px] bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><span>Descrição</span><span>Qtde.</span><span>Custo unit.</span><span>Custo total</span><span>BDI</span><span>Preço cliente</span><span /></div>
      {etapas.map((etapa, ei) => { const aberta = abertas.has(etapa.codigo); const valores = etapa.atividades.reduce((acc, a) => { const c = resumoAtividade(a); const p = calcularPrecoAtividade({ custoUnitarioCentavos: c.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral }); acc.custo += p.custoTotalCentavos; acc.preco += p.precoTotalCentavos; return acc }, { custo: 0, preco: 0 }); return <div key={etapa.codigo}><button className="grid w-full grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px_40px] items-center border-b bg-muted/60 px-3 py-3 text-left text-sm font-semibold" onClick={() => setAbertas(s => { const n = new Set(s); n.has(etapa.codigo) ? n.delete(etapa.codigo) : n.add(etapa.codigo); return n })}><span className="flex items-center gap-2">{aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{etapa.codigo} · {etapa.nome}</span><span /><span /><span>{brl(valores.custo)}</span><span>{bdiGeral}%</span><span className="text-primary">{brl(valores.preco)}</span><span /></button>
        {aberta && etapa.atividades.map((a, ai) => { const custo = resumoAtividade(a); const preco = calcularPrecoAtividade({ custoUnitarioCentavos: custo.totalCentavos, quantidade: a.quantidade, bdiPercentual: a.bdi ?? bdiGeral }); return <div className="grid grid-cols-[minmax(330px,1fr)_100px_120px_130px_90px_140px_40px] items-center border-b px-3 py-3 text-sm hover:bg-muted/20" key={`${a.codigo}-${ai}`}><div><Input disabled={somenteLeitura} value={a.descricao} onChange={e => atualizarAtividade(ei, ai, { descricao: e.target.value })} className="h-8 border-transparent px-1 font-medium hover:border-input focus:border-input" /><div className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><span>{a.codigo || `${etapa.codigo}.${ai + 1}`}</span><Badge variant="outline" className="text-[10px]">{a.fonte === 'legado' ? 'PRÓPRIA · CONFERIR' : a.fonte.toUpperCase()}</Badge></div></div><div><Input disabled={somenteLeitura} type="number" value={a.quantidade} onChange={e => atualizarAtividade(ei, ai, { quantidade: Math.max(0, Number(e.target.value)) })} className="h-8 w-20" /><button className="mt-1 flex items-center text-[10px] text-primary hover:underline" onClick={() => setMemorial({ e: ei, a: ai })}><FileText className="mr-1 size-3" />memorial</button></div><button className="text-left font-medium text-primary hover:underline" onClick={() => setComposicao({ e: ei, a: ai })}>{brl(custo.totalCentavos)}</button><ResumoCustosPopover resumo={{ ...custo, maoDeObraCentavos: Math.round(custo.maoDeObraCentavos * a.quantidade), materialCentavos: Math.round(custo.materialCentavos * a.quantidade), equipamentoCentavos: Math.round(custo.equipamentoCentavos * a.quantidade), outrosCentavos: Math.round(custo.outrosCentavos * a.quantidade), totalCentavos: preco.custoTotalCentavos }}><button className="text-left hover:underline">{brl(preco.custoTotalCentavos)}</button></ResumoCustosPopover><Input disabled={somenteLeitura} type="number" value={a.bdi ?? bdiGeral} onChange={e => atualizarAtividade(ei, ai, { bdi: Number(e.target.value) })} className="h-8 w-20" /><ResumoCustosPopover resumo={custo} titulo={`Preço ao cliente · BDI ${a.bdi ?? bdiGeral}%`}><button className="font-semibold text-primary hover:underline">{brl(preco.precoTotalCentavos)}</button></ResumoCustosPopover><Button size="icon" variant="ghost"><MoreVertical className="size-4" /></Button></div>})}</div> })}
    </div></div>
    <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Custo total</p><ResumoCustosPopover resumo={totais}><button className="text-xl font-bold hover:underline">{brl(totais.custo)}</button></ResumoCustosPopover></div><div><p className="text-xs text-muted-foreground">BDI geral</p><button className="text-xl font-bold text-primary hover:underline" onClick={() => setBdiOpen(true)}>{bdiGeral.toLocaleString('pt-BR')}%</button></div><div><p className="text-xs text-muted-foreground">Preço a cobrar do cliente</p><ResumoCustosPopover resumo={totais} titulo={`Preço do cliente · BDI geral ${bdiGeral}%`}><button className="text-xl font-bold text-primary hover:underline">{brl(totais.preco)}</button></ResumoCustosPopover></div></div>
    <BdiConfigDialog open={bdiOpen} onOpenChange={setBdiOpen} valor={bdiGeral} onSalvar={setBdiGeral} />
    {memorial && <MemorialCalculoDialog open onOpenChange={v => !v && setMemorial(null)} linhas={etapas[memorial.e].atividades[memorial.a].memoriais ?? []} onSalvar={linhas => atualizarAtividade(memorial.e, memorial.a, { memoriais: linhas, quantidade: linhas.reduce((s, l) => s + l.resultado, 0) })} />}
    {composicao && <ComposicaoCustoDialog open onOpenChange={v => !v && setComposicao(null)} descricao={etapas[composicao.e].atividades[composicao.a].descricao} insumos={etapas[composicao.e].atividades[composicao.a].insumos} onAlterar={insumos => atualizarAtividade(composicao.e, composicao.a, { insumos })} />}
  </Card>
}

