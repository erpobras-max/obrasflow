import process from "node:process";

export interface DadosEmailOS {
  destinatario: string;
  destinatarioNome?: string;
  osNumero: string;
  osTitulo: string;
  osDescricao?: string | null;
  obraNome?: string | null;
  dataPrevisao: string;
  tipoAviso: "atrasada" | "vence_hoje" | "vence_amanha" | "vence_breve";
  sistemaUrl?: string;
}

/**
 * Envia e-mail formatado de aviso de prazo de Ordem de Serviço via Resend API
 */
export async function enviarEmailAvisoOS(dados: DadosEmailOS): Promise<{
  sucesso: boolean;
  id?: string;
  erro?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[EmailService] RESEND_API_KEY não configurada no ambiente.");
    return {
      sucesso: false,
      erro: "Chave RESEND_API_KEY não configurada nas variáveis do servidor.",
    };
  }

  const {
    destinatario,
    destinatarioNome = "Responsável",
    osNumero,
    osTitulo,
    osDescricao,
    obraNome,
    dataPrevisao,
    tipoAviso,
    sistemaUrl = "https://obrasflow.com/ordens-servico",
  } = dados;

  const dataFormatada = dataPrevisao
    ? new Date(dataPrevisao + "T12:00:00").toLocaleDateString("pt-BR")
    : "Não informada";

  let statusTitulo = "Aviso de Prazo";
  let statusCor = "#0284c7"; // azul
  let statusBadge = "Vence em breve";

  if (tipoAviso === "atrasada") {
    statusTitulo = "⚠️ Ordem de Serviço em Atraso";
    statusCor = "#e11d48"; // rose/vermelho
    statusBadge = "ATRASADA";
  } else if (tipoAviso === "vence_hoje") {
    statusTitulo = "⏰ Ordem de Serviço Vence HOJE!";
    statusCor = "#d97706"; // âmbar
    statusBadge = "VENCE HOJE";
  } else if (tipoAviso === "vence_amanha") {
    statusTitulo = "⏰ Ordem de Serviço Vence Amanhã";
    statusCor = "#d97706";
    statusBadge = "VENCE AMANHÃ";
  }

  const subject = `[ObrasFlow] ${statusTitulo}: ${osNumero} — ${osTitulo}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 24px; color: #ffffff; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 24px; }
    .alert-banner { background-color: ${statusCor}15; border-left: 4px solid ${statusCor}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .alert-banner strong { color: ${statusCor}; font-size: 14px; text-transform: uppercase; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; font-size: 14px; }
    .card-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 600; text-align: right; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 16px; text-align: center; }
    .footer { padding: 16px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ObrasFlow ERP</h1>
      <p>Sistema de Gestão de Construção e Engenharia</p>
    </div>
    <div class="content">
      <div class="alert-banner">
        <strong>${statusBadge}</strong>
        <div style="font-size: 13px; margin-top: 2px; color: #334155;">Verifique os prazos e garanta a conclusão das atividades.</div>
      </div>

      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
        Olá, <strong>${destinatarioNome}</strong>! A seguinte demanda sob sua responsabilidade requer atenção:
      </p>

      <div class="card">
        <div class="card-row">
          <span class="label">Identificador:</span>
          <span class="value" style="color: #0284c7;">${osNumero}</span>
        </div>
        <div class="card-row">
          <span class="label">Título:</span>
          <span class="value">${osTitulo}</span>
        </div>
        ${obraNome ? `
        <div class="card-row">
          <span class="label">Obra:</span>
          <span class="value">${obraNome}</span>
        </div>` : ''}
        <div class="card-row">
          <span class="label">Prazo de Conclusão:</span>
          <span class="value" style="color: ${statusCor};">${dataFormatada}</span>
        </div>
        ${osDescricao ? `
        <div style="padding-top: 8px; font-size: 13px; color: #475569;">
          <strong>Escopo:</strong> ${osDescricao}
        </div>` : ''}
      </div>

      <div style="text-align: center;">
        <a href="${sistemaUrl}" class="btn" target="_blank">Acessar Ordem de Serviço no Sistema</a>
      </div>
    </div>
    <div class="footer">
      Este é um aviso automático gerado pelo ObrasFlow ERP. Por favor, não responda diretamente a este e-mail.
    </div>
  </div>
</body>
</html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "ObrasFlow <onboarding@resend.dev>",
        to: [destinatario],
        subject,
        html,
      }),
    });

    const json = (await res.json()) as { id?: string; message?: string };

    if (!res.ok) {
      console.error("[EmailService] Erro retornado pela API do Resend:", json);
      return {
        sucesso: false,
        erro: json.message || `Erro HTTP ${res.status}`,
      };
    }

    return {
      sucesso: true,
      id: json.id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EmailService] Falha ao enviar requisição para o Resend:", msg);
    return {
      sucesso: false,
      erro: msg,
    };
  }
}
