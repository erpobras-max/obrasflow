import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  inicializarOneSignal,
  solicitarPermissaoEInscreverPush,
} from "../src/lib/push-notifications.ts";

test("OneSignal e PWA usam o mesmo service worker na raiz", async () => {
  const root = await readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8");
  const push = await readFile(new URL("../src/lib/push-notifications.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../src/server.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/OneSignalSDKWorker.js", import.meta.url), "utf8");
  const pwa = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(push, /serviceWorkerPath: "\/OneSignalSDKWorker\.js"/);
  assert.match(push, /serviceWorkerParam: \{ scope: "\/" \}/);
  assert.match(root, /register\("\/OneSignalSDKWorker\.js"\)/);
  assert.match(server, /path === "\/OneSignalSDKWorker\.js"/);
  assert.match(worker, /importScripts\('\/sw\.js'\)/);
  assert.match(pwa, /https:\/\/cdn\.onesignal\.com\/sdks\/web\/v16\/OneSignalSDK\.sw\.js/);
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

test("carregamento e ações compartilham uma única inicialização do SDK", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
  const scripts = [];
  const win = { setTimeout, clearTimeout, OneSignalDeferred: [] };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      querySelector: () => null,
      createElement: () => ({}),
      head: { appendChild: (script) => scripts.push(script) },
    },
  });

  try {
    const primeira = inicializarOneSignal();
    const segunda = inicializarOneSignal();
    let inicializacoes = 0;
    const oneSignal = { init: async () => { inicializacoes += 1; } };
    await win.OneSignalDeferred[0](oneSignal);

    assert.equal(await primeira, oneSignal);
    assert.equal(await segunda, oneSignal);
    assert.equal(win.OneSignalDeferred.length, 1);
    assert.equal(scripts.length, 1);
    assert.equal(inicializacoes, 1);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor);
    else delete globalThis.document;
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
    init: async () => {},
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
