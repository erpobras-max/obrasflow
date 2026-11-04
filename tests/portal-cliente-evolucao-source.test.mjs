import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("portal oferece proposta comercial através da RPC sanitizada", async () => {
  const source = await read("src/routes/portal/proposta.tsx");
  assert.match(source, /consultar_proposta_portal/);
  assert.match(source, /Proposta comercial/i);
  assert.doesNotMatch(source, /custoUnitario|insumos|bdi/i);
});

test("portal permite responder decisões apenas pela RPC protegida", async () => {
  const source = await read("src/routes/portal/decisoes.tsx");
  assert.match(source, /portal_solicitacoes/);
  assert.match(source, /responder_solicitacao_portal/);
  assert.match(source, /Nenhuma decisão pendente/i);
});

test("navegação do portal inclui proposta e decisões", async () => {
  const source = await read("src/routes/portal.tsx");
  assert.match(source, /Proposta/);
  assert.match(source, /Decisões/);
  assert.match(source, /to: "\/portal\/proposta"/);
  assert.match(source, /to: "\/portal\/decisoes"/);
});

test("cronograma do portal apresenta marcos em uma linha do tempo", async () => {
  const source = await read("src/components/cronograma-proprietario.tsx");
  assert.match(source, /Próximos marcos/i);
  assert.match(source, /linha do tempo/i);
  assert.match(source, /data_inicio/);
  assert.match(source, /data_fim/);
});

test("financeiro só mostra pagamento quando existe link cadastrado", async () => {
  const source = await read("src/routes/portal/financeiro.tsx");
  assert.match(source, /link_pagamento/);
  assert.match(source, /Pagar agora/i);
  assert.match(source, /window\.open\(l\.link_pagamento/);
});
