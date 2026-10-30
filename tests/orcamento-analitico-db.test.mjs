import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function criarBancoBase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin','diretor','financeiro','compras','engenharia','almoxarifado','rh','cliente');
    CREATE TYPE public.status_proposta AS ENUM ('rascunho','enviada','aceita','rejeitada','expirada');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
      'SELECT current_setting(''request.jwt.claim.role'', true) = $2::text';
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END';
    CREATE TABLE obras(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE orcamentos(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid NOT NULL REFERENCES obras(id),
      total_estimado bigint NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE referencia_insumos(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE referencia_composicoes(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE propostas(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text NOT NULL UNIQUE, titulo text NOT NULL,
      cliente_id uuid, valor_total numeric(14,2) NOT NULL DEFAULT 0,
      status public.status_proposta NOT NULL DEFAULT 'rascunho', created_at timestamptz DEFAULT now()
    );
  `);
  return db;
}

test('schema analítico valida valores, hierarquia, publicação e revisão aceita', async () => {
  const db = await criarBancoBase();
  try {
    await db.exec(await read('supabase/migrations/20261030000000_orcamento_analitico.sql'));

    const obraId = (await db.query('INSERT INTO obras DEFAULT VALUES RETURNING id')).rows[0].id;
    const orcamentoId = (await db.query('INSERT INTO orcamentos(obra_id) VALUES ($1) RETURNING id', [obraId])).rows[0].id;
    const etapa = (await db.query(
      "INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'1','Fundação',1) RETURNING id",
      [orcamentoId],
    )).rows[0].id;

    await assert.rejects(db.query(
      "INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem,parent_id) VALUES ($1,'2','Inválida',2,$2)",
      [orcamentoId, '00000000-0000-0000-0000-000000000099'],
    ));
    await assert.rejects(db.query(
      "INSERT INTO orcamento_atividades(etapa_id,descricao,unidade,quantidade,bdi_percentual) VALUES ($1,'A','m2',-1,10)",
      [etapa],
    ));

    const atividade = (await db.query(
      "INSERT INTO orcamento_atividades(etapa_id,descricao,unidade,quantidade) VALUES ($1,'Concreto','m3',2) RETURNING id",
      [etapa],
    )).rows[0].id;
    await assert.rejects(db.query(
      "INSERT INTO orcamento_atividade_insumos(atividade_id,descricao,unidade,categoria,coeficiente,preco_unitario_centavos) VALUES ($1,'Cimento','kg','material',-1,100)",
      [atividade],
    ));

    const primeira = (await db.query('SELECT * FROM publicar_revisao_orcamento($1,$2)', [orcamentoId, 'publicar-1'])).rows[0];
    const repetida = (await db.query('SELECT * FROM publicar_revisao_orcamento($1,$2)', [orcamentoId, 'publicar-1'])).rows[0];
    assert.equal(primeira.id, repetida.id, 'a publicação deve ser idempotente');
    assert.equal(Number(primeira.numero), 1);

    const propostaId = (await db.query(
      "INSERT INTO propostas(numero,titulo,status,orcamento_revisao_id) VALUES ('PROP-1','Casa','aceita',$1) RETURNING id",
      [primeira.id],
    )).rows[0].id;
    await db.query(
      "INSERT INTO proposta_revisoes(proposta_id,orcamento_revisao_id,numero,status,fotografia) VALUES ($1,$2,1,'aceita','{}')",
      [propostaId, primeira.id],
    );
    await assert.rejects(db.query("UPDATE orcamento_revisoes SET observacoes='alterada' WHERE id=$1", [primeira.id]));
  } finally {
    await db.close();
  }
});

test('RLS permite engenharia e nega papel sem gestão do orçamento', async () => {
  const db = await criarBancoBase();
  try {
    await db.exec(await read('supabase/migrations/20261030000000_orcamento_analitico.sql'));
    const obraId = (await db.query('INSERT INTO obras DEFAULT VALUES RETURNING id')).rows[0].id;
    const orcamentoId = (await db.query('INSERT INTO orcamentos(obra_id) VALUES ($1) RETURNING id', [obraId])).rows[0].id;
    await db.exec("GRANT USAGE ON SCHEMA public,auth TO authenticated; SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','engenharia',false)");
    assert.equal((await db.query("INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'1','Etapa',1) RETURNING id", [orcamentoId])).rows.length, 1);
    await db.exec("SELECT set_config('request.jwt.claim.role','cliente',false)");
    await assert.rejects(db.query("INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'2','Negada',2)", [orcamentoId]));
  } finally {
    await db.close();
  }
});

test('rollback documentado permite reaplicar a migration', async () => {
  const db = await criarBancoBase();
  try {
    const migration = await read('supabase/migrations/20261030000000_orcamento_analitico.sql');
    await db.exec(migration);
    await db.exec(`
      ALTER TABLE public.propostas DROP COLUMN IF EXISTS orcamento_revisao_id;
      ALTER TABLE public.orcamentos DROP COLUMN IF EXISTS nome, DROP COLUMN IF EXISTS uf,
        DROP COLUMN IF EXISTS competencia, DROP COLUMN IF EXISTS regime,
        DROP COLUMN IF EXISTS bdi_geral, DROP COLUMN IF EXISTS analitico_ativo;
      DROP FUNCTION IF EXISTS public.duplicar_orcamento_analitico(uuid,uuid);
      DROP FUNCTION IF EXISTS public.publicar_revisao_orcamento(uuid,text);
      DROP TABLE IF EXISTS public.sinapi_importacoes, public.sinapi_composicao_itens,
        public.sinapi_competencias, public.proposta_revisoes, public.orcamento_auditoria,
        public.orcamento_revisoes, public.orcamento_memoriais,
        public.orcamento_atividade_insumos, public.orcamento_atividades,
        public.orcamento_etapas CASCADE;
    `);
    await db.exec(migration);
    assert.equal((await db.query("SELECT to_regclass('public.orcamento_atividades') AS tabela")).rows[0].tabela, 'orcamento_atividades');
  } finally {
    await db.close();
  }
});

