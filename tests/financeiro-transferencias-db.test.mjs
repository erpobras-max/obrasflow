import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function criarBancoTransferencias() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

    CREATE TABLE public.contas_bancarias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      banco text,
      saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
      ativo boolean NOT NULL DEFAULT true
    );
  `);

  return db;
}

test('migration financeiro_transferencias_bancarias cria tabela, indices e constraints', async () => {
  const db = await criarBancoTransferencias();
  const migration = await read('supabase/migrations/20261031150000_financeiro_transferencias_bancarias.sql');
  await db.exec(migration);

  const conta1 = await db.query(`INSERT INTO public.contas_bancarias (nome, banco) VALUES ('Banco Itaú', 'Itaú') RETURNING id;`);
  const conta2 = await db.query(`INSERT INTO public.contas_bancarias (nome, banco) VALUES ('Caixa Obra', 'Caixa') RETURNING id;`);

  const id1 = conta1.rows[0].id;
  const id2 = conta2.rows[0].id;

  // Inserção bem-sucedida de transferência
  const res = await db.query(`
    INSERT INTO public.transferencias_bancarias (conta_origem_id, conta_destino_id, valor_centavos, descricao)
    VALUES ($1, $2, 500000, 'Suprimento de Caixa de Obra')
    RETURNING id, valor_centavos, data_transferencia;
  `, [id1, id2]);

  assert.equal(res.rows.length, 1);
  assert.equal(Number(res.rows[0].valor_centavos), 500000);

  // Bloqueio de transferência para a mesma conta
  await assert.rejects(
    async () => {
      await db.query(`
        INSERT INTO public.transferencias_bancarias (conta_origem_id, conta_destino_id, valor_centavos)
        VALUES ($1, $1, 100000);
      `, [id1]);
    },
    /transferencias_contas_distintas/
  );

  // Bloqueio de valor zero ou negativo
  await assert.rejects(
    async () => {
      await db.query(`
        INSERT INTO public.transferencias_bancarias (conta_origem_id, conta_destino_id, valor_centavos)
        VALUES ($1, $2, 0);
      `, [id1, id2]);
    }
  );
});

