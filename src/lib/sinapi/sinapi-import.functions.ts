import { descobrirCompetencia } from './sinapi-descoberta'

export interface SinapiImportEnv { paginaOficial: string; ultimaCompetencia?: string | null }

export async function verificarNovaCompetencia({ paginaOficial, ultimaCompetencia }: SinapiImportEnv) {
  const resposta = await fetch(paginaOficial, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15_000) })
  if (!resposta.ok) throw new Error(`Falha ao consultar a Caixa (${resposta.status})`)
  const descoberta = descobrirCompetencia(await resposta.text())
  return { ...descoberta, nova: descoberta.competencia !== ultimaCompetencia }
}

