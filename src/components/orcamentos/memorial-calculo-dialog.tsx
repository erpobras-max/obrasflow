import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { avaliarFormulaMemorial } from '@/lib/orcamento-analitico'

export interface LinhaMemorialEdicao { descricao: string; formula: string; resultado: number }

export function MemorialCalculoDialog({ open, onOpenChange, linhas, onSalvar }: { open: boolean; onOpenChange(v: boolean): void; linhas: LinhaMemorialEdicao[]; onSalvar(v: LinhaMemorialEdicao[]): void }) {
  const [rascunho, setRascunho] = useState(linhas)
  const [erro, setErro] = useState('')
  useEffect(() => { if (open) setRascunho(linhas.length ? linhas : [{ descricao: '', formula: '', resultado: 0 }]) }, [open, linhas])
  const atualizar = (i: number, campo: 'descricao' | 'formula', valor: string) => setRascunho((atual) => atual.map((l, idx) => idx === i ? { ...l, [campo]: valor, ...(campo === 'formula' ? { resultado: (() => { try { return avaliarFormulaMemorial(valor) } catch { return 0 } })() } : {}) } : l))
  const salvar = () => { try { const validas = rascunho.map(l => ({ ...l, resultado: avaliarFormulaMemorial(l.formula) })); setErro(''); onSalvar(validas); onOpenChange(false) } catch (e) { setErro((e as Error).message) } }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Memorial de cálculo da quantidade</DialogTitle></DialogHeader>
    <div className="space-y-2"><div className="grid grid-cols-[1fr_1fr_120px_36px] gap-2 text-xs font-medium text-muted-foreground"><span>Descrição</span><span>Fórmula</span><span>Resultado</span><span /></div>
      {rascunho.map((l, i) => <div className="grid grid-cols-[1fr_1fr_120px_36px] gap-2" key={i}><Input value={l.descricao} onChange={e => atualizar(i, 'descricao', e.target.value)} placeholder="Ex.: Área da parede" /><Input value={l.formula} onChange={e => atualizar(i, 'formula', e.target.value)} placeholder="5,20 * 2,80" /><Input readOnly value={l.resultado.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} className="bg-muted" /><Button size="icon" variant="ghost" onClick={() => setRascunho(v => v.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button></div>)}</div>
    <Button variant="outline" size="sm" onClick={() => setRascunho(v => [...v, { descricao: '', formula: '', resultado: 0 }])}><Plus className="mr-2 size-4" />Adicionar linha</Button>
    {erro && <p className="text-sm text-destructive">{erro}</p>}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={salvar}>Aplicar quantidade</Button></DialogFooter>
  </DialogContent></Dialog>
}

