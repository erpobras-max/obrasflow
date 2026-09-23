// Custom server-side Supabase admin client (service role) pointing at the user's own project.
import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";
import { SUPABASE_PROJECT_URL } from "./client.custom";

type WorkerBindings = {
  MY_SUPABASE_SERVICE_ROLE_KEY?: string;
};

/**
 * O adaptador Nitro/Vite executa o SSR como um serviço interno. Na versão
 * atual, esse serviço não recebe o segundo argumento `env`, mas o entrypoint
 * principal do Nitro preserva os bindings em `globalThis.__env__` antes de
 * encaminhar a requisição. Consulte esse ambiente primeiro e mantenha os
 * fallbacks para desenvolvimento local e futuras versões do adaptador.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  const runtimeEnv = (globalThis as typeof globalThis & { __env__?: WorkerBindings }).__env__;
  const moduleEnv = env as unknown as WorkerBindings;

  return (
    runtimeEnv?.MY_SUPABASE_SERVICE_ROLE_KEY ||
    moduleEnv.MY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.MY_SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
}

export function createSupabaseAdminClient() {
  const SUPABASE_SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Credencial administrativa ausente no servidor."), { code: "SERVER_KEY_MISSING" });
  }

  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
