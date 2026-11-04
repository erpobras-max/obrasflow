import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = new URL(
  "../supabase/migrations/20261104000000_portal_cliente_evolucao.sql",
  import.meta.url,
);

async function source() {
  return readFile(migration, "utf8");
}

test("RPCs do portal isolam a proposta aceita e congelam a resposta do cliente", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
        'BEGIN NEW.updated_at = now(); RETURN NEW; END';
      CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
      CREATE TABLE public.clientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id uuid, deleted_at timestamptz);
      CREATE TABLE public.propostas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text, titulo text, status text);
      CREATE TABLE public.obras(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid REFERENCES public.clientes(id), proposta_id uuid REFERENCES public.propostas(id));
      CREATE TABLE public.proposta_revisoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES public.propostas(id), numero int, status text, enviada_at timestamptz, fotografia jsonb);
      CREATE FUNCTION public.sanitizar_fotografia_proposta(jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS
        'SELECT jsonb_build_object(''totalPrecoCentavos'', $1->''totalPrecoCentavos'')';
    `);
    await db.exec(await source());
    const clienteId = '10000000-0000-0000-0000-000000000001';
    const outroClienteId = '20000000-0000-0000-0000-000000000002';
    await db.query('INSERT INTO auth.users(id) VALUES ($1),($2)', [clienteId, outroClienteId]);
    await db.query('INSERT INTO clientes(id,auth_user_id) VALUES ($1,$1),($2,$2)', [clienteId, outroClienteId]);
    const propostaId = (await db.query("INSERT INTO propostas(numero,titulo,status) VALUES ('PROP-1','Casa','aceita') RETURNING id")).rows[0].id;
    const obraId = (await db.query('INSERT INTO obras(cliente_id,proposta_id) VALUES ($1,$2) RETURNING id', [clienteId, propostaId])).rows[0].id;
    await db.query("INSERT INTO proposta_revisoes(proposta_id,numero,status,fotografia) VALUES ($1,1,'aceita',$2)", [propostaId, JSON.stringify({ totalPrecoCentavos: 125000, custoTotal: 90000, bdi: 25 })]);
    await db.query("INSERT INTO portal_solicitacoes(obra_id,titulo,descricao) VALUES ($1,'Escolha de piso','Confirme o revestimento desejado')", [obraId]);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${clienteId}',false)`);
    const proposta = (await db.query('SELECT consultar_proposta_portal($1) AS resultado', [obraId])).rows[0].resultado;
    assert.equal(proposta.fotografia.totalPrecoCentavos, 125000);
    assert.equal(proposta.fotografia.custoTotal, undefined);
    const solicitacaoId = (await db.query('SELECT id FROM portal_solicitacoes')).rows[0].id;
    await db.query("SELECT responder_solicitacao_portal($1,'Aprovo esta opção')", [solicitacaoId]);
    await assert.rejects(() => db.query("SELECT responder_solicitacao_portal($1,'Troquei de ideia')", [solicitacaoId]), /já foi respondida/i);
    await db.exec(`SELECT set_config('request.jwt.claim.sub','${outroClienteId}',false)`);
    const bloqueada = (await db.query('SELECT consultar_proposta_portal($1) AS resultado', [obraId])).rows[0].resultado;
    assert.deepEqual(bloqueada, {});
  } finally {
    await db.close();
  }
});

test("portal cria decisões por obra com resposta única do cliente", async () => {
  const sql = await source();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.portal_solicitacoes/i);
  assert.match(sql, /obra_id uuid NOT NULL REFERENCES public\.obras\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /respondido_por uuid REFERENCES auth\.users\(id\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.responder_solicitacao_portal/i);
  assert.match(sql, /IF v_solicitacao\.respondido_em IS NOT NULL THEN[\s\S]*já foi respondida/i);
  assert.match(sql, /WHERE id = p_solicitacao_id[\s\S]*AND respondido_em IS NULL/i);
});

test("portal devolve somente proposta aceita e fotografia comercial sem custos internos", async () => {
  const sql = await source();
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.consultar_proposta_portal/i);
  assert.match(sql, /pr\.status = 'aceita'/i);
  assert.match(sql, /proposta\.status = 'aceita'/i);
  assert.match(sql, /public\.sanitizar_fotografia_proposta\(revisao\.fotografia\)/i);
  assert.match(sql, /cliente\.auth_user_id = auth\.uid\(\)/i);
});

test("políticas de decisões permitem ao cliente apenas ler e responder dados da própria obra", async () => {
  const sql = await source();
  assert.match(sql, /CREATE POLICY portal_solicitacoes_cliente_select/i);
  assert.match(sql, /CREATE POLICY portal_solicitacoes_equipe_gestao/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.responder_solicitacao_portal\(uuid, text\) TO authenticated/i);
  assert.doesNotMatch(sql, /CREATE POLICY[\s\S]*portal_solicitacoes[\s\S]*USING \(true\)/i);
});
