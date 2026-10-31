import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getActiveNavigationGroupId,
  getEnvironmentForHref,
  getNavigationGroups,
  isNavigationItemActive,
} from "../src/lib/navigation-menu.ts";

test("ambiente civil organiza os módulos por fluxo sem misturar a imobiliária", () => {
  const groups = getNavigationGroups("civil");
  const ids = groups.map((group) => group.id);
  const destinations = groups.flatMap((group) => group.items.map((item) => item.to));

  assert.deepEqual(ids, [
    "visao-geral",
    "comercial",
    "planejamento-obras",
    "empreiteiros",
    "suprimentos",
    "financeiro",
    "gestao",
  ]);
  assert.ok(destinations.includes("/contratos-empreiteiros"));
  assert.ok(destinations.includes("/prestadores"));
  assert.ok(destinations.includes("/relatorios"));
  assert.equal(
    destinations.some((to) => to.startsWith("/imobiliaria")),
    false,
  );
});

test("ambiente imobiliário mostra somente as rotas próprias do negócio", () => {
  const groups = getNavigationGroups("imobiliaria");
  const destinations = groups.flatMap((group) => group.items.map((item) => item.to));

  assert.ok(destinations.length > 0);
  assert.equal(
    destinations.every((to) => to.startsWith("/imobiliaria")),
    true,
  );
  assert.ok(destinations.includes("/imobiliaria/dashboard"));
  assert.ok(destinations.includes("/imobiliaria/financeiro"));
});

test("ambiente é derivado da rota atual e mantém o painel geral no civil", () => {
  assert.equal(getEnvironmentForHref("/imobiliaria/imoveis"), "imobiliaria");
  assert.equal(getEnvironmentForHref("/dashboard"), "civil");
  assert.equal(getEnvironmentForHref("/orcamentos?obra=123"), "civil");
});

test("rota ativa considera query string sem confundir central e pedidos de compra", () => {
  assert.equal(isNavigationItemActive("/compras", "/compras"), true);
  assert.equal(isNavigationItemActive("/compras?tab=pedidos", "/compras"), false);
  assert.equal(isNavigationItemActive("/compras?tab=pedidos", "/compras?tab=pedidos"), true);
  assert.equal(isNavigationItemActive("/compras", "/compras?tab=pedidos"), false);
  assert.equal(isNavigationItemActive("/comercial/clientes", "/comercial/clientes/novo"), true);
  assert.equal(isNavigationItemActive("/orcamentos", "/orcamentos?obra=123"), true);
});

test("grupo da rota atual é identificado para abertura automática", () => {
  assert.equal(getActiveNavigationGroupId("civil", "/medicoes"), "planejamento-obras");
  assert.equal(getActiveNavigationGroupId("civil", "/contratos-empreiteiros"), "empreiteiros");
  assert.equal(
    getActiveNavigationGroupId("imobiliaria", "/imobiliaria/locacoes"),
    "operacao-imobiliaria",
  );
});

test("sidebar integra seletor de ambiente, busca e grupos recolhíveis persistentes", async () => {
  const source = await readFile(
    new URL("../src/components/layout/app-sidebar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getNavigationGroups/);
  assert.match(source, /getEnvironmentForHref/);
  assert.match(source, /Collapsible/);
  assert.match(source, /obrasflow:sidebar-open-groups:v1/);
  assert.match(source, /Buscar módulo/);
  assert.match(source, /Construção Civil/);
  assert.match(source, /Imobiliária/);
  assert.match(source, /disabled=\{!canSwitchEnvironment\}/);
  assert.doesNotMatch(source, /openGroups\[group\.id\].*group\.id === activeGroupId/s);
  assert.doesNotMatch(source, /const NAVIGATION_GROUPS/);
});
