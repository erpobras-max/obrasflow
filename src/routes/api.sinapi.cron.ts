import { createFileRoute } from '@tanstack/react-router'
import { verificarNovaCompetencia } from '@/lib/sinapi/sinapi-import.functions'

export const Route = createFileRoute('/api/sinapi/cron')({
  server: { handlers: { GET: async ({ request }) => {
    const segredo = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!import.meta.env.SINAPI_CRON_SECRET || segredo !== import.meta.env.SINAPI_CRON_SECRET) return new Response('Não autorizado', { status: 401 })
    const resultado = await verificarNovaCompetencia({ paginaOficial: 'https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/referencias-precos-insumos/Paginas/default.aspx', ultimaCompetencia: null })
    return Response.json({ ok: true, ...resultado, acao: resultado.nova ? 'aguardando_processamento_em_lotes' : 'sem_alteracao' })
  } } },
})

