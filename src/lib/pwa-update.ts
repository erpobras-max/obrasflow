export function iniciarAtualizacaoPwa(avisar: (atualizar: () => void) => void): () => void {
  if (!("serviceWorker" in navigator)) return () => {};

  let encerrado = false;
  let tinhaControle = Boolean(navigator.serviceWorker.controller);
  let versaoPendente = false;
  let recarregando = false;
  let registro: ServiceWorkerRegistration | undefined;
  const recarregar = () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
    window.setTimeout(() => {
      recarregando = false;
    }, 1000);
  };
  const aplicar = () => {
    if (!versaoPendente || document.visibilityState !== "visible") return;
    // Formulários e o editor CAD precisam dar ao usuário a oportunidade de salvar.
    if (
      document.querySelector("form, [role='dialog'], [contenteditable='true']") ||
      window.location.pathname.startsWith("/projeto3d/")
    ) {
      avisar(recarregar);
    } else {
      recarregar();
    }
  };
  const aoMudarControle = () => {
    if (tinhaControle) {
      versaoPendente = true;
      aplicar();
    }
    tinhaControle = true;
  };
  const verificar = () => {
    if (document.visibilityState !== "visible") return;
    aplicar();
    void registro
      ?.update()
      .catch((error) => console.warn("[PWA] Falha ao verificar atualização:", error));
  };

  navigator.serviceWorker.addEventListener("controllerchange", aoMudarControle);
  document.addEventListener("visibilitychange", verificar);
  window.addEventListener("online", verificar);
  window.addEventListener("focus", verificar);

  void (async () => {
    const existente = await navigator.serviceWorker.getRegistration("/");
    if (encerrado) return;
    const script = existente?.active?.scriptURL;
    // Preserva os parâmetros appId/sdkVersion adicionados pelo OneSignal.
    const caminho =
      script && new URL(script).pathname === "/OneSignalSDKWorker.js"
        ? script
        : "/OneSignalSDKWorker.js";
    registro = await navigator.serviceWorker.register(caminho, {
      scope: "/",
      updateViaCache: "none",
    });
    if (!encerrado) verificar();
  })().catch((error) => console.error("[PWA] Falha no registro:", error));

  return () => {
    encerrado = true;
    navigator.serviceWorker.removeEventListener("controllerchange", aoMudarControle);
    document.removeEventListener("visibilitychange", verificar);
    window.removeEventListener("online", verificar);
    window.removeEventListener("focus", verificar);
  };
}
