import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarEmailAvisoOS } from "@/lib/email-service.server";

export const Route = createFileRoute("/api/cron-prazos")({
  server: {
    handlers: {
      GET: async () => processarPrazos(),
      POST: async () => processarPrazos(),
    },
  },
});

async function processarPrazos() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeIsoStr = hoje.toISOString().split("T")[0];

  try {
    // 1. Buscar ordens de serviço pendentes
    const { data: ordens, error } = await supabaseAdmin
      .from("ordens_servico")
      .select(`
        id,
        numero,
        titulo,
        descricao,
        data_previsao,
        prioridade,
        status,
        responsavel_id,
        responsavel_nome,
        responsavel_telefone,
        obra_id,
        obras ( nome )
      `)
      .not("status", "in", '("concluida","cancelada")');

    if (error) {
      console.error("[CronPrazos] Erro ao consultar ordens_servico:", error.message);
      return new Response(JSON.stringify({ sucesso: false, erro: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const relatorio = {
      dataExecucao: hojeIsoStr,
      totalOSs: ordens?.length || 0,
      alertasProcessados: 0,
      emailsDisparados: 0,
      sinosNotificados: 0,
      detalhes: [] as Array<{
        os: string;
        tipo: string;
        email?: string;
        status: string;
      }>,
    };

    if (!ordens || ordens.length === 0) {
      return new Response(JSON.stringify({ ...relatorio, mensagem: "Nenhuma OS pendente encontrada." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Buscar e-mails dos responsáveis em perfis_usuarios
    const responsaveisIds = ordens
      .map((o) => o.responsavel_id)
      .filter((id): id is string => Boolean(id));

    let emailMap: Record<string, string> = {};
    if (responsaveisIds.length > 0) {
      const { data: perfis } = await supabaseAdmin
        .from("perfis_usuarios")
        .select("id, email")
        .in("id", responsaveisIds);

      if (perfis) {
        emailMap = Object.fromEntries(
          perfis.filter((p) => p.email).map((p) => [p.id, p.email as string])
        );
      }
    }

    // 2. Iterar sobre cada OS e avaliar o prazo
    for (const os of ordens) {
      if (!os.data_previsao) continue;

      const [ano, mes, dia] = os.data_previsao.split("-").map(Number);
      const dataPrev = new Date(ano, mes - 1, dia);
      const diffMs = dataPrev.getTime() - hoje.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      let tipoAviso: "atrasada" | "vence_hoje" | "vence_amanha" | "vence_breve" | null = null;

      if (diffDias < 0) {
        tipoAviso = "atrasada";
      } else if (diffDias === 0) {
        tipoAviso = "vence_hoje";
      } else if (diffDias === 1) {
        tipoAviso = "vence_amanha";
      } else if (diffDias <= 2) {
        tipoAviso = "vence_breve";
      }

      // Se não atingiu o gatilho de aviso, ignora
      if (!tipoAviso) continue;

      relatorio.alertasProcessados++;

      // Verificar se já enviamos notificação para esta OS hoje (Idempotência)
      const { data: jaEnviado } = await supabaseAdmin
        .from("notificacoes_historico")
        .select("id")
        .eq("referencia_tipo", "ordens_servico")
        .eq("referencia_id", os.id)
        .eq("data_envio", hojeIsoStr)
        .maybeSingle();

      if (jaEnviado) {
        relatorio.detalhes.push({
          os: os.numero,
          tipo: tipoAviso,
          status: "ignorado_ja_enviado_hoje",
        });
        continue;
      }

      // A. Registrar no Sino do Sistema (notificacoes_usuario)
      if (os.responsavel_id) {
        let msgSino = `A Ordem de Serviço ${os.numero} (${os.titulo}) vence em breve.`;
        if (tipoAviso === "atrasada") {
          msgSino = `⚠️ ATENÇÃO: A OS ${os.numero} (${os.titulo}) está ATRASADA!`;
        } else if (tipoAviso === "vence_hoje") {
          msgSino = `⏰ A OS ${os.numero} (${os.titulo}) vence HOJE!`;
        }

        try {
          await supabaseAdmin.from("notificacoes_usuario").insert({
            user_id: os.responsavel_id,
            titulo: `Alerta de OS: ${os.numero}`,
            mensagem: msgSino,
            lida: false,
          });
          relatorio.sinosNotificados++;
        } catch (e) {
          console.warn("[CronPrazos] Falha ao gravar no sino:", e);
        }
      }

      // B. Enviar E-mail via Resend se houver e-mail
      const emailDestino = os.responsavel_id ? emailMap[os.responsavel_id] : null;

      if (emailDestino) {
        const obraNome = Array.isArray(os.obras) ? os.obras[0]?.nome : os.obras?.nome;

        const emailResult = await enviarEmailAvisoOS({
          destinatario: emailDestino,
          destinatarioNome: os.responsavel_nome || "Responsável",
          osNumero: os.numero,
          osTitulo: os.titulo,
          osDescricao: os.descricao,
          obraNome,
          dataPrevisao: os.data_previsao,
          tipoAviso,
        });

        if (emailResult.sucesso) {
          relatorio.emailsDisparados++;
          relatorio.detalhes.push({
            os: os.numero,
            tipo: tipoAviso,
            email: emailDestino,
            status: "email_enviado",
          });
        } else {
          relatorio.detalhes.push({
            os: os.numero,
            tipo: tipoAviso,
            email: emailDestino,
            status: `email_erro: ${emailResult.erro}`,
          });
        }
      } else {
        relatorio.detalhes.push({
          os: os.numero,
          tipo: tipoAviso,
          status: "sem_email_cadastrado",
        });
      }

      // C. Gravar no histórico para não repetir hoje
      try {
        await supabaseAdmin.from("notificacoes_historico").insert({
          tipo: emailDestino ? "email" : "sino",
          referencia_tipo: "ordens_servico",
          referencia_id: os.id,
          destinatario: emailDestino || os.responsavel_nome || "responsavel",
          data_envio: hojeIsoStr,
          status: "sucesso",
          detalhes: `Aviso ${tipoAviso} processado`,
        });
      } catch (histErr) {
        console.warn("[CronPrazos] Falha ao gravar histórico:", histErr);
      }
    }

    return new Response(JSON.stringify({ sucesso: true, ...relatorio }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[CronPrazos] Erro interno:", msg);
    return new Response(JSON.stringify({ sucesso: false, erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
