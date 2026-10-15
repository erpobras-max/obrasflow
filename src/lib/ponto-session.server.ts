import { useSession as getServerSession } from "@tanstack/react-start/server";
import {
  createSupabaseAdminClient,
  getSupabaseServiceRoleKey,
} from "@/integrations/supabase/client.server.custom";

type PontoSession = { funcionarioId?: string };

export async function getPontoSession() {
  const password = getSupabaseServiceRoleKey();
  if (!password) throw new Error("A configuração do acesso ao ponto está indisponível.");

  return getServerSession<PontoSession>({
    name: "obrasflow-ponto",
    password,
    maxAge: 12 * 60 * 60,
    cookie: {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      path: "/",
    },
  });
}

export async function getPontoFuncionario() {
  const session = await getPontoSession();
  const funcionarioId = session.data.funcionarioId;
  if (!funcionarioId) return null;

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("funcionarios")
    .select("id,nome,cargo,matricula,obra_id,carga_horaria_semanal")
    .eq("id", funcionarioId)
    .eq("status", "ativo")
    .maybeSingle();
  if (error) throw error;
  if (!data) await session.clear();
  return data ? { supabaseAdmin, funcionario: data } : null;
}

