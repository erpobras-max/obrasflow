import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client.custom";
import { enviarEmailResumoMatinal } from "@/lib/email-service.server";
import type { DadosResumoExecutivo } from "@/lib/resumo-diario.types";

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

export const Route = createFileRoute("/api/cron-resumo-diario")({
  server: {
    handlers: {
      GET: async ({ request }) => processarResumoDiario(request),
      POST: async ({ request }) => processarResumoDiario(request),
    },
  },
});

async function processarResumoDiario(request: Request) {
  const supabase = getSupabaseClient();
  const url = new URL(request.url);
  const emailTeste = url.searchParams.get("email_teste") || undefined;

  try {
    // 1. Invoca a RPC agregadora com SECURITY DEFINER
    const { data, error } = await supabase.rpc("obter_resumo_executivo_diario");

    if (error) {
      console.error("[CronResumoDiario] Erro na RPC:", error.message);
      return new Response(JSON.stringify({ sucesso: false, erro: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resumo = data as DadosResumoExecutivo;

    // Se foi informado um e-mail de teste, envia apenas para ele
    const destinatarios = emailTeste
      ? [{ nome: "Gestor (Teste)", email: emailTeste, perfil: "admin" }]
      : resumo?.destinatarios || [];

    let emailsEnviados = 0;
    const detalhesEnvio: Array<{ email: string; status: string }> = [];

    for (const dest of destinatarios) {
      if (!dest.email || !dest.email.includes("@")) continue;

      const resultado = await enviarEmailResumoMatinal(resumo, dest.email, dest.nome);

      if (resultado.sucesso) {
        emailsEnviados++;
        detalhesEnvio.push({ email: dest.email, status: "enviado" });
      } else {
        detalhesEnvio.push({ email: dest.email, status: `erro: ${resultado.erro}` });
      }
    }

    return new Response(
      JSON.stringify({
        sucesso: true,
        dataReferencia: resumo?.data_referencia,
        empresa: resumo?.empresa_nome,
        kpis: {
          osVencendoHoje: resumo?.os_stats?.vencendo_hoje || 0,
          osAtrasadas: resumo?.os_stats?.atrasadas || 0,
          saldoProjetado: resumo?.financeiro_stats?.saldo_projetado_dia || 0,
          obrasAtivas: resumo?.operacional_stats?.obras_ativas_qtd || 0,
          pontosHoje: resumo?.operacional_stats?.pontos_registrados_hoje || 0,
        },
        totalDestinatarios: destinatarios.length,
        emailsEnviados,
        detalhesEnvio,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CronResumoDiario] Erro interno:", msg);
    return new Response(JSON.stringify({ sucesso: false, erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
