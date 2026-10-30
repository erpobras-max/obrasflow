import { useEffect, useState } from 'react'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { avaliarFormulaMemorial } from '@/lib/orcamento-analitico'

export interface LinhaMemorialEdicao {
  descricao: string
  formula: string
  resultado: number
}

interface MemorialCalculoDialogProps {
  open: boolean
  onOpenChange(open: boolean): void
  titulo?: string
  unidade?: string
  linhas: LinhaMemorialEdicao[]
  onSalvar(linhas: LinhaMemorialEdicao[]): void
}

export function MemorialCalculoDialog({
  open,
  onOpenChange,
  titulo = 'Item do orçamento',
  unidade = 'un',
  linhas,
  onSalvar,
}: MemorialCalculoDialogProps) {
  const [rascunho, setRascunho] = useState<LinhaMemorialEdicao[]>(linhas)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open) {
      setRascunho(linhas.length ? linhas : [{ descricao: '', formula: '', resultado: 0 }])
      setErro('')
    }
  }, [open, linhas])

  const atualizar = (i: number, campo: 'descricao' | 'formula', valor: string) => {
    setRascunho((atual) =>
      atual.map((l, idx) => {
        if (idx !== i) return l
        let novoResultado = l.resultado
        if (campo === 'formula') {
          try {
            novoResultado = avaliarFormulaMemorial(valor)
          } catch {
            novoResultado = 0
          }
        }
        return { ...l, [campo]: valor, resultado: novoResultado }
      })
    )
  }

  const adicionarLinha = () => {
    setRascunho((v) => [...v, { descricao: '', formula: '', resultado: 0 }])
  }

  const removerLinha = (idx: number) => {
    setRascunho((v) => v.filter((_, i) => i !== idx))
  }

  const totalCalculado = rascunho.reduce((acc, l) => acc + (Number.isFinite(l.resultado) ? l.resultado : 0), 0)

  const salvar = () => {
    try {
      const validas = rascunho.map((l) => ({
        ...l,
        resultado: avaliarFormulaMemorial(l.formula),
      }))
      setErro('')
      onSalvar(validas)
      onOpenChange(false)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white text-slate-900 border border-slate-200 shadow-xl">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
            <div>
              <span>Memorial de cálculo da quantidade</span>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                {titulo} · unidade <span className="font-semibold text-slate-700">{unidade}</span>
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-2">
          {/* Coluna Esquerda: Linhas do Memorial */}
          <div className="lg:col-span-2 space-y-3">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 uppercase px-1">
              <span className="col-span-6">DESCRIÇÃO</span>
              <span className="col-span-4">FÓRMULA</span>
              <span className="col-span-2 text-right">RESULTADO</span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {rascunho.map((l, i) => (
                <div className="grid grid-cols-12 gap-2 items-center" key={i}>
                  <div className="col-span-6">
                    <Input
                      value={l.descricao}
                      onChange={(e) => atualizar(i, 'descricao', e.target.value)}
                      placeholder="Ex: Área principal do terreno"
                      className="h-8 text-xs bg-white text-slate-900 border-slate-300 font-medium"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      value={l.formula}
                      onChange={(e) => atualizar(i, 'formula', e.target.value)}
                      placeholder="25,00 * 20,00"
                      className="h-8 text-xs font-mono bg-white text-slate-900 border-slate-300 font-medium tabular-nums"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        l.resultado < 0 ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {l.resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removerLinha(i)}
                      title="Excluir parcela"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarLinha}
                className="text-xs text-sky-700 hover:text-sky-900 border-sky-300 hover:bg-sky-50"
              >
                <Plus className="mr-1 size-3.5" />
                Adicionar linha ao memorial
              </Button>
            </div>

            {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}
          </div>

          {/* Coluna Direita: Card 'Como funciona' */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-3.5">
            <h4 className="font-bold text-slate-900 text-sm">Como funciona</h4>
            <ol className="space-y-2 text-slate-600 list-decimal list-inside leading-relaxed text-[11px]">
              <li>Dê um nome claro para cada parcela da medição.</li>
              <li>Use operações simples na fórmula: soma (+), subtração (-), multiplicação (*), divisão (/) e parênteses.</li>
              <li>Use valor negativo para descontos, como portas, janelas ou áreas preservadas.</li>
              <li>O resultado de todas as linhas preenche automaticamente a quantidade do serviço.</li>
            </ol>

            <div className="bg-sky-50 border border-sky-200 rounded p-2.5 text-sky-900 text-[11px] leading-relaxed">
              O memorial fica salvo junto ao item e pode ser incluído nos relatórios técnicos do orçamento.
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 flex items-center justify-between sm:justify-between w-full">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wide block font-semibold">
              Quantidade calculada
            </span>
            <span className="text-xl font-black text-sky-700 tabular-nums">
              {totalCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
              <span className="text-xs font-semibold text-slate-600">{unidade}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvar}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="size-4" />
              Aplicar quantidade
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
