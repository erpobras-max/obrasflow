import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { versionarPwa } from "../scripts/versionar-pwa.mjs";
import { iniciarAtualizacaoPwa } from "../src/lib/pwa-update.ts";

test("worker mantém versão estável no mesmo build e muda quando frontend muda", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "obrasflow-pwa-"));
  try {
    await mkdir(join(pasta, "assets"));
    await writeFile(join(pasta, "assets", "index-abc.js"), "// build A");
    const worker = join(pasta, "OneSignalSDKWorker.js");
    await writeFile(worker, "importScripts('/sw.js');\n");
    const primeira = await versionarPwa(pasta);
    assert.equal(await versionarPwa(pasta), primeira);
    assert.equal((await readFile(worker, "utf8")).match(/ObrasFlow build:/g).length, 1);
    await writeFile(join(pasta, "assets", "index-def.js"), "// build B");
    assert.notEqual(await versionarPwa(pasta), primeira);
    assert.match(await readFile(worker, "utf8"), /importScripts\('\/sw.js'\)/);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test("PWA verifica ao abrir e retomar, preserva worker OneSignal e protege edição", async () => {
  const descriptors = new Map(
    ["window", "navigator", "document"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  let editando = false;
  let recargas = 0;
  let verificacoes = 0;
  let aviso;
  const script = "https://example.com/OneSignalSDKWorker.js?appId=teste&sdkVersion=16";
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: null,
    getRegistration: async () => ({ active: { scriptURL: script } }),
    register: async (caminho, options) => {
      assert.equal(caminho, script);
      assert.equal(options.updateViaCache, "none");
      return {
        update: async () => {
          verificacoes += 1;
        },
      };
    },
  });
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    querySelector: () => (editando ? {} : null),
  });
  const win = Object.assign(new EventTarget(), {
    location: {
      pathname: "/ordens-servico",
      reload: () => {
        recargas += 1;
      },
    },
    setTimeout: () => 1,
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  let limpar;
  try {
    limpar = iniciarAtualizacaoPwa((atualizar) => {
      aviso = atualizar;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(verificacoes, 1);
    serviceWorker.dispatchEvent(new Event("controllerchange"));
    assert.equal(recargas, 0, "primeira instalação não recarrega");
    doc.visibilityState = "hidden";
    serviceWorker.dispatchEvent(new Event("controllerchange"));
    assert.equal(recargas, 0, "atualização aguarda retornar ao app");
    editando = true;
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(typeof aviso, "function");
    assert.equal(recargas, 0, "formulário aberto não perde edição");
    editando = false;
    win.dispatchEvent(new Event("focus"));
    assert.equal(recargas, 1);
    win.dispatchEvent(new Event("focus"));
    assert.equal(recargas, 1, "não repete recarga no mesmo evento de atualização");
    limpar();
    const anteriores = verificacoes;
    win.dispatchEvent(new Event("focus"));
    assert.equal(verificacoes, anteriores, "cleanup remove listeners");
  } finally {
    limpar?.();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
