// PostgreSQL isolado: PGLITE_MODULE pode apontar para uma instalação temporária.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('importa etapas da proposta, preserva planejamento e restringe leitura do cliente', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql AS 'SELECT false';
      CREATE TABLE clientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auth_user_id uuid, deleted_at timestamptz);
      CREATE TABLE propostas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, titulo text, descricao text, cliente_id uuid, valor_total numeric, observacoes text, created_by uuid);
      CREATE TABLE obras(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid UNIQUE REFERENCES propostas(id), numero text, nome text, descricao text, cliente_id uuid REFERENCES clientes(id), status text, orcamento numeric, progresso numeric, valor_executado numeric, observacoes text, created_by uuid);
      CREATE TABLE propostas_itens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES propostas(id), etapa_codigo text, etapa_nome text, item_nome text, descricao text, ordem int);
      CREATE TABLE propostas_catalogo_etapas(id uuid PRIMARY KEY);
    `);
    await db.exec(await read('db/cronograma_obra.sql'));
    await db.exec(await read('supabase/migrations/20260927000003_corrigir_rls_obra_cronograma.sql'));
    const antigo = await read('supabase/migrations/20260912220000_create_proposta_obra_medicoes.sql');
    await db.exec(antigo.slice(antigo.indexOf('create or replace function public.criar_obra_da_proposta()'), antigo.indexOf('create or replace function public.criar_medicao_da_obra')));
    const client = (await db.query("INSERT INTO clientes(auth_user_id) VALUES ('00000000-0000-0000-0000-000000000001') RETURNING id")).rows[0].id;
    const proposta = (await db.query("INSERT INTO propostas(status,titulo,cliente_id) VALUES ('aceita','Existente',$1) RETURNING id", [client])).rows[0].id;
    const obra = (await db.query('SELECT id FROM obras WHERE proposta_id=$1', [proposta])).rows[0].id;
    await db.query("INSERT INTO propostas_itens(proposta_id,etapa_codigo,etapa_nome,descricao,ordem) VALUES ($1,'1','Fundação','Serviço A',0),($1,'1','Fundação','Serviço B',1),($1,'2','Estrutura','Serviço C',2),($1,NULL,NULL,'Serviço avulso',3)",[proposta]);
    await db.query("INSERT INTO obra_cronograma(obra_id,nome,ordem,data_inicio,data_fim,progresso) VALUES ($1,'Fundação',1,'2026-09-01','2026-09-30',25)",[obra]);
    await db.exec(await read('supabase/migrations/20260927000006_cronograma_automatico_proposta.sql'));
    const migration = await read('supabase/migrations/20260928000000_cronograma_etapas_proposta.sql');
    await db.exec(migration);
    let rows = (await db.query('SELECT * FROM obra_cronograma WHERE obra_id=$1 ORDER BY ordem', [obra])).rows;
    assert.deepEqual(rows.map(r => r.nome), ['Fundação','Estrutura','Serviço avulso']);
    assert.equal(Number(rows[0].progresso),25);
    assert.equal(new Date(rows[0].data_inicio).toISOString().slice(0,10),'2026-09-01');
    assert.ok(rows.every(r => r.etapa_origem_key && Number(r.meta_percentual) === 100));
    // Reaplicar não duplica nem reinicia datas/percentuais.
    await db.exec(migration);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM obra_cronograma')).rows[0].n,3);
    // Aceite posterior aos itens cria a obra e as etapas dentro da mesma operação.
    const p2 = (await db.query("INSERT INTO propostas(status,titulo) VALUES ('rascunho','Nova') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO propostas_itens(proposta_id,etapa_codigo,etapa_nome,descricao,ordem) VALUES ($1,'1','Cobertura','Telha',0)",[p2]);
    await db.query("UPDATE propostas SET status='aceita' WHERE id=$1",[p2]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM obra_cronograma c JOIN obras o ON o.id=c.obra_id WHERE o.proposta_id=$1',[p2])).rows[0].n,1);
    // Formulário que salva a proposta aceita antes de inserir os itens.
    const p3 = (await db.query("INSERT INTO propostas(status,titulo) VALUES ('aceita','Itens posteriores') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO propostas_itens(proposta_id,etapa_codigo,etapa_nome,descricao,ordem) VALUES ($1,'1','Pintura','Parede',0),($1,'1','Pintura','Teto',1)",[p3]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM obra_cronograma c JOIN obras o ON o.id=c.obra_id WHERE o.proposta_id=$1',[p3])).rows[0].n,1);
    await db.query("UPDATE obra_cronograma SET meta_percentual=100,progresso=29.5 WHERE obra_id=$1",[obra]);
    assert.equal(Number((await db.query('SELECT progresso FROM obra_cronograma WHERE obra_id=$1 LIMIT 1',[obra])).rows[0].progresso),29.5);
    await assert.rejects(db.query("UPDATE obra_cronograma SET meta_percentual=101 WHERE obra_id=$1",[obra]));
    await assert.rejects(db.query("UPDATE obra_cronograma SET data_inicio='2026-10-01',data_fim='2026-09-01' WHERE obra_id=$1",[obra]));
    await db.exec("GRANT USAGE ON SCHEMA public,auth TO authenticated; GRANT SELECT ON obras,clientes TO authenticated; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
    rows = (await db.query('SELECT * FROM obra_cronograma')).rows;
    assert.equal(rows.length,3);
    assert.ok(rows.every(r => r.obra_id === obra));
    assert.equal((await db.query('UPDATE obra_cronograma SET progresso=100 RETURNING id')).rows.length,0);
    await assert.rejects(db.query('SELECT importar_etapas_cronograma($1)',[obra]));
    await db.exec("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
    assert.equal((await db.query('SELECT * FROM obra_cronograma')).rows.length,0);
  } finally { await db.close(); }
});
