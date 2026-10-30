const DOMINIOS_OFICIAIS = new Set(['www.caixa.gov.br', 'caixa.gov.br'])

export function descobrirCompetencia(html: string) {
  const candidatos: Array<{ competencia: string; url: string; ordem: number }> = []
  for (const match of html.matchAll(/href=["']([^"']*SINAPI[^"']*?(20\d{2})(0[1-9]|1[0-2])[^"']*\.zip)["']/gi)) {
    const url = new URL(match[1], 'https://www.caixa.gov.br')
    if (!DOMINIOS_OFICIAIS.has(url.hostname.toLowerCase()) || url.protocol !== 'https:') continue
    const ano = Number(match[2]); const mes = Number(match[3])
    candidatos.push({ competencia: `${String(mes).padStart(2, '0')}/${ano}`, url: url.href, ordem: ano * 100 + mes })
  }
  if (!candidatos.length) throw new Error('Nenhum pacote SINAPI oficial foi encontrado')
  const recente = candidatos.sort((a, b) => b.ordem - a.ordem)[0]
  return { competencia: recente.competencia, url: recente.url }
}

