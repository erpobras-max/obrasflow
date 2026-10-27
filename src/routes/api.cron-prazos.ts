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

function getPushAlertKey(): string | undefined {
  const runtimeEnv = (globalThis as unknown as { __env__?: Record<string, string> }).__env__;
  return (
    runtimeEnv?.PUSHALERT_API_KEY ||
    process.env.PUSHALERT_API_KEY ||
    "pa_5LPuFHUpOHj6B0zrXd0scxx7FjUGPUOz_2zTsCh"
  )?.trim();
}

/**
 * Envia uma notificação push para TODOS os assinantes via PushAlert REST API.
 */
async function enviarPushAlertBroadcast(titulo: string, mensagem: string, url = "/ordens-servico") {
  const apiKey = getPushAlertKey();
  if (!apiKey) {
    console.warn("[PushAlert] PUSHALERT_API_KEY não configurada. Pulando push.");
    return { sucesso: false, erro: "PUSHALERT_API_KEY ausente" };
  }

  try {
    const res = await fetch("https://api.pushalert.co/rest/v1/send", {
      method: "POST",
      headers: {
        "Authorization": `api_key=${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: titulo, message: mensagem, url }),
    });

    const json = await res.json() as { success?: boolean; error?: string; sent?: number };
    if (!res.ok || !json.success) {
      console.error("[PushAlert] Erro ao enviar broadcast:", json);
      return { sucesso: false, erro: json.error || `HTTP ${res.status}` };
    }

    console.log(`[PushAlert] Push enviado para ${json.sent ?? "?"} assinantes.`);
    return { sucesso: true, enviados: json.sent };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[PushAlert] Falha na chamada REST:", msg);
    return { sucesso: false, erro: msg };
  }
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
    const detalhes: Array<{ os: string; email: string; status: string }> = [];

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

    // Disparar Push para todos os assinantes se houver OSs com alertas
    let pushResult: { sucesso: boolean; enviados?: number; erro?: string } = { sucesso: false };
    const totalAlertas = resultado?.emailsParaEnvio?.length || 0;

    if (totalAlertas > 0) {
      const titulosPush = resultado!.emailsParaEnvio!.map(i => {
        const emoji = i.tipoAviso === "atrasada" ? "⚠️" : "⏰";
        return `${emoji} ${i.numero} — ${i.titulo}`;
      });
      const mensagemPush =
        totalAlertas === 1
          ? titulosPush[0]
          : `${totalAlertas} Ordens de Serviço precisam de atenção!\n${titulosPush.slice(0, 3).join("\n")}`;

      pushResult = await enviarPushAlertBroadcast(
        "ObrasFlow — Alerta de Prazos",
        mensagemPush,
        "/ordens-servico"
      );
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        totalOSs: resultado?.totalVerificadas || 0,
        sinosNotificados: resultado?.sinosCriados || 0,
        emailsDisparados,
        pushDisparado: pushResult.sucesso,
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
