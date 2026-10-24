import test from "node:test";
import assert from "node:assert/strict";
import {
  DIARIO_IMAGE_MAX_MB,
  DIARIO_VIDEO_MAX_MB,
  getDiarioMediaError,
} from "../src/lib/diario-media.ts";

const MB = 1024 * 1024;

test("aceita imagens de até 20 MB", () => {
  assert.equal(getDiarioMediaError({ type: "image/jpeg", size: DIARIO_IMAGE_MAX_MB * MB }), null);
  assert.match(
    getDiarioMediaError({ type: "image/jpeg", size: DIARIO_IMAGE_MAX_MB * MB + 1 }) ?? "",
    /20 MB/,
  );
});

test("aceita vídeos de até 150 MB", () => {
  assert.equal(getDiarioMediaError({ type: "video/mp4", size: DIARIO_VIDEO_MAX_MB * MB }), null);
  assert.match(
    getDiarioMediaError({ type: "video/mp4", size: DIARIO_VIDEO_MAX_MB * MB + 1 }) ?? "",
    /150 MB/,
  );
});

test("rejeita formatos que o diário não exibe", () => {
  assert.match(getDiarioMediaError({ type: "application/pdf", size: MB }) ?? "", /JPG/);
});
