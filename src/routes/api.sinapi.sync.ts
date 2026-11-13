import { createFileRoute } from '@tanstack/react-router'
import { sincronizarSinapiNoServidor } from '@/lib/sinapi/sinapi-sync.server'

export const Route = createFileRoute('/api/sinapi/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
          if (!token) return Response.json({ erro: 'Sessão não informada' }, { status: 401 })
          const body = await request.json().catch(() => ({})) as { uf?: string; mes?: string }
          const resultado = await sincronizarSinapiNoServidor(token, body.uf || 'SP', body.mes || '')
          return Response.json({ ok: true, ...resultado })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.error('[SINAPI] sincronização no servidor:', message)
          return Response.json({ ok: false, erro: message }, { status: 502 })
        }
      },
    },
  },
})
