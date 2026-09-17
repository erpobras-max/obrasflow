// Custom server-side Supabase admin client (service role) pointing at the user's own project.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PROJECT_URL } from './client.custom';

function createSupabaseAdminClient() {
  const SUPABASE_SERVICE_ROLE_KEY = 
    process.env.MY_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variável MY_SUPABASE_SERVICE_ROLE_KEY não encontrada no process.env ou import.meta.env do servidor. Lembre-se de reiniciar o servidor (npm run dev / bun run dev) após alterar o arquivo .env.');
  }

  return createClient(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
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
