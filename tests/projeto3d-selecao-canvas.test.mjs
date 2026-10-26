import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const arquivo = new URL("../src/components/projeto3d/CanvasPlanta2D.tsx", import.meta.url);

test("canvas integra seleção CAD por janela e operações numéricas", async () => {
  const fonte = await readFile(arquivo, "utf8");

  assert.match(fonte, /selecionarElementosNaJanela\(/);
  assert.match(fonte, /fim\.x >= inicioJanelaSelecao\.x \? "conter" : "cruzar"/);
  assert.match(fonte, /e\.shiftKey && ferramenta !== "selecionar"/);
  assert.match(fonte, /transformarSelecao\(/);
  assert.match(fonte, /duplicarSelecao\(/);
  assert.match(fonte, /alinharSelecao\(/);
  assert.match(fonte, /Alinhamento horizontal/);
  assert.match(fonte, /Apagar seleção/);
});

test("canvas integra criação, associação, visibilidade e bloqueio de layers", async () => {
  const fonte = await readFile(arquivo, "utf8");

  assert.match(fonte, /Layers CAD/);
  assert.match(fonte, /Aplicar à seleção/);
  assert.match(fonte, /criarCamadaCad\(/);
  assert.match(fonte, /atualizarCamadaCad\(/);
  assert.match(fonte, /filtrarSelecaoEditavel\(/);
});
