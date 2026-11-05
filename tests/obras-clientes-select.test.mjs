import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("formulário de obra atualiza e informa o estado da lista de clientes", async () => {
  const source = await readFile(new URL("../src/routes/_app/obras.tsx", import.meta.url), "utf8");
  assert.match(source, /queryKey: \["obras-clientes-opt"\]/);
  assert.match(source, /refetchOnMount: "always"/);
  assert.match(source, /clientesError/);
  assert.match(source, /Nenhum cliente ativo encontrado/);
  assert.match(source, /onOpenChange=\{\(o\) => \{[\s\S]*refetchClientes/);
});
