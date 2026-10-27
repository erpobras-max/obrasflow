type OneSignalWeb = {
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
  };
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
};

function executarComOneSignal(acao: (oneSignal: OneSignalWeb) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      OneSignal?: OneSignalWeb;
      OneSignalDeferred?: Array<(oneSignal: OneSignalWeb) => Promise<void>>;
    };
    let concluido = false;
    const timeout = window.setTimeout(() => {
      if (!concluido) reject(new Error("O SDK do OneSignal não carregou."));
    }, 10_000);
    const executar = async (oneSignal: OneSignalWeb) => {
      try {
        await acao(oneSignal);
        concluido = true;
        window.clearTimeout(timeout);
        resolve();
      } catch (error) {
        concluido = true;
        window.clearTimeout(timeout);
        reject(error);
      }
    };

    if (win.OneSignal) void executar(win.OneSignal);
    else {
      win.OneSignalDeferred = win.OneSignalDeferred || [];
      win.OneSignalDeferred.push(executar);
    }
  });
}

export async function identificarUsuarioOneSignal(userId: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  await executarComOneSignal(oneSignal => userId ? oneSignal.login(userId) : oneSignal.logout());
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

  try {
    let autorizado = false;
    await executarComOneSignal(async oneSignal => {
      if (userId) await oneSignal.login(userId);
      await oneSignal.Notifications.requestPermission();
      autorizado = oneSignal.Notifications.permission;
    });
    if (autorizado) {
      return {
        sucesso: true,
        mensagem: "Notificações Push do OneSignal ativadas com sucesso neste aparelho! 🔔",
      };
    }
    return { sucesso: false, mensagem: "Permissão de notificação não foi concedida pelo usuário." };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OneSignal] Erro ao ativar:", msg);
    return { sucesso: false, mensagem: `Falha ao ativar notificações: ${msg}` };
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
