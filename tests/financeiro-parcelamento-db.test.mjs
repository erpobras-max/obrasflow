import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function criarBancoFinanceiro() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

    CREATE TABLE public.obras (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL
    );

    CREATE TABLE public.clientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL
    );

    CREATE TABLE public.fornecedores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      razao_social text NOT NULL
    );

    CREATE TABLE public.contas_receber (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      obra_id uuid REFERENCES public.obras(id),
      cliente_id uuid REFERENCES public.clientes(id),
      descricao text NOT NULL,
      valor_total bigint NOT NULL,
      data_vencimento date NOT NULL,
      status text NOT NULL DEFAULT 'aberta'
    );

    CREATE TABLE public.contas_pagar (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      obra_id uuid REFERENCES public.obras(id),
      fornecedor_id uuid REFERENCES public.fornecedores(id),
      descricao text NOT NULL,
      valor_total bigint NOT NULL,
      data_vencimento date NOT NULL,
      status text NOT NULL DEFAULT 'aberta'
    );
  `);

  return db;
}

test('migration financeiro_parcelamento_e_etapas adiciona colunas e indices com sucesso', async () => {
  const db = await criarBancoFinanceiro();
  const migration = await read('supabase/migrations/20261031140000_financeiro_parcelamento_e_etapas.sql');
  await db.exec(migration);

  // Testa inserção de parcelamento em contas_pagar
  const obraRes = await db.query(`INSERT INTO public.obras (nome) VALUES ('Obra Teste') RETURNING id;`);
  const obraId = obraRes.rows[0].id;

  const parcelamentoId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  await db.exec(`
    INSERT INTO public.contas_pagar 
      (obra_id, descricao, valor_total, data_vencimento, parcelamento_id, parcela_atual, total_parcelas, etapa_nome)
    VALUES
      ('${obraId}', 'Compra de Aço (1/2)', 50000, '2026-11-10', '${parcelamentoId}', 1, 2, '02 - Fundação'),
      ('${obraId}', 'Compra de Aço (2/2)', 50000, '2026-12-10', '${parcelamentoId}', 2, 2, '02 - Fundação');
  `);

  const rows = await db.query(`
    SELECT descricao, valor_total, data_vencimento, parcela_atual, total_parcelas, etapa_nome
    FROM public.contas_pagar
    WHERE parcelamento_id = '${parcelamentoId}'
    ORDER BY parcela_atual ASC;
  `);

  assert.equal(rows.rows.length, 2);
  assert.equal(rows.rows[0].descricao, 'Compra de Aço (1/2)');
  assert.equal(rows.rows[0].parcela_atual, 1);
  assert.equal(rows.rows[0].total_parcelas, 2);
  assert.equal(rows.rows[0].etapa_nome, '02 - Fundação');
  assert.equal(rows.rows[1].descricao, 'Compra de Aço (2/2)');
  assert.equal(rows.rows[1].parcela_atual, 2);
});

