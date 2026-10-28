import process from "node:process";

export const ONESIGNAL_APP_ID = "ad9a6dc0-2948-4aad-80ee-7dd30e073d0d";

export type ResultadoOneSignal = {
  sucesso: boolean;
  id?: string;
  erro?: string;
};

function getConfig() {
  const runtimeEnv = (globalThis as unknown as { __env__?: Record<string, string> }).__env__;
  return {
    appId: (runtimeEnv?.ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || ONESIGNAL_APP_ID).trim(),
    apiKey: (runtimeEnv?.ONESIGNAL_REST_KEY || process.env.ONESIGNAL_REST_KEY)?.trim(),
  };
}

export function normalizarTelefoneE164(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `+55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return `+${digitos}`;
  return null;
}

async function enviarMensagem(canal: "push" | "email" | "sms", payload: Record<string, unknown>): Promise<ResultadoOneSignal> {
  const { appId, apiKey } = getConfig();
  if (!apiKey) return { sucesso: false, erro: "ONESIGNAL_REST_KEY não configurada no servidor." };

  try {
    const response = await fetch(`https://api.onesignal.com/notifications?c=${canal}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app_id: appId, ...payload }),
    });
    const data = await response.json() as { id?: string; errors?: unknown };
    if (!response.ok || !data.id || data.errors) {
      return { sucesso: false, erro: `OneSignal HTTP ${response.status}: ${JSON.stringify(data.errors || data)}` };
    }
    return { sucesso: true, id: data.id };
  } catch (error) {
    return { sucesso: false, erro: error instanceof Error ? error.message : String(error) };
  }
}

export function enviarPushOneSignal(externalId: string, titulo: string, mensagem: string, url: string): Promise<ResultadoOneSignal> {
  return enviarMensagem("push", {
    target_channel: "push",
    include_aliases: { external_id: [externalId] },
    headings: { en: titulo, pt: titulo },
    contents: { en: mensagem, pt: mensagem },
    web_url: url,
  });
}

export async function enviarTestePushOneSignal(externalId: string, subscriptionId: string, url: string): Promise<ResultadoOneSignal> {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(subscriptionId)) {
    return { sucesso: false, erro: "Inscrição deste aparelho inválida ou ausente. Ative o Push antes de testar." };
  }
  const { appId, apiKey } = getConfig();
  if (!apiKey) return { sucesso: false, erro: "ONESIGNAL_REST_KEY não configurada no servidor." };
  try {
    const response = await fetch(`https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(externalId)}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!response.ok) return { sucesso: false, erro: `Não foi possível consultar a inscrição no OneSignal (HTTP ${response.status}).` };
    const data = await response.json() as { subscriptions?: Array<{ id: string; enabled: boolean; token?: string; type: string }> };
    const inscricao = data.subscriptions?.find(item => item.id === subscriptionId);
    if (!inscricao || !inscricao.enabled || !inscricao.token || !inscricao.type.endsWith("Push")) {
      return { sucesso: false, erro: "Este aparelho não está inscrito e ativo no OneSignal para seu usuário. Ative o Push novamente neste aparelho." };
    }
    return enviarMensagem("push", {
      target_channel: "push",
      include_subscription_ids: [subscriptionId],
      headings: { en: "ObrasFlow — Teste neste aparelho", pt: "ObrasFlow — Teste neste aparelho" },
      contents: { en: "Teste de recebimento neste aparelho do ObrasFlow.", pt: "Teste de recebimento neste aparelho do ObrasFlow." },
      web_url: url,
    });
  } catch (error) {
    return { sucesso: false, erro: error instanceof Error ? error.message : String(error) };
  }
}

export function enviarEmailOneSignal(destinatario: string, assunto: string, html: string): Promise<ResultadoOneSignal> {
  return enviarMensagem("email", {
    target_channel: "email",
    email_to: [destinatario],
    email_subject: assunto,
    email_body: html,
  });
}

export function enviarSmsOneSignal(telefone: string, mensagem: string): Promise<ResultadoOneSignal> {
  const numero = normalizarTelefoneE164(telefone);
  if (!numero) return Promise.resolve({ sucesso: false, erro: "Telefone inválido para SMS; informe DDD e número." });
  return enviarMensagem("sms", {
    target_channel: "sms",
    include_phone_numbers: [numero],
    contents: { en: mensagem },
  });
}
