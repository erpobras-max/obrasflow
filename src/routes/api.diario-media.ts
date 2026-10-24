import { createFileRoute } from "@tanstack/react-router";
import { streamFromR2Server, verifySignedDiarioMediaUrl } from "@/lib/r2.server";

export const Route = createFileRoute("/api/diario-media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        const expires = Number(url.searchParams.get("expires"));
        const signature = url.searchParams.get("signature") ?? "";
        if (!(await verifySignedDiarioMediaUrl(key, expires, signature))) {
          return new Response("Link de mídia inválido ou expirado.", { status: 403 });
        }
        return streamFromR2Server(key, request);
      },
    },
  },
});
