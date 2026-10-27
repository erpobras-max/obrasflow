import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { solicitarPermissaoEInscreverPush } from "../src/lib/push-notifications.ts";

test("OneSignal usa caminho absoluto para o service worker", async () => {
  const root = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  assert.match(root, /serviceWorkerPath: "\/push\/onesignal\/OneSignalSDKWorker\.js"/);
});

test("ativação de push informa quando o navegador não oferece suporte", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });

  try {
    const resultado = await solicitarPermissaoEInscreverPush("usuario-1");
    assert.equal(resultado.sucesso, false);
    assert.match(resultado.mensagem, /não oferece suporte/);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
});
