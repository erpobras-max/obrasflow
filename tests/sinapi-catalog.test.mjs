import test from "node:test";
import assert from "node:assert/strict";
import {
  competenciaSort,
  sanitizeSearchTerm,
  parseMetadataFromFileName,
  UFS_BRASIL,
} from "../src/lib/sinapi.ts";

test("competenciaSort ordena competências mais recentes primeiro", () => {
  const lista = ["01/2025", "09/2026", "05/2026", "12/2024", "10/2026"];
  lista.sort(competenciaSort);
  assert.deepEqual(lista, ["10/2026", "09/2026", "05/2026", "01/2025", "12/2024"]);
});

test("sanitizeSearchTerm remove caracteres que quebram filtro PostgREST .or()", () => {
  assert.equal(sanitizeSearchTerm("cimento,portland"), "cimento portland");
  assert.equal(sanitizeSearchTerm("tijolo (8 furos)"), "tijolo  8 furos");
  assert.equal(sanitizeSearchTerm("areia%media*"), "areia media");
  assert.equal(sanitizeSearchTerm("   argamassa_ac3   "), "argamassa ac3");
  assert.equal(sanitizeSearchTerm(""), "");
});

test("parseMetadataFromFileName identifica UF, competência e tipo em arquivos do SINAPI", () => {
  // Insumos não desonerados de MG
  const insumoMG = parseMetadataFromFileName(
    "SINAPI_Preco_Ref_Insumos_Arrancadas_MG_092026_NaoDesonerado.xlsx",
  );
  assert.equal(insumoMG.detectedUF, "MG");
  assert.equal(insumoMG.detectedMes, "09/2026");
  assert.equal(insumoMG.detectedType, "insumos");

  // Composições de SP
  const compoSP = parseMetadataFromFileName(
    "SINAPI_Custo_Ref_Composicoes_Analitico_SP_2026_05_Desonerado.zip",
  );
  assert.equal(compoSP.detectedUF, "SP");
  assert.equal(compoSP.detectedMes, "05/2026");
  assert.equal(compoSP.detectedType, "composicoes");

  // Arquivo genérico
  const generico = parseMetadataFromFileName("relatorio_custos.xlsx");
  assert.equal(generico.detectedUF, "");
  assert.equal(generico.detectedMes, "");
  assert.equal(generico.detectedType, null);
});

test("UFS_BRASIL contém todas as 27 unidades federativas", () => {
  assert.equal(UFS_BRASIL.length, 27);
  assert.ok(UFS_BRASIL.includes("SP"));
  assert.ok(UFS_BRASIL.includes("MG"));
  assert.ok(UFS_BRASIL.includes("DF"));
});
