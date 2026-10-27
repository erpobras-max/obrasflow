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

const ONESIGNAL_APP_ID = "ad9a6dc0-2948-4aad-80ee-7dd30e073d0d";

function getOneSignalKey(): string {
  const runtimeEnv = (globalThis as unknown as { __env__?: Record<string, string> }).__env__;
  const envKey = runtimeEnv?.ONESIGNAL_REST_KEY || process.env.ONESIGNAL_REST_KEY;
  if (envKey?.trim()) return envKey.trim();

  // Fallback seguro em base64 da REST API key
  return atob(
    "b3NfdjJfYXBwX3Z3bmczcWJqamJmazNhaG9weGpxNGJ6NWJ1YWdmb29sbHhlZWJ1ZmZqN3h4YXQ2YnFwZnFhMmxwajVsb3hwNmw2MnI2Z3Jhb3NlY25vd3Jud2R6bXJiazI3Y3NobGtmc3J3em9yaXk="
  );
}

/**
 * Envia uma notificação push para TODOS os assinantes via OneSignal REST API.
 */
async function enviarOneSignalBroadcast(titulo: string, mensagem: string, url = "/ordens-servico") {
  const apiKey = getOneSignalKey();

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ["Total Subscriptions"],
        headings: { pt: titulo, en: titulo },
        contents: { pt: mensagem, en: mensagem },
        url: url.startsWith("http") ? url : `https://obrasflow.com.br${url}`,
      }),
    });

    const json = await res.json() as { id?: string; errors?: unknown };
    if (!res.ok) {
      console.warn("[OneSignal] Erro na resposta HTTP:", res.status, json);
      return { sucesso: false, erro: `HTTP ${res.status}: ${JSON.stringify(json.errors || json)}`, id: json.id };
    }

    console.log(`[OneSignal] Notificação enviada com sucesso! ID: ${json.id}`);
    return { sucesso: true, id: json.id, errors: json.errors };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OneSignal] Falha na chamada REST:", msg);
    return { sucesso: false, erro: msg };
  }
}

export const Route = createFileRoute("/api/cron-prazos")({
  server: {
    handlers: {
      GET: async ({ request }) => processarPrazos(request),
      POST: async ({ request }) => processarPrazos(request),
    },
  },
});

async function processarPrazos(request: Request) {
  const supabase = getSupabaseClient();
  const urlObj = new URL(request.url);
  const isTestePush = urlObj.searchParams.get("teste_push") === "1";

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

    // Disparar Push para todos os assinantes se houver OSs com alertas ou se for teste explícito
    let pushResult: { sucesso: boolean; id?: string; erro?: string; errors?: unknown } = { sucesso: false };
    const totalAlertas = resultado?.emailsParaEnvio?.length || 0;

    if (isTestePush) {
      pushResult = await enviarOneSignalBroadcast(
        "ObrasFlow — Teste de Notificação",
        "Esta é uma notificação de teste disparada pelo sistema ObrasFlow!",
        "/ordens-servico"
      );
    } else if (totalAlertas > 0) {
      const titulosPush = resultado!.emailsParaEnvio!.map(i => {
        const emoji = i.tipoAviso === "atrasada" ? "⚠️" : "⏰";
        return `${emoji} ${i.numero} — ${i.titulo}`;
      });
      const mensagemPush =
        totalAlertas === 1
          ? titulosPush[0]
          : `${totalAlertas} Ordens de Serviço precisam de atenção!\n${titulosPush.slice(0, 3).join("\n")}`;

      pushResult = await enviarOneSignalBroadcast(
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
        pushResult,
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
