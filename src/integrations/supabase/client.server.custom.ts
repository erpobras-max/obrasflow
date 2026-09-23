// Custom server-side Supabase admin client (service role) pointing at the user's own project.
import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";
import { SUPABASE_PROJECT_URL } from "./client.custom";

export function createSupabaseAdminClient() {
  const workerEnv = env as unknown as { MY_SUPABASE_SERVICE_ROLE_KEY?: string };
  const SUPABASE_SERVICE_ROLE_KEY =
    (workerEnv.MY_SUPABASE_SERVICE_ROLE_KEY || process.env.MY_SUPABASE_SERVICE_ROLE_KEY)?.trim();

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
