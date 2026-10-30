import * as React from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ResumoCusto } from '@/lib/orcamento-analitico'

const brl = (v: number) =>
  (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Componente CircularDonut que desenha o anel de progresso verde
 * com a porcentagem no centro, idêntico às fotos 2 e 3 do usuário.
 */
export function CircularDonut({ percent }: { percent: number }) {
  const radius = 12
  const circumference = 2 * Math.PI * radius // ~75.4
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center w-8 h-8 flex-shrink-0">
      <svg className="w-8 h-8 -rotate-90 transform" viewBox="0 0 32 32">
        <circle
          cx="16"
          cy="16"
          r={radius}
          stroke="#e2e8f0"
          strokeWidth="3"
          fill="none"
        />
        {clamped > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            stroke="#22c55e"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
      <span className="absolute text-[10px] font-semibold text-slate-600 tracking-tight">
        {clamped}%
      </span>
    </div>
  )
}

export interface ItemDiscriminacao {
  nome: string
  valorCentavos: number
}

/**
 * Tabela com as 4 linhas discriminando os gastos (Mão de obra, Material, Equipamento, Outros)
 * e o anel verde circular com a porcentagem ao lado.
 */
export function DiscriminacaoCard({
  itens,
  totalCentavos,
}: {
  itens: ItemDiscriminacao[]
  totalCentavos: number
}) {
  return (
    <div className="w-72 bg-white text-slate-800 p-3.5 rounded-lg shadow-xl border border-slate-200 text-xs">
      <div className="space-y-2.5">
        {itens.map((item) => {
          const pct = totalCentavos > 0 ? Math.round((item.valorCentavos / totalCentavos) * 100) : 0
          return (
            <div key={item.nome} className="flex items-center justify-between gap-3">
              <span className="text-slate-600 font-normal text-xs">{item.nome}</span>
              <div className="flex items-center gap-3">
                <span className="tabular-nums font-semibold text-slate-800 text-xs">
                  {brl(item.valorCentavos)}
                </span>
                <CircularDonut percent={pct} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * HoverCard acionado ao passar o mouse, mostrando o discriminador de custos ou preços
 */
export function ResumoCustosHoverCard({
  itens,
  totalCentavos,
  children,
  side = 'top',
  align = 'end',
}: {
  itens: ItemDiscriminacao[]
  totalCentavos: number
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <HoverCard openDelay={80} closeDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={8}
        className="p-0 border-none bg-transparent shadow-none w-auto z-50"
      >
        <DiscriminacaoCard itens={itens} totalCentavos={totalCentavos} />
      </HoverCardContent>
    </HoverCard>
  )
}

/**
 * Componente padrão compatível com os itens da tabela (comportamento de clique ou hover)
 */
export function ResumoCustosPopover({
  resumo,
  children,
  titulo,
  subtitulo,
}: {
  resumo: ResumoCusto
  children: React.ReactNode
  titulo?: string
  subtitulo?: string
}) {
  const itens: ItemDiscriminacao[] = [
    { nome: 'Mão de obra', valorCentavos: resumo.maoDeObraCentavos },
    { nome: 'Material', valorCentavos: resumo.materialCentavos },
    { nome: 'Equipamento', valorCentavos: resumo.equipamentoCentavos },
    { nome: 'Outros', valorCentavos: resumo.outrosCentavos },
  ]

  return (
    <HoverCard openDelay={80} closeDelay={150}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="end"
        sideOffset={8}
        className="p-0 border-none bg-transparent shadow-none w-auto z-50"
      >
        <div className="w-72 bg-white text-slate-800 p-3.5 rounded-lg shadow-xl border border-slate-200 text-xs">
          {titulo && (
            <div className="mb-2.5 pb-2 border-b border-slate-100">
              <h5 className="font-bold text-slate-800 text-xs line-clamp-1">{titulo}</h5>
              {subtitulo && <p className="text-[10px] text-slate-400">{subtitulo}</p>}
            </div>
          )}
          <div className="space-y-2.5">
            {itens.map((item) => {
              const pct =
                resumo.totalCentavos > 0
                  ? Math.round((item.valorCentavos / resumo.totalCentavos) * 100)
                  : 0
              return (
                <div key={item.nome} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600 font-normal text-xs">{item.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold text-slate-800 text-xs">
                      {brl(item.valorCentavos)}
                    </span>
                    <CircularDonut percent={pct} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
