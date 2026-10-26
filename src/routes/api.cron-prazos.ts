import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client.custom";
import { enviarEmailAvisoOS } from "@/lib/email-service.server";

function getSupabaseClient() {
  const runtimeEnv = (globalThis as unknown as { __env__?: Record<string, string> }).__env__;
  const serviceKey = (
    runtimeEnv?.MY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.MY_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();

  return createClient(SUPABASE_PROJECT_URL, serviceKey || SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const Route = createFileRoute("/api/cron-prazos")({
  server: {
    handlers: {
      GET: async () => processarPrazos(),
      POST: async () => processarPrazos(),
    },
  },
});

async function processarPrazos() {
  const supabase = getSupabaseClient();

  try {
    // Chama a função RPC com SECURITY DEFINER no PostgreSQL
    const { data, error } = await supabase.rpc("processar_prazos_ordens_servico");

    if (error) {
      console.error("[CronPrazos] Erro na RPC:", error.message);
      return new Response(JSON.stringify({ sucesso: false, erro: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resultado = data as {
      totalVerificadas?: number;
      sinosCriados?: number;
      emailsParaEnvio?: Array<{
        osId: string;
        numero: string;
        titulo: string;
        descricao?: string | null;
        obraNome?: string | null;
        dataPrevisao: string;
        tipoAviso: "atrasada" | "vence_hoje" | "vence_amanha" | "vence_breve";
        email: string;
        responsavelNome?: string;
      }>;
    };

    let emailsDisparados = 0;
    const detalhes = [];

    for (const item of resultado?.emailsParaEnvio || []) {
      const emailResult = await enviarEmailAvisoOS({
        destinatario: item.email,
        destinatarioNome: item.responsavelNome || "Responsável",
        osNumero: item.numero,
        osTitulo: item.titulo,
        osDescricao: item.descricao,
        obraNome: item.obraNome,
        dataPrevisao: item.dataPrevisao,
        tipoAviso: item.tipoAviso,
      });

      if (emailResult.sucesso) {
        emailsDisparados++;
        detalhes.push({ os: item.numero, email: item.email, status: "enviado" });
      } else {
        detalhes.push({ os: item.numero, email: item.email, status: `erro: ${emailResult.erro}` });
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        totalOSs: resultado?.totalVerificadas || 0,
        sinosNotificados: resultado?.sinosCriados || 0,
        emailsDisparados,
        detalhes,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CronPrazos] Erro interno:", msg);
    return new Response(JSON.stringify({ sucesso: false, erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
