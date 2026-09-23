import test from 'node:test';
import assert from 'node:assert/strict';
import { createClockSkewFetch } from '../src/integrations/supabase/retry-clock-skew.ts';

const future = () => new Response(JSON.stringify({ code: 'PGRST303', message: 'JWT issued at future' }), { status: 401 });
test('repete leitura transitoriamente rejeitada pelo relógio, sem renovar token', async () => {
  let calls = 0;
  const waits = [];
  const request = createClockSkewFetch(async () => ++calls === 1 ? future() : new Response('ok'), async ms => waits.push(ms));
  assert.equal(await (await request('https://example.test')).text(), 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [400]);
});
test('não repete operações de escrita nem outros erros de autenticação', async () => {
  for (const [method, response] of [['POST', future()], ['GET', new Response('{"code":"PGRST303","message":"JWT expired"}', { status: 401 })]]) {
    let calls = 0;
    const request = createClockSkewFetch(async () => { calls++; return response; }, async () => assert.fail('Não deveria aguardar'));
    assert.equal((await request('https://example.test', { method })).status, 401);
    assert.equal(calls, 1);
  }
});
test('encerra as tentativas sem esconder a recusa do servidor', async () => {
  let calls = 0;
  const request = createClockSkewFetch(async () => { calls++; return future(); }, async () => {});
  assert.equal((await request('https://example.test')).status, 401);
  assert.equal(calls, 4);
});
