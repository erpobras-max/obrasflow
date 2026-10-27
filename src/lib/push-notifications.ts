import { supabase } from "@/integrations/supabase/client.custom";

/**
 * Converte base64 para Uint8Array para uso com applicationServerKey VAPID
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica se o navegador atual suporta Service Worker e Push Notifications
 */
export function verificarSuportePush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window;
}

/**
 * Retorna o status atual da permissão de notificações do navegador
 */
export function obterStatusPermissao(): NotificationPermission | "unsupported" {
  if (!verificarSuportePush()) return "unsupported";
  return Notification.permission;
}

/**
 * Solicita permissão ao usuário e grava a inscrição de Push no OneSignal
 */
export async function solicitarPermissaoEInscreverPush(userId?: string): Promise<{
  sucesso: boolean;
  mensagem: string;
}> {
  if (typeof window === "undefined") {
    return { sucesso: false, mensagem: "Ambiente não suportado." };
  }

  const win = window as any;
  if (win.OneSignal) {
    try {
      await win.OneSignal.Notifications.requestPermission();
      if (userId) {
        await win.OneSignal.login(userId);
      }
      return {
        sucesso: true,
        mensagem: "Notificações Push do OneSignal ativadas com sucesso neste aparelho! 🔔",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[OneSignal] Erro ao ativar:", msg);
      return {
        sucesso: false,
        mensagem: `Falha ao ativar notificações: ${msg}`,
      };
    }
  }

  // Se OneSignalDeferred ainda não concluiu ou fallback nativo:
  if ("Notification" in window) {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        return {
          sucesso: true,
          mensagem: "Permissão concedida no navegador!",
        };
      }
      return {
        sucesso: false,
        mensagem: "Permissão de notificação não foi concedida pelo usuário.",
      };
    } catch (e: unknown) {
      return {
        sucesso: false,
        mensagem: "Não foi possível solicitar permissão no navegador.",
      };
    }
  }

  return {
    sucesso: false,
    mensagem: "Este navegador ou aparelho não possui suporte a notificações Push.",
  };
}

/**
 * Dispara uma notificação nativa imediata no aparelho para teste visual e sonoro
 */
export async function dispararNotificacaoLocalTeste(
  titulo = "ObrasFlow — Alerta de Teste",
  corpo = "Notificações do PWA estão funcionando perfeitamente no seu dispositivo! 🚀"
): Promise<boolean> {
  if (!verificarSuportePush()) return false;

  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(titulo, {
      body: corpo,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      vibrate: [200, 100, 200],
      data: { url: "/ordens-servico" },
    });
    return true;
  } catch {
    // Fallback para Notification API direta
    try {
      new Notification(titulo, {
        body: corpo,
        icon: "/icon-192x192.png",
      });
      return true;
    } catch {
      return false;
    }
  }
}
