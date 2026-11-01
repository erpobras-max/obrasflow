import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  criarEmpreiteiroPayload,
  empreiteiroSchema,
  filtrarEmpreiteiros,
} from "../src/lib/empreiteiros.ts";

const baseForm = {
  razao_social: "  Construtora Horizonte Ltda  ",
  nome_fantasia: "  Horizonte  ",
  tipo: "pj",
  cnpj: "12.345.678/0001-90",
  cpf: "",
  especialidade: "  Alvenaria  ",
  telefone: "  (31) 99999-0000  ",
  email: "  contato@horizonte.com.br  ",
  avaliacao: 4,
  ativo: true,
};

test("payload PJ fixa classificação, normaliza campos e descarta CPF", () => {
  assert.deepEqual(criarEmpreiteiroPayload(baseForm), {
    razao_social: "Construtora Horizonte Ltda",
    nome_fantasia: "Horizonte",
    tipo: "pj",
    cnpj: "12.345.678/0001-90",
    cpf: null,
    classificacao: "terceirizado",
    especialidade: "Alvenaria",
    telefone: "(31) 99999-0000",
    email: "contato@horizonte.com.br",
    avaliacao: 4,
    ativo: true,
  });
});

test("payload PF mantém CPF, descarta CNPJ e converte opcionais vazios em null", () => {
  assert.deepEqual(
    criarEmpreiteiroPayload({
      ...baseForm,
      tipo: "pf",
      cpf: "123.456.789-00",
      cnpj: "12.345.678/0001-90",
      nome_fantasia: " ",
      especialidade: "",
      telefone: "",
      email: "",
      avaliacao: null,
      ativo: false,
    }),
    {
      razao_social: "Construtora Horizonte Ltda",
      nome_fantasia: null,
      tipo: "pf",
      cnpj: null,
      cpf: "123.456.789-00",
      classificacao: "terceirizado",
      especialidade: null,
      telefone: null,
      email: null,
      avaliacao: null,
      ativo: false,
    },
  );
});

test("avaliação aceita somente inteiros de 1 a 5 ou ausência", () => {
  assert.equal(empreiteiroSchema.safeParse(baseForm).success, true);
  assert.equal(empreiteiroSchema.safeParse({ ...baseForm, avaliacao: null }).success, true);
  assert.equal(empreiteiroSchema.safeParse({ ...baseForm, avaliacao: 0 }).success, false);
  assert.equal(empreiteiroSchema.safeParse({ ...baseForm, avaliacao: 4.5 }).success, false);
  assert.equal(empreiteiroSchema.safeParse({ ...baseForm, avaliacao: 6 }).success, false);
});

const empreiteiros = [
  {
    id: "1",
    razao_social: "José Construções",
    nome_fantasia: "JC Obras",
    tipo: "pj",
    cnpj: "12.345.678/0001-90",
    cpf: null,
    classificacao: "terceirizado",
    especialidade: "Instalações Elétricas",
    telefone: null,
    email: null,
    avaliacao: 5,
    ativo: true,
  },
  {
    id: "2",
    razao_social: "Maria Reformas",
    nome_fantasia: null,
    tipo: "pf",
    cnpj: null,
    cpf: "987.654.321-00",
    classificacao: "terceirizado",
    especialidade: "Pintura",
    telefone: null,
    email: null,
    avaliacao: null,
    ativo: false,
  },
];

test("busca ignora acentos e caixa em nome, fantasia e especialidade", () => {
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "eletricas", "todos"), [empreiteiros[0]]);
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "jose", "todos"), [empreiteiros[0]]);
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "jc obras", "todos"), [empreiteiros[0]]);
});

test("busca aceita documento sem máscara e combina filtro de situação", () => {
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "12345678000190", "ativos"), [
    empreiteiros[0],
  ]);
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "98765432100", "inativos"), [empreiteiros[1]]);
  assert.deepEqual(filtrarEmpreiteiros(empreiteiros, "", "ativos"), [empreiteiros[0]]);
});

test("rota de prestadores exibe somente o cadastro dedicado de empreiteiros", async () => {
  const route = await readFile(
    new URL("../src/routes/_app/prestadores.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /EmpreiteirosCadastroPanel/);
  assert.doesNotMatch(route, /PrestadoresServicosPanel/);
  assert.doesNotMatch(route, /obras-prestadores/);
});

test("contratos listam apenas terceirizados e cadastro invalida o cache integrado", async () => {
  const contractEditor = await readFile(
    new URL("../src/components/contratos-empreiteiros/contrato-editor-dialog.tsx", import.meta.url),
    "utf8",
  );
  const panel = await readFile(
    new URL("../src/components/prestadores/empreiteiros-cadastro-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(contractEditor, /\.eq\("classificacao", "terceirizado"\)/);
  assert.match(panel, /queryKey: \["fornecedores-terceirizados-contratos"\]/);
  assert.match(panel, /Avaliação \(1 a 5\)/);
  assert.doesNotMatch(panel, /Avaliação \(0 a 5\)/);
});

test("migration limita empreiteiros e preserva permissões de fornecedores comuns", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20261101000000_restringir_escrita_fornecedores.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /DROP POLICY IF EXISTS "forn_write"/);
  assert.match(migration, /has_role\(auth\.uid\(\), 'compras'/);
  assert.match(migration, /classificacao = 'terceirizado'/);
  assert.match(migration, /classificacao <> 'terceirizado'/);
  assert.match(migration, /has_role\(auth\.uid\(\), 'diretor'/);
  assert.match(migration, /has_role\(auth\.uid\(\), 'financeiro'/);
});
