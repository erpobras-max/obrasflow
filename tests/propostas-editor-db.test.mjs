import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const migrationUrl = new URL('../supabase/migrations/20261030180000_propostas_editor_unico.sql', import.meta.url)
const USER_ID = '10000000-0000-0000-0000-000000000001'

async function criarBanco() {
  const db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM (
      'admin','diretor','financeiro','financeiro_civil','financeiro_imobiliaria','engenharia','cliente'
    );
    CREATE TYPE public.status_proposta AS ENUM ('rascunho','enviada','aceita','rejeitada','expirada');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
      'SELECT current_setting(''request.jwt.claim.role'', true) = $2::text';
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END';

    CREATE TABLE clientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL);
    CREATE TABLE obras(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL,
      cliente_id uuid NOT NULL REFERENCES clientes(id), proposta_id uuid
    );
    CREATE TABLE orcamentos(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid NOT NULL REFERENCES obras(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE orcamento_revisoes(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orcamento_id uuid NOT NULL REFERENCES orcamentos(id),
      numero integer NOT NULL, fotografia jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE SEQUENCE propostas_numero_seq;
    CREATE TABLE propostas(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero text NOT NULL UNIQUE DEFAULT '',
      cliente_id uuid NOT NULL REFERENCES clientes(id), titulo text NOT NULL,
      valor_total numeric(14,2) NOT NULL DEFAULT 0, status status_proposta NOT NULL DEFAULT 'rascunho',
      created_by uuid, orcamento_revisao_id uuid REFERENCES orcamento_revisoes(id),
      data_envio date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE FUNCTION gerar_numero_proposta_teste() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.numero IS NULL OR NEW.numero = '' THEN
        NEW.numero := 'PROP-2026-' || lpad(nextval('propostas_numero_seq')::text, 4, '0');
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER trg_numero_proposta BEFORE INSERT ON propostas
      FOR EACH ROW EXECUTE FUNCTION gerar_numero_proposta_teste();
    CREATE TABLE proposta_revisoes(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
      orcamento_revisao_id uuid NOT NULL REFERENCES orcamento_revisoes(id), numero integer NOT NULL,
      status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aceita','rejeitada','expirada')),
      configuracao jsonb NOT NULL DEFAULT '{}', fotografia jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(proposta_id, numero)
    );
    CREATE TABLE propostas_itens(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL REFERENCES propostas(id) ON DELETE CASCADE
    );
    CREATE TABLE contratos(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL
    );
    CREATE TABLE obras_cronogramas(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL
    );

    SELECT set_config('request.jwt.claim.sub','${USER_ID}',false);
    SELECT set_config('request.jwt.claim.role','admin',false);
  `)
  await db.exec(await readFile(migrationUrl, 'utf8'))
  return db
}

async function criarOrigem(db) {
  const clienteId = (await db.query("INSERT INTO clientes(nome) VALUES ('Francisco') RETURNING id")).rows[0].id
  const obraId = (await db.query("INSERT INTO obras(nome,cliente_id) VALUES ('Casa teste',$1) RETURNING id", [clienteId])).rows[0].id
  const orcamentoId = (await db.query('INSERT INTO orcamentos(obra_id) VALUES ($1) RETURNING id', [obraId])).rows[0].id
  const revisao = (await db.query(
    `INSERT INTO orcamento_revisoes(orcamento_id,numero,fotografia)
     VALUES ($1,1,$2) RETURNING id`,
    [orcamentoId, JSON.stringify({
      orcamento: { bdi_geral: 25 },
      etapas: [{ id: 'e1', codigo: '01', nome: 'Fundação', ordem: 0 }],
      atividades: [{ id: 'a1', etapa_id: 'e1', codigo: '01.01', descricao: 'Concreto', unidade: 'm³', quantidade: 2, ordem: 0 }],
      insumos: [{ atividade_id: 'a1', categoria: 'material', coeficiente: 1, preco_unitario_centavos: 1000 }],
      memoriais: [],
    })],
  )).rows[0].id
  return { clienteId, obraId, orcamentoId, revisao }
}

const fotografiaComercial = {
  totalPrecoCentavos: 99999999,
  preco_custo: 99999999,
  etapas: [{
    id: 'e1',
    nome: 'Fundação',
    custoTotalCentavos: 90000,
    atividades: [{ id: 'a1', descricao: 'Concreto', bdi: 25, insumos: [{ nome: 'Cimento' }], precoTotalCentavos: 125050 }],
  }],
}

test('cria um único rascunho comum e permite variante explícita', async () => {
  const db = await criarBanco()
  try {
    const { revisao } = await criarOrigem(db)
    await db.exec("SELECT set_config('request.jwt.claim.role','financeiro',false)")
    const args = [revisao, JSON.stringify({ tituloProposta: 'Casa' }), JSON.stringify(fotografiaComercial), false]
    const primeira = (await db.query('SELECT criar_proposta_de_revisao($1,$2,$3,$4) AS id', args)).rows[0].id
    const repetida = (await db.query('SELECT criar_proposta_de_revisao($1,$2,$3,$4) AS id', args)).rows[0].id
    const variante = (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,true) AS id',
      [revisao, JSON.stringify({ tituloProposta: 'Casa alternativa' }), JSON.stringify(fotografiaComercial)],
    )).rows[0].id

    assert.equal(primeira, repetida)
    assert.notEqual(variante, primeira)
    assert.equal(Number((await db.query('SELECT count(*) AS total FROM propostas')).rows[0].total), 2)
    await db.query('SELECT publicar_rascunho_proposta($1,$2,$3)', [primeira, '{}', '{}'])
    const aposPublicacao = (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,false) AS id',
      [revisao, '{}', '{}'],
    )).rows[0].id
    assert.equal(aposPublicacao, primeira)
    assert.equal(
      (await db.query('SELECT duplicada_de_id FROM propostas WHERE id=$1', [variante])).rows[0].duplicada_de_id,
      primeira,
    )
  } finally {
    await db.close()
  }
})

test('sanitiza campos técnicos no servidor e publica a mesma revisão', async () => {
  const db = await criarBanco()
  try {
    const { revisao } = await criarOrigem(db)
    const propostaId = (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,false) AS id',
      [revisao, JSON.stringify({ tituloProposta: 'Casa' }), JSON.stringify(fotografiaComercial)],
    )).rows[0].id
    const antes = (await db.query('SELECT id,fotografia FROM proposta_revisoes WHERE proposta_id=$1', [propostaId])).rows[0]
    const textoFoto = JSON.stringify(antes.fotografia).toLowerCase()
    assert.doesNotMatch(textoFoto, /custo|"bdi"|"insumos"|coeficiente|margem|preco_custo|preco_unitario_centavos/)
    assert.match(textoFoto, /precototalcentavos/)
    assert.equal(antes.fotografia.totalPrecoCentavos, 2500)
    assert.equal(antes.fotografia.etapas[0].atividades[0].precoUnitarioCentavos, 1250)
    assert.equal(antes.fotografia.etapas[0].atividades[0].precoTotalCentavos, 2500)

    const revisaoId = (await db.query(
      'SELECT publicar_rascunho_proposta($1,$2,$3) AS id',
      [propostaId, JSON.stringify({ tituloProposta: 'Casa publicada' }), JSON.stringify(fotografiaComercial)],
    )).rows[0].id
    const publicada = (await db.query('SELECT id,status,enviada_at FROM proposta_revisoes WHERE proposta_id=$1', [propostaId])).rows[0]
    const proposta = (await db.query('SELECT status FROM propostas WHERE id=$1', [propostaId])).rows[0]
    assert.equal(revisaoId, antes.id)
    assert.equal(publicada.status, 'enviada')
    assert.ok(publicada.enviada_at)
    assert.equal(proposta.status, 'enviada')
    await assert.rejects(
      db.query('SELECT salvar_rascunho_proposta($1,$2,$3)', [propostaId, '{}', '{}']),
      /enviada|rascunho/i,
    )
  } finally {
    await db.close()
  }
})

test('nega DML direto nas tabelas comerciais ao papel authenticated', async () => {
  const db = await criarBanco()
  try {
    for (const tabela of ['propostas', 'proposta_revisoes']) {
      for (const privilegio of ['INSERT', 'UPDATE', 'DELETE']) {
        const permitido = (await db.query(
          'SELECT has_table_privilege($1,$2,$3) AS permitido',
          ['authenticated', tabela, privilegio],
        )).rows[0].permitido
        assert.equal(permitido, false, `${tabela} não deve permitir ${privilegio} direto`)
      }
    }
  } finally {
    await db.close()
  }
})

test('salva rascunho e inicia próximo número somente após rejeição ou expiração', async () => {
  const db = await criarBanco()
  try {
    const { revisao } = await criarOrigem(db)
    const propostaId = (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,false) AS id',
      [revisao, '{}', JSON.stringify(fotografiaComercial)],
    )).rows[0].id
    const rascunhoId = (await db.query(
      'SELECT salvar_rascunho_proposta($1,$2,$3) AS id',
      [propostaId, JSON.stringify({ tituloProposta: 'Alterada' }), JSON.stringify({ etapas: [] })],
    )).rows[0].id
    assert.equal((await db.query('SELECT configuracao FROM proposta_revisoes WHERE id=$1', [rascunhoId])).rows[0].configuracao.tituloProposta, 'Alterada')

    await db.query('SELECT publicar_rascunho_proposta($1,$2,$3)', [propostaId, '{}', '{}'])
    await db.query("UPDATE proposta_revisoes SET status='rejeitada' WHERE proposta_id=$1 AND numero=1", [propostaId])
    await db.query("UPDATE propostas SET status='rejeitada' WHERE id=$1", [propostaId])
    const segunda = (await db.query('SELECT salvar_rascunho_proposta($1,$2,$3) AS id', [propostaId, '{}', '{}'])).rows[0].id
    const linha = (await db.query('SELECT numero,status FROM proposta_revisoes WHERE id=$1', [segunda])).rows[0]
    assert.equal(Number(linha.numero), 2)
    assert.equal(linha.status, 'rascunho')
  } finally {
    await db.close()
  }
})

test('materializa a primeira revisão ao salvar uma proposta legada vinculada ao orçamento', async () => {
  const db = await criarBanco()
  try {
    const { clienteId, revisao } = await criarOrigem(db)
    const propostaId = (await db.query(
      `INSERT INTO propostas(cliente_id,titulo,orcamento_revisao_id)
       VALUES ($1,'Proposta legada',$2) RETURNING id`,
      [clienteId, revisao],
    )).rows[0].id

    const revisaoId = (await db.query(
      'SELECT salvar_rascunho_proposta($1,$2,$3) AS id',
      [propostaId, JSON.stringify({ tituloProposta: 'Migrada' }), JSON.stringify(fotografiaComercial)],
    )).rows[0].id
    const linha = (await db.query(
      'SELECT id,numero,status,orcamento_revisao_id FROM proposta_revisoes WHERE proposta_id=$1',
      [propostaId],
    )).rows[0]

    assert.equal(linha.id, revisaoId)
    assert.equal(Number(linha.numero), 1)
    assert.equal(linha.status, 'rascunho')
    assert.equal(linha.orcamento_revisao_id, revisao)
  } finally {
    await db.close()
  }
})

test('exclui somente rascunho e somente como admin ou diretor', async () => {
  const db = await criarBanco()
  try {
    const { revisao } = await criarOrigem(db)
    const criar = async () => (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,true) AS id',
      [revisao, '{}', '{}'],
    )).rows[0].id

    const rascunhoFinanceiro = await criar()
    await db.exec("SELECT set_config('request.jwt.claim.role','financeiro',false)")
    await assert.rejects(db.query('SELECT excluir_proposta_rascunho($1)', [rascunhoFinanceiro]), /permiss/i)

    await db.exec("SELECT set_config('request.jwt.claim.role','admin',false)")
    assert.equal((await db.query('SELECT excluir_proposta_rascunho($1) AS ok', [rascunhoFinanceiro])).rows[0].ok, true)
    assert.equal(Number((await db.query('SELECT count(*) AS total FROM propostas WHERE id=$1', [rascunhoFinanceiro])).rows[0].total), 0)

    for (const status of ['enviada', 'aceita', 'rejeitada', 'expirada']) {
      const id = await criar()
      await db.query('UPDATE propostas SET status=$2 WHERE id=$1', [id, status])
      await db.query('UPDATE proposta_revisoes SET status=$2 WHERE proposta_id=$1', [id, status])
      await assert.rejects(db.query('SELECT excluir_proposta_rascunho($1)', [id]), /rascunho/i)
    }
  } finally {
    await db.close()
  }
})

test('sincroniza aceite, rejeição e expiração somente a partir de revisão enviada', async () => {
  const db = await criarBanco()
  try {
    const { revisao } = await criarOrigem(db)
    const criarPublicada = async () => {
      const propostaId = (await db.query(
        'SELECT criar_proposta_de_revisao($1,$2,$3,true) AS id',
        [revisao, '{}', JSON.stringify(fotografiaComercial)],
      )).rows[0].id
      await db.query('SELECT publicar_rascunho_proposta($1,$2,$3)', [propostaId, '{}', '{}'])
      return propostaId
    }

    const rascunho = (await db.query(
      'SELECT criar_proposta_de_revisao($1,$2,$3,true) AS id',
      [revisao, '{}', '{}'],
    )).rows[0].id
    await assert.rejects(
      db.query("SELECT alterar_status_proposta_editor($1,'aceita')", [rascunho]),
      /enviada/i,
    )

    for (const status of ['aceita', 'rejeitada', 'expirada']) {
      const propostaId = await criarPublicada()
      assert.equal(
        (await db.query('SELECT alterar_status_proposta_editor($1,$2) AS ok', [propostaId, status])).rows[0].ok,
        true,
      )
      const proposta = (await db.query('SELECT status FROM propostas WHERE id=$1', [propostaId])).rows[0]
      const revisaoAtual = (await db.query('SELECT status FROM proposta_revisoes WHERE proposta_id=$1', [propostaId])).rows[0]
      assert.equal(proposta.status, status)
      assert.equal(revisaoAtual.status, status)
    }
  } finally {
    await db.close()
  }
})
