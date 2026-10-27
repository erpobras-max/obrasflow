import { definePlugin } from "nitro";

export default definePlugin((nitro) => {
  nitro.hooks.hook("cloudflare:scheduled", async ({ controller, env }) => {
    const cronSecret = (env as { CRON_SECRET?: string }).CRON_SECRET;
    if (!cronSecret) throw new Error("CRON_SECRET não configurado no Worker.");

    const path = controller.cron === "0 10 * * *"
      ? "/api/cron-resumo-diario"
      : "/api/cron-prazos";
    const response = await nitro.fetch(new Request(`https://obrasflow.erpobras.workers.dev${path}`, {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    }));
    if (!response.ok) throw new Error(`Falha na rotina ${path}: HTTP ${response.status}`);
  });
});
