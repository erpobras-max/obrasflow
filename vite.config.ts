// A configuração da Lovable já inclui TanStack Start, React, Tailwind, aliases e
// o adaptador Nitro para Cloudflare Workers. Não adicione plugins duplicados aqui.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        // Módulo resolvido exclusivamente pelo runtime do Cloudflare Worker.
        external: ["cloudflare:workers"],
      },
    },
  },
  tanstackStart: {
    // Usa a camada de servidor personalizada para apresentar falhas de SSR.
    server: { entry: "server" },
  },
});
