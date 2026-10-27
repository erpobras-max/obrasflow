import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type StaticAssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type WorkerEnvironment = {
  ASSETS?: StaticAssetsBinding;
  CRON_SECRET?: string;
};

type ScheduledController = { cron: string };
type ExecutionContext = { waitUntil: (promise: Promise<unknown>) => void };

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (module) => (module.default ?? module) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function isStaticAssetRequest(request: Request) {
  const path = new URL(request.url).pathname;
  return (
    path.startsWith("/assets/") ||
    path.startsWith("/push/onesignal/") ||
    path === "/sw.js" ||
    path === "/manifest.json" ||
    path === "/favicon.ico" ||
    /^\/(?:icon|apple-touch-icon)-.+\.(?:png|svg|ico)$/i.test(path)
  );
}

async function serveStaticAsset(request: Request, env: unknown) {
  if (!isStaticAssetRequest(request)) return null;

  const assets = (env as WorkerEnvironment | undefined)?.ASSETS;
  if (!assets) return null;

  const response = await assets.fetch(request);
  return response.status === 404 ? null : response;
}

async function executarRotaAgendada(path: string, env: WorkerEnvironment, ctx: ExecutionContext) {
  if (!env.CRON_SECRET) throw new Error("CRON_SECRET não configurado no Worker.");
  const handler = await getServerEntry();
  const response = await handler.fetch(new Request(`https://obrasflow.erpobras.workers.dev${path}`, {
    method: "POST",
    headers: { "x-cron-secret": env.CRON_SECRET },
  }), env, ctx);
  if (!response.ok) throw new Error(`Falha na rotina ${path}: HTTP ${response.status}`);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const assetResponse = await serveStaticAsset(request, env);
      if (assetResponse) return assetResponse;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
  scheduled(controller: ScheduledController, env: WorkerEnvironment, ctx: ExecutionContext) {
    const path = controller.cron === "0 10 * * *"
      ? "/api/cron-resumo-diario"
      : "/api/cron-prazos";
    ctx.waitUntil(executarRotaAgendada(path, env, ctx));
  },
};
