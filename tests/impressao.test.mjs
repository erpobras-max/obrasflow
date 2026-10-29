import test from "node:test";
import assert from "node:assert/strict";
import { montarDocumentoImpressao } from "../src/lib/impressao.ts";

test("mantém a folha visível quando o CSS global oculta o conteúdo na impressão", () => {
  const cssGlobal = "<style>@media print { body * { visibility: hidden !important; } }</style>";
  const html = montarDocumentoImpressao(
    '<article class="print-sheet">Proposta comercial</article>',
    "Proposta PROP-1",
    "portrait",
    cssGlobal,
  );

  assert.match(html, /Proposta comercial/);
  assert.ok(
    html.lastIndexOf("visibility: visible !important") >
      html.indexOf("visibility: hidden !important"),
    "a correção de visibilidade deve prevalecer sobre o CSS global",
  );
});

