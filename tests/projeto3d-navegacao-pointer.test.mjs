import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const arquivo = new URL("../src/components/projeto3d/CanvasPlanta2D.tsx", import.meta.url);

test("arraste da vista usa captura de ponteiro e inicia no modo mão", async () => {
  const fonte = await readFile(arquivo, "utf8");

  assert.match(fonte, /useState<FerramentaAtiva>\("mao"\)/);
  assert.match(fonte, /setPointerCapture\(e\.pointerId\)/);
  assert.match(fonte, /releasePointerCapture\(e\.pointerId\)/);
  assert.match(fonte, /onPointerCancel=\{handlePointerUp\}/);
  assert.doesNotMatch(fonte, /onMouseLeave=\{handleMouseUp\}/);
});

