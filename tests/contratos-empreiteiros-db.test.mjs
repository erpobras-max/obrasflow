import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

async function criarBancoLegado() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM (
      'admin','diretor','financeiro','compras','engenharia','almoxarifado','rh','cliente',
      'funcionario','financeiro_civil','financeiro_imobiliaria','imobiliaria'
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
      'SELECT current_setting(''request.jwt.claim.role'', true) = $2::text';
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END';

    -- Obras
    CREATE TABLE public.obras (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      status text NOT NULL DEFAULT 'planejamento',
      created_at timestamptz DEFAULT now()
    );

    -- Fornecedores
    CREATE TABLE public.fornecedores (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      razao_social text NOT NULL,
      cpf_cnpj text,
      created_at timestamptz DEFAULT now()
    );

    -- Contas Pagar (legado)
    CREATE TABLE public.contas_pagar (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      descricao text NOT NULL,
      fornecedor_id uuid REFERENCES public.fornecedores(id),
      obra_id uuid REFERENCES public.obras(id),
      valor numeric(14,2) NOT NULL DEFAULT 0,
      valor_pago numeric(14,2) NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'aberto',
      data_vencimento date,
      data_pagamento date,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Serviços Terceirizados (legado)
    CREATE TABLE public.servicos_terceirizados (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      obra_id uuid NOT NULL REFERENCES public.obras(id),
      fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id),
      descricao text NOT NULL,
      etapa_cronograma text,
      unidade_medida text NOT NULL DEFAULT 'un',
      quantidade_total numeric(14,3) NOT NULL DEFAULT 1,
      valor_unitario numeric(14,2) NOT NULL DEFAULT 0,
      valor_total numeric(14,2) NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'rascunho',
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Medições Terceirizados (legado)
    CREATE TABLE public.medicoes_terceirizados (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      servico_id uuid NOT NULL REFERENCES public.servicos_terceirizados(id) ON DELETE CASCADE,
      numero_medicao integer NOT NULL,
      quantidade_medida numeric(14,3) NOT NULL,
      valor_medicao numeric(14,2) NOT NULL,
      data_medicao date NOT NULL DEFAULT CURRENT_DATE,
      periodo_inicio date,
      periodo_fim date,
      status text NOT NULL DEFAULT 'rascunho',
      conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  `);
  return db;
}

test('migration contratos_empreiteiros cria tabelas, constraints, RLS e backfill de compatibilidade', async () => {
  const db = await criarBancoLegado();

  // Insere dados legados para testar o backfill
  const obraId = (await db.query("INSERT INTO obras(nome) VALUES ('Obra Alpha') RETURNING id")).rows[0].id;
  const fornecedorId = (await db.query("INSERT INTO fornecedores(razao_social) VALUES ('Empreiteiro Silva') RETURNING id")).rows[0].id;

  // 1. Serviço rascunho
  const s1 = (await db.query(`
    INSERT INTO servicos_terceirizados(obra_id, fornecedor_id, descricao, quantidade_total, valor_unitario, valor_total, status)
    VALUES ($1, $2, 'Alvenaria Bloco A', 100, 50.00, 5000.00, 'rascunho')
    RETURNING id
  `, [obraId, fornecedorId])).rows[0].id;

  // 2. Serviço aprovado com medição aprovada vinculada a conta_pagar
  const s2 = (await db.query(`
    INSERT INTO servicos_terceirizados(obra_id, fornecedor_id, descricao, quantidade_total, valor_unitario, valor_total, status)
    VALUES ($1, $2, 'Pintura Fachada', 200, 20.00, 4000.00, 'aprovado')
    RETURNING id
  `, [obraId, fornecedorId])).rows[0].id;

  const cp1 = (await db.query(`
    INSERT INTO contas_pagar(descricao, fornecedor_id, obra_id, valor, valor_pago, status)
    VALUES ('Medição 1 Pintura', $1, $2, 2000.00, 2000.00, 'pago')
    RETURNING id
  `, [fornecedorId, obraId])).rows[0].id;

  const m1 = (await db.query(`
    INSERT INTO medicoes_terceirizados(servico_id, numero_medicao, quantidade_medida, valor_medicao, status, conta_pagar_id)
    VALUES ($1, 1, 100, 2000.00, 'financeiro_gerado', $2)
    RETURNING id
  `, [s2, cp1])).rows[0].id;

  // Executa a migration nova
  const migrationSql = await read('supabase/migrations/20261031000000_contratos_empreiteiros.sql');
  await db.exec(migrationSql);

  // Define role admin
  await db.exec("SELECT set_config('request.jwt.claim.role','admin',false)");

  // Verifica criação das novas tabelas
  const contratos = await db.query('SELECT * FROM contratos_empreiteiros');
  assert.equal(contratos.rows.length, 2, 'Backfill deve criar exatamente 1 contrato por serviço legado');

  const c1 = contratos.rows.find((c) => c.objeto.includes('Alvenaria Bloco A'));
  assert.ok(c1, 'Contrato da Alvenaria deve existir');
  assert.equal(c1.status, 'rascunho', 'Status rascunho deve ser preservado');

  const c2 = contratos.rows.find((c) => c.objeto.includes('Pintura Fachada'));
  assert.ok(c2, 'Contrato da Pintura deve existir');
  assert.equal(c2.status, 'ativo', 'Serviço aprovado deve virar contrato ativo');

  // Verifica que servicos_terceirizados foi estendido e vinculado
  const s2Atualizado = (await db.query('SELECT * FROM servicos_terceirizados WHERE id = $1', [s2])).rows[0];
  assert.equal(s2Atualizado.contrato_empreiteiro_id, c2.id, 'Serviço legado deve apontar para o contrato gerado no backfill');

  // Verifica boletim de medição gerado
  const medicoesCabecalhos = await db.query('SELECT * FROM medicoes_empreiteiros');
  assert.equal(medicoesCabecalhos.rows.length, 1, 'Backfill deve criar exatamente 1 cabeçalho para a medição legada');

  const medCab = medicoesCabecalhos.rows[0];
  assert.equal(medCab.contrato_empreiteiro_id, c2.id);
  assert.equal(medCab.status, 'paga', 'Medição financeiro_gerado com conta paga deve virar status paga');
  assert.equal(medCab.conta_pagar_id, cp1, 'conta_pagar_id deve ser preservado');

  // Verifica extensão da medição legada
  const m1Atualizado = (await db.query('SELECT * FROM medicoes_terceirizados WHERE id = $1', [m1])).rows[0];
  assert.equal(m1Atualizado.medicao_empreiteiro_id, medCab.id);

  // Verifica contas_pagar vínculo
  const cpAtualizado = (await db.query('SELECT * FROM contas_pagar WHERE id = $1', [cp1])).rows[0];
  assert.equal(cpAtualizado.medicao_empreiteiro_id, medCab.id);

  // Verifica alçadas padrão semeadas
  const alcadas = await db.query('SELECT * FROM medicao_empreiteiro_alcadas WHERE ativo = true');
  const perfisAlcada = alcadas.rows.map((a) => a.perfil);
  assert.ok(perfisAlcada.includes('admin'), 'Admin deve estar na alçada');
  assert.ok(perfisAlcada.includes('diretor'), 'Diretor deve estar na alçada');
});


test('aprovação e cancelamento de medição via RPCs são transacionais e idempotentes', async () => {
  const db = await criarBancoLegado();
  const obraId = (await db.query("INSERT INTO obras(nome) VALUES ('Obra Beta') RETURNING id")).rows[0].id;
  const fornecedorId = (await db.query("INSERT INTO fornecedores(razao_social) VALUES ('Empreiteiro Souza') RETURNING id")).rows[0].id;

  const migrationSql = await read('supabase/migrations/20261031000000_contratos_empreiteiros.sql');
  await db.exec(migrationSql);
  await db.exec("SELECT set_config('request.jwt.claim.role','admin',false)");

  // Cria contrato ativo
  const contratoId = (await db.query(`
    INSERT INTO contratos_empreiteiros (numero, obra_id, fornecedor_id, tipo, objeto, status, valor_total_original_centavos, valor_total_atual_centavos)
    VALUES ('CTR-2026-0001', $1, $2, 'preco_unitario', 'Instalações Elétricas', 'ativo', 1000000, 1000000)
    RETURNING id
  `, [obraId, fornecedorId])).rows[0].id;

  // Cria medição rascunho com retenção e líquido
  const medicaoId = (await db.query(`
    INSERT INTO medicoes_empreiteiros (contrato_empreiteiro_id, numero, status, valor_bruto_centavos, valor_retencao_centavos, valor_liquido_centavos)
    VALUES ($1, 1, 'rascunho', 500000, 50000, 450000)
    RETURNING id
  `, [contratoId])).rows[0].id;

  // 1. Aprovação via RPC
  const resAprov = (await db.query('SELECT public.aprovar_medicao_empreiteiro($1, $2) AS r', [medicaoId, '2026-11-15'])).rows[0].r;
  assert.equal(resAprov.sucesso, true);
  assert.equal(resAprov.status, 'aprovada');
  assert.ok(resAprov.conta_pagar_id, 'Deve criar uma conta a pagar');

  // Verifica conta criada
  const conta = (await db.query('SELECT * FROM contas_pagar WHERE id = $1', [resAprov.conta_pagar_id])).rows[0];
  assert.equal(Number(conta.valor), 4500.00, 'Valor da conta deve ser o valor líquido em reais (4500.00)');
  assert.equal(conta.status, 'aberto');

  // Verifica retenção registrada
  const ret = (await db.query('SELECT * FROM retencoes_empreiteiros WHERE medicao_empreiteiro_id = $1', [medicaoId])).rows[0];
  assert.equal(Number(ret.valor_retido_centavos), 50000);
  assert.equal(ret.status, 'retida');

  // 2. Idempotência: aprovar novamente não deve criar outra conta
  const resRepetida = (await db.query('SELECT public.aprovar_medicao_empreiteiro($1, $2) AS r', [medicaoId, '2026-11-15'])).rows[0].r;
  assert.equal(resRepetida.sucesso, true);
  assert.equal(resRepetida.ja_aprovada, true);

  const totalContas = (await db.query('SELECT COUNT(*) FROM contas_pagar WHERE medicao_empreiteiro_id = $1', [medicaoId])).rows[0].count;
  assert.equal(Number(totalContas), 1, 'Não deve duplicar conta a pagar em aprovação concorrente ou repetida');

  // 3. Cancelamento enquanto em aberto
  const resCancel = (await db.query('SELECT public.cancelar_medicao_empreiteiro($1, $2) AS r', [medicaoId, 'Erro de medição'])).rows[0].r;
  assert.equal(resCancel.sucesso, true);
  assert.equal(resCancel.status, 'cancelada');

  const contaCancelada = (await db.query('SELECT * FROM contas_pagar WHERE id = $1', [resAprov.conta_pagar_id])).rows[0];
  assert.equal(contaCancelada.status, 'cancelado', 'Conta a pagar em aberto deve ser cancelada atomicamente');
});


test('rollback documentado permite reverter e reaplicar a migration em banco efêmero', async () => {
  const db = await criarBancoLegado();
  const migrationSql = await read('supabase/migrations/20261031000000_contratos_empreiteiros.sql');

  // Aplica migration
  await db.exec(migrationSql);
  assert.equal(Number((await db.query('SELECT COUNT(*) FROM contratos_empreiteiros')).rows[0].count), 0);

  // Executa rollback
  await db.exec(`
    DROP FUNCTION IF EXISTS public.liberar_retencao_empreiteiro(uuid, bigint, date);
    DROP FUNCTION IF EXISTS public.cancelar_medicao_empreiteiro(uuid, text);
    DROP FUNCTION IF EXISTS public.aprovar_medicao_empreiteiro(uuid, date);
    DROP TABLE IF EXISTS public.contrato_empreiteiro_auditoria, public.medicao_empreiteiro_links,
      public.retencoes_empreiteiros, public.medicao_empreiteiro_anexos, public.contrato_empreiteiro_aditivos,
      public.medicao_empreiteiro_ajustes, public.medicoes_empreiteiros, public.contratos_empreiteiros,
      public.medicao_empreiteiro_alcadas CASCADE;
  `);

  // Re-aplica migration com sucesso
  await db.exec(migrationSql);
  assert.equal(Number((await db.query('SELECT COUNT(*) FROM contratos_empreiteiros')).rows[0].count), 0);
});
