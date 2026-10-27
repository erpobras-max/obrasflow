import type { SupabaseClient } from "@supabase/supabase-js";

export async function autorizarNotificacoes(request: Request, supabase: SupabaseClient): Promise<{
  autorizado: boolean;
  userId?: string;
}> {
  const runtimeEnv = (globalThis as unknown as { __env__?: Record<string, string> }).__env__;
  const cronSecret = (runtimeEnv?.CRON_SECRET || process.env.CRON_SECRET)?.trim();
  const providedCronSecret = request.headers.get("x-cron-secret")?.trim();
  if (cronSecret && providedCronSecret === cronSecret) return { autorizado: true };

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { autorizado: false };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { autorizado: false };

  const [{ data: roles }, { data: perfil }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    supabase.from("perfis_usuarios").select("perfil").eq("user_id", data.user.id).maybeSingle(),
  ]);
  const permitidos = new Set(["admin", "diretor", "engenharia"]);
  const perfis = [...(roles || []).map(item => item.role), perfil?.perfil].filter(Boolean);
  return perfis.some(role => permitidos.has(role))
    ? { autorizado: true, userId: data.user.id }
    : { autorizado: false };
}
