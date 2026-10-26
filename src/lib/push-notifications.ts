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
 * Solicita permissão ao usuário e grava a inscrição de Push no banco do Supabase
 */
export async function solicitarPermissaoEInscreverPush(userId?: string): Promise<{
  sucesso: boolean;
  mensagem: string;
}> {
  if (!verificarSuportePush()) {
    return {
      sucesso: false,
      mensagem: "Este navegador ou aparelho não possui suporte a notificações Push.",
    };
  }

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      return {
        sucesso: false,
        mensagem: "Permissão de notificação não foi concedida pelo usuário.",
      };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Se ainda não estiver inscrito, tenta inscrever
    if (!subscription) {
      // Chave pública VAPID padrão de demonstração / fallback
      const vapidPublicKey =
        import.meta.env.VITE_VAPID_PUBLIC_KEY ||
        "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkRXZJjSgSnfckjBJuBkr3qBUYIHBQFLXY5ceE1L-U";

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return {
        sucesso: true,
        mensagem: "Notificações ativadas no navegador! (Inscrição local pronta)",
      };
    }

    // Salvar no Supabase
    if (userId) {
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) {
        console.warn("Aviso ao salvar inscrição no Supabase:", error.message);
      }
    }

    return {
      sucesso: true,
      mensagem: "Notificações Push ativadas com sucesso neste aparelho! 🔔",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Erro ao configurar push:", msg);
    return {
      sucesso: false,
      mensagem: `Falha ao ativar notificações: ${msg}`,
    };
  }
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
