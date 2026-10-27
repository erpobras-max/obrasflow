import { supabase } from "@/integrations/supabase/client";
import type { DadosResumoExecutivo } from "./resumo-diario.types";

/**
 * Busca os dados consolidados do resumo diário para visualização no Dashboard
 */
export async function obterResumoDiarioCliente(): Promise<DadosResumoExecutivo | null> {
  const { data, error } = await (supabase as any).rpc("obter_resumo_executivo_diario");

  if (error) {
    console.warn("[ResumoDiario] Erro ao carregar resumo via RPC:", error.message);
    return null;
  }

  return data as DadosResumoExecutivo;
}

/**
 * Dispara o envio manual do resumo matinal por e-mail chamando a API do servidor
 */
export async function dispararResumoMatinalManual(emailTeste?: string): Promise<{
  sucesso: boolean;
  emailsEnviados?: number;
  mensagem?: string;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { sucesso: false, mensagem: "Sessão expirada. Entre novamente no sistema." };
    }
    const url = emailTeste
      ? `/api/cron-resumo-diario?email_teste=${encodeURIComponent(emailTeste)}`
      : `/api/cron-resumo-diario`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    const data = await res.json();

    if (!res.ok || !data.sucesso) {
      return {
        sucesso: false,
        mensagem: data.erro || "Falha ao disparar e-mail de resumo matinal.",
      };
    }

    return {
      sucesso: true,
      emailsEnviados: data.emailsEnviados,
      mensagem: `${data.emailsEnviados || 0} e-mail(s) de resumo disparado(s) com sucesso!`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      sucesso: false,
      mensagem: msg,
    };
  }
}
