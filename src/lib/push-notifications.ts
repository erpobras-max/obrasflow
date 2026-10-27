type OneSignalWeb = {
  Notifications: {
    permission: boolean;
    permissionNative: NotificationPermission;
    isPushSupported: () => boolean;
    requestPermission: () => Promise<void>;
  };
  User: {
    PushSubscription: {
      id: string | null;
      token: string | null;
      optedIn: boolean;
      optIn: () => Promise<void>;
      addEventListener: (
        event: "change",
        listener: (event: {
          current: { id: string | null; token: string | null; optedIn: boolean };
        }) => void,
      ) => void;
      removeEventListener: (
        event: "change",
        listener: (event: {
          current: { id: string | null; token: string | null; optedIn: boolean };
        }) => void,
      ) => void;
    };
  };
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
};

function inscricaoPushAtiva(inscricao: {
  id: string | null;
  token: string | null;
  optedIn: boolean;
}): boolean {
  return inscricao.optedIn && Boolean(inscricao.id) && Boolean(inscricao.token);
}

function aguardarInscricaoPushAtiva(
  inscricao: OneSignalWeb["User"]["PushSubscription"],
): Promise<boolean> {
  if (inscricaoPushAtiva(inscricao)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finalizar = (ativa: boolean) => {
      window.clearTimeout(timeout);
      inscricao.removeEventListener("change", aoAlterar);
      resolve(ativa);
    };
    const aoAlterar = (event: {
      current: { id: string | null; token: string | null; optedIn: boolean };
    }) => {
      if (inscricaoPushAtiva(event.current)) finalizar(true);
    };
    const timeout = window.setTimeout(() => finalizar(inscricaoPushAtiva(inscricao)), 10_000);
    inscricao.addEventListener("change", aoAlterar);
  });
}

function executarComOneSignal(acao: (oneSignal: OneSignalWeb) => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = window as unknown as {
      OneSignal?: OneSignalWeb;
      OneSignalDeferred?: Array<(oneSignal: OneSignalWeb) => Promise<void>>;
    };
    let concluido = false;
    const timeout = window.setTimeout(() => {
      if (!concluido) {
        concluido = true;
        reject(new Error("O SDK do OneSignal não respondeu. Atualize a página e tente novamente."));
      }
    }, 10_000);
    const executar = async (oneSignal: OneSignalWeb) => {
      if (concluido) return;
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
  await executarComOneSignal((oneSignal) =>
    userId ? oneSignal.login(userId) : oneSignal.logout(),
  );
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
  if (!verificarSuportePush()) {
    return { sucesso: false, mensagem: "Este navegador não oferece suporte a notificações push." };
  }

  try {
    let autorizado = false;
    await executarComOneSignal(async (oneSignal) => {
      if (!oneSignal.Notifications.isPushSupported()) {
        throw new Error("Este navegador não oferece suporte ao Web Push do OneSignal.");
      }
      if (oneSignal.Notifications.permissionNative === "denied") {
        throw new Error(
          "As notificações estão bloqueadas. Libere-as nas configurações do navegador e tente novamente.",
        );
      }
      await oneSignal.Notifications.requestPermission();
      if (!oneSignal.Notifications.permission) return;

      await oneSignal.User.PushSubscription.optIn();
      autorizado = await aguardarInscricaoPushAtiva(oneSignal.User.PushSubscription);
      if (!autorizado) {
        throw new Error(
          "O OneSignal não concluiu a inscrição deste aparelho. Verifique a permissão de notificações do site e tente novamente.",
        );
      }
      if (userId) await oneSignal.login(userId);
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
  corpo = "Notificações do PWA estão funcionando perfeitamente no seu dispositivo! 🚀",
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
