import { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Check, X, Pencil } from 'lucide-react'

export interface BdiValores {
  geral: number
  maoDeObra: number
  material: number
  equipamento: number
  outros: number
}

interface ComposicaoBdiPopoverProps {
  valores: BdiValores
  onSalvar: (novos: BdiValores) => void
  disabled?: boolean
  children?: React.ReactNode
}

export function ComposicaoBdiPopover({
  valores,
  onSalvar,
  disabled = false,
  children,
}: ComposicaoBdiPopoverProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<BdiValores>(valores)

  useEffect(() => {
    setDraft(valores)
  }, [valores, open])

  function handleGeralChange(val: number) {
    setDraft((prev) => ({
      ...prev,
      geral: val,
      // Se todos os outros eram iguais ao geral anterior, sincroniza todos
      maoDeObra: prev.maoDeObra === prev.geral ? val : prev.maoDeObra,
      material: prev.material === prev.geral ? val : prev.material,
      equipamento: prev.equipamento === prev.geral ? val : prev.equipamento,
      outros: prev.outros === prev.geral ? val : prev.outros,
    }))
  }

  function handleSalvar() {
    onSalvar(draft)
    setOpen(false)
  }

  function handleCancelar() {
    setDraft(valores)
    setOpen(false)
  }

  const formatPct = (n: number) => n.toFixed(2).replace('.', ',')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-300 hover:border-emerald-500 rounded text-slate-800 font-semibold text-sm transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <span>{formatPct(valores.geral)}%</span>
            <Pencil className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-64 p-3.5 bg-white border border-slate-200 shadow-2xl rounded-lg text-slate-800 z-50"
      >
        <h4 className="font-bold text-slate-700 text-xs mb-3 text-center tracking-tight">
          Composição do BDI Geral
        </h4>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-600 font-medium">Mão de Obra</label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.maoDeObra}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, maoDeObra: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="h-7 text-xs font-semibold text-slate-800 bg-slate-100 border-slate-200 text-right pr-6 focus:bg-white"
              />
              <span className="absolute right-2 top-1.5 text-[11px] text-slate-400 font-medium">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-600 font-medium">Material</label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.material}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, material: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="h-7 text-xs font-semibold text-slate-800 bg-slate-100 border-slate-200 text-right pr-6 focus:bg-white"
              />
              <span className="absolute right-2 top-1.5 text-[11px] text-slate-400 font-medium">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-600 font-medium">Equipamento</label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.equipamento}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, equipamento: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="h-7 text-xs font-semibold text-slate-800 bg-slate-100 border-slate-200 text-right pr-6 focus:bg-white"
              />
              <span className="absolute right-2 top-1.5 text-[11px] text-slate-400 font-medium">%</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-slate-600 font-medium">Outros</label>
            <div className="relative w-28">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draft.outros}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, outros: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="h-7 text-xs font-semibold text-slate-800 bg-slate-100 border-slate-200 text-right pr-6 focus:bg-white"
              />
              <span className="absolute right-2 top-1.5 text-[11px] text-slate-400 font-medium">%</span>
            </div>
          </div>
        </div>

        {/* LINHA SEPARADORA E BDI GERAL COM FUNDO DESTACADO */}
        <div className="bg-slate-100/90 -mx-3.5 px-3.5 py-2 border-t border-slate-200 flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-800">BDI Geral</label>
          <div className="relative w-28">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draft.geral}
              onChange={(e) => handleGeralChange(Math.max(0, Number(e.target.value) || 0))}
              className="h-7 text-xs font-bold text-slate-900 bg-white border-slate-300 text-right pr-6"
            />
            <span className="absolute right-2 top-1.5 text-[11px] text-slate-500 font-bold">%</span>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO: [ X ] e [ ✓ ] (IDÊNTICO À FOTO 4) */}
        <div className="flex items-center justify-end gap-2 pt-2.5 mt-1">
          <button
            type="button"
            onClick={handleCancelar}
            className="w-8 h-8 rounded border border-slate-300 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors shadow-2xs cursor-pointer"
            title="Cancelar"
          >
            <X className="w-4 h-4 text-slate-700 stroke-[2.5]" />
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            className="w-8 h-8 rounded bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors shadow-xs cursor-pointer"
            title="Aplicar BDI"
          >
            <Check className="w-4 h-4 text-white stroke-[2.5]" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
