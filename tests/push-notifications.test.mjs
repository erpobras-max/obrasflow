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

test("ativação só informa sucesso após obter opt-in, id e token do OneSignal", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const inscricao = {
    id: null,
    token: null,
    optedIn: false,
    optIn: async () => {
      inscricao.id = "subscription-1";
      inscricao.token = "push-token-1";
      inscricao.optedIn = true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const oneSignal = {
    Notifications: {
      permission: true,
      permissionNative: "granted",
      isPushSupported: () => true,
      requestPermission: async () => {},
    },
    User: { PushSubscription: inscricao },
    login: async () => {},
    logout: async () => {},
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Notification: {}, OneSignal: oneSignal, setTimeout, clearTimeout },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serviceWorker: {} },
  });

  try {
    const resultado = await solicitarPermissaoEInscreverPush("usuario-1");
    assert.equal(resultado.sucesso, true);
    assert.equal(inscricao.optedIn, true);
    assert.ok(inscricao.id);
    assert.ok(inscricao.token);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
});
