import test from "node:test";
import assert from "node:assert/strict";
import {
  enviarEmailOneSignal,
  enviarPushOneSignal,
  enviarSmsOneSignal,
  normalizarTelefoneE164,
} from "../src/lib/onesignal.server.ts";

test("normalizarTelefoneE164 aceita celular brasileiro e rejeita número incompleto", () => {
  assert.equal(normalizarTelefoneE164("(11) 98765-4321"), "+5511987654321");
  assert.equal(normalizarTelefoneE164("+55 11 98765-4321"), "+5511987654321");
  assert.equal(normalizarTelefoneE164("12345"), null);
});

test("OneSignal envia cada canal com destinatário individual", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = globalThis.__env__;
  const requests = [];
  globalThis.__env__ = { ONESIGNAL_REST_KEY: "chave-de-teste" };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ id: `msg-${requests.length}` }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    assert.equal((await enviarPushOneSignal("user-1", "Prazo", "Mensagem", "https://example.com/os")).sucesso, true);
    assert.equal((await enviarEmailOneSignal("gestor@example.com", "Prazo", "<p>Mensagem</p>")).sucesso, true);
    assert.equal((await enviarSmsOneSignal("(11) 98765-4321", "Mensagem")).sucesso, true);

    assert.deepEqual(requests[0].body.include_aliases, { external_id: ["user-1"] });
    assert.deepEqual(requests[1].body.email_to, ["gestor@example.com"]);
    assert.deepEqual(requests[2].body.include_phone_numbers, ["+5511987654321"]);
    assert.ok(requests.every(request => !request.body.included_segments));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.__env__ = originalEnv;
  }
});

test("OneSignal não informa sucesso quando a API rejeita o único destinatário", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = globalThis.__env__;
  globalThis.__env__ = { ONESIGNAL_REST_KEY: "chave-de-teste" };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ id: "msg-1", errors: { invalid_external_user_ids: ["user-1"] } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    const resultado = await enviarPushOneSignal(
      "user-1",
      "Prazo",
      "Mensagem",
      "https://example.com/os",
    );
    assert.equal(resultado.sucesso, false);
    assert.match(resultado.erro, /invalid_external_user_ids/);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.__env__ = originalEnv;
  }
});
