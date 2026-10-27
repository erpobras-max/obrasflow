import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client.custom";
import { enviarEmailAvisoOS } from "@/lib/email-service.server";
import { autorizarNotificacoes } from "@/lib/notificacoes-auth.server";
import { enviarPushOneSignal, enviarSmsOneSignal } from "@/lib/onesignal.server";

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

async function registrarResultado(
  supabase: ReturnType<typeof getSupabaseClient>,
  osId: string,
  tipo: "email" | "sms" | "push",
  sucesso: boolean,
  detalhes?: string,
) {
  const dataEnvio = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await (supabase as any)
    .from("notificacoes_historico")
    .update({ status: sucesso ? "sucesso" : "erro", detalhes: detalhes || null })
    .eq("referencia_tipo", "ordens_servico")
    .eq("referencia_id", osId)
    .eq("tipo", tipo)
    .eq("data_envio", dataEnvio);
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

  const auth = await autorizarNotificacoes(request, supabase);
  if (!auth.autorizado) {
    return Response.json({ sucesso: false, erro: "Não autorizado." }, { status: 401 });
  }

  if (isTestePush) {
    if (!auth.userId) {
      return Response.json({ sucesso: false, erro: "O teste exige um usuário autenticado." }, { status: 401 });
    }
    const pushResult = await enviarPushOneSignal(
      auth.userId,
      "ObrasFlow — Teste de Notificação",
      "Seu navegador está pronto para receber alertas do ObrasFlow.",
      `${urlObj.origin}/ordens-servico`,
    );
    return Response.json(
      { sucesso: pushResult.sucesso, pushDisparado: pushResult.sucesso, pushResult },
      { status: pushResult.sucesso ? 200 : 502 },
    );
  }

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
        email?: string | null;
        telefone?: string | null;
        responsavelUserId?: string | null;
        enviarEmail?: boolean;
        enviarSms?: boolean;
        enviarPush?: boolean;
        responsavelNome?: string;
      }>;
    };

    let emailsDisparados = 0;
    let smsDisparados = 0;
    let pushDisparados = 0;
    const detalhes: Array<{ os: string; canal: string; status: string }> = [];

    for (const item of resultado?.emailsParaEnvio || []) {
      const mensagem = `${item.numero} — ${item.titulo} requer atenção. Acesse o ObrasFlow para acompanhar.`;
      if (item.enviarEmail && item.email) {
        const emailResult = await enviarEmailAvisoOS({
          destinatario: item.email,
          destinatarioNome: item.responsavelNome || "Responsável",
          osNumero: item.numero,
          osTitulo: item.titulo,
          osDescricao: item.descricao,
          obraNome: item.obraNome,
          dataPrevisao: item.dataPrevisao,
          tipoAviso: item.tipoAviso,
          sistemaUrl: `${urlObj.origin}/ordens-servico`,
        });
        if (emailResult.sucesso) emailsDisparados++;
        detalhes.push({ os: item.numero, canal: "email", status: emailResult.sucesso ? "enviado" : `erro: ${emailResult.erro}` });
        await registrarResultado(supabase, item.osId, "email", emailResult.sucesso, emailResult.id || emailResult.erro);
      }

      if (item.enviarSms && item.telefone) {
        const smsResult = await enviarSmsOneSignal(item.telefone, mensagem);
        if (smsResult.sucesso) smsDisparados++;
        detalhes.push({ os: item.numero, canal: "sms", status: smsResult.sucesso ? "enviado" : `erro: ${smsResult.erro}` });
        await registrarResultado(supabase, item.osId, "sms", smsResult.sucesso, smsResult.id || smsResult.erro);
      }

      if (item.enviarPush && item.responsavelUserId) {
        const pushResult = await enviarPushOneSignal(
          item.responsavelUserId,
          `Alerta de prazo — ${item.numero}`,
          mensagem,
          `${urlObj.origin}/ordens-servico`,
        );
        if (pushResult.sucesso) pushDisparados++;
        detalhes.push({ os: item.numero, canal: "push", status: pushResult.sucesso ? "enviado" : `erro: ${pushResult.erro}` });
        await registrarResultado(supabase, item.osId, "push", pushResult.sucesso, pushResult.id || pushResult.erro);
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        totalOSs: resultado?.totalVerificadas || 0,
        sinosNotificados: resultado?.sinosCriados || 0,
        emailsDisparados,
        smsDisparados,
        pushDisparados,
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
