import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function criarBancoBase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM (
      'admin','diretor','financeiro','financeiro_civil','compras','engenharia','cliente'
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
      'SELECT current_setting(''request.jwt.claim.role'', true) = $2::text';
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
      'BEGIN NEW.updated_at = now(); RETURN NEW; END';

    CREATE TABLE obras (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL,
      orcamento numeric(14,2) NOT NULL DEFAULT 0, progresso integer NOT NULL DEFAULT 0,
      contrato_id uuid, proposta_id uuid
    );
    ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
    CREATE POLICY obras_acesso ON obras FOR SELECT TO authenticated USING (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor')
      OR id::text = current_setting('request.jwt.claim.obra_id', true)
    );

    CREATE TABLE orcamentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid NOT NULL REFERENCES obras(id),
      analitico_ativo boolean NOT NULL DEFAULT true
    );
    CREATE TABLE orcamento_etapas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orcamento_id uuid NOT NULL REFERENCES orcamentos(id),
      codigo text NOT NULL, nome text NOT NULL, ordem integer NOT NULL DEFAULT 0
    );
    CREATE TABLE orcamento_atividades (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), etapa_id uuid NOT NULL REFERENCES orcamento_etapas(id),
      descricao text NOT NULL, quantidade numeric(18,6) NOT NULL DEFAULT 1
    );
    CREATE TABLE orcamento_atividade_insumos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atividade_id uuid NOT NULL REFERENCES orcamento_atividades(id),
      coeficiente numeric(20,8) NOT NULL, preco_unitario_centavos bigint NOT NULL
    );
    CREATE TABLE orcamento_revisoes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), orcamento_id uuid NOT NULL REFERENCES orcamentos(id),
      numero integer NOT NULL DEFAULT 1
    );
    CREATE TABLE propostas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text NOT NULL,
      valor_total numeric(14,2) NOT NULL DEFAULT 0, orcamento_revisao_id uuid REFERENCES orcamento_revisoes(id)
    );
    CREATE TABLE proposta_revisoes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL REFERENCES propostas(id),
      orcamento_revisao_id uuid NOT NULL REFERENCES orcamento_revisoes(id), status text NOT NULL,
      fotografia jsonb NOT NULL DEFAULT '{}'
    );
    CREATE TABLE contratos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES propostas(id),
      valor_total numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'ativo'
    );

    CREATE TABLE pedidos_compra (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid NOT NULL REFERENCES obras(id),
      status text NOT NULL, valor_total bigint NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE pedido_itens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES pedidos_compra(id),
      descricao text NOT NULL, quantidade numeric(10,3) NOT NULL, valor_unit bigint NOT NULL
    );
    CREATE TABLE cotacoes_pedidos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid REFERENCES obras(id),
      status text NOT NULL, valor_total bigint NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now()
    );
    CREATE TABLE cotacoes_pedidos_itens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES cotacoes_pedidos(id),
      descricao text NOT NULL, quantidade numeric(10,3) NOT NULL, valor_unitario bigint NOT NULL,
      qtd_recebida numeric(10,3) NOT NULL DEFAULT 0
    );

    CREATE TABLE contratos_empreiteiros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid NOT NULL REFERENCES obras(id),
      objeto text NOT NULL, status text NOT NULL, valor_total_atual_centavos bigint NOT NULL,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE medicoes_empreiteiros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contrato_empreiteiro_id uuid NOT NULL REFERENCES contratos_empreiteiros(id),
      status text NOT NULL, valor_bruto_centavos bigint NOT NULL, periodo_fim date,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE contas_pagar (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid REFERENCES obras(id), descricao text NOT NULL,
      valor_total bigint NOT NULL, valor_pago bigint, status text NOT NULL, data_vencimento date NOT NULL,
      data_pagamento date, pedido_id uuid REFERENCES pedidos_compra(id),
      cotacao_pedido_id uuid REFERENCES cotacoes_pedidos(id),
      medicao_empreiteiro_id uuid REFERENCES medicoes_empreiteiros(id), etapa_id uuid, etapa_nome text,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE contas_receber (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), obra_id uuid REFERENCES obras(id), descricao text NOT NULL,
      valor_total bigint NOT NULL, valor_aditivo bigint NOT NULL DEFAULT 0, valor_recebido bigint,
      status text NOT NULL, data_vencimento date NOT NULL, data_recebimento date,
      etapa_id uuid, etapa_nome text, created_at timestamptz DEFAULT now()
    );

    ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orcamento_etapas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orcamento_atividades ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orcamento_atividade_insumos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE orcamento_revisoes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE proposta_revisoes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pedidos_compra ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
    CREATE POLICY legado_analitico ON orcamentos FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_analitico ON orcamento_etapas FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_analitico ON orcamento_atividades FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_analitico ON orcamento_atividade_insumos FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_analitico ON orcamento_revisoes FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_analitico ON proposta_revisoes FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'engenharia'));
    CREATE POLICY legado_compras ON pedidos_compra FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compras'));
    CREATE POLICY legado_compras ON pedido_itens FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'compras'));

    GRANT USAGE ON SCHEMA public, auth TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  return db;
}

async function aplicarMigration(db) {
  await db.exec(await read("supabase/migrations/20261102000000_resultado_obra_cockpit.sql"));
}

async function semearCenario(db) {
  const obraId = (
    await db.query(
      "INSERT INTO obras(nome, orcamento, progresso) VALUES ('Obra Cockpit', 900, 20) RETURNING id",
    )
  ).rows[0].id;
  const orcamentoId = (
    await db.query("INSERT INTO orcamentos(obra_id) VALUES ($1) RETURNING id", [obraId])
  ).rows[0].id;
  const etapaFundacao = (
    await db.query(
      "INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'1','Fundação',1) RETURNING id",
      [orcamentoId],
    )
  ).rows[0].id;
  const etapaDuplicadaA = (
    await db.query(
      "INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'2','Acabamento',2) RETURNING id",
      [orcamentoId],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO orcamento_etapas(orcamento_id,codigo,nome,ordem) VALUES ($1,'3','Acabamento',3)",
    [orcamentoId],
  );
  const atividade = (
    await db.query(
      "INSERT INTO orcamento_atividades(etapa_id,descricao,quantidade) VALUES ($1,'Concreto',2) RETURNING id",
      [etapaFundacao],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO orcamento_atividade_insumos(atividade_id,coeficiente,preco_unitario_centavos) VALUES ($1,3,100)",
    [atividade],
  );

  const revisaoOrcamentoId = (
    await db.query("INSERT INTO orcamento_revisoes(orcamento_id) VALUES ($1) RETURNING id", [
      orcamentoId,
    ])
  ).rows[0].id;
  const propostaId = (
    await db.query(
      "INSERT INTO propostas(status,valor_total,orcamento_revisao_id) VALUES ('aceita',1000,$1) RETURNING id",
      [revisaoOrcamentoId],
    )
  ).rows[0].id;
  await db.query(
    `INSERT INTO proposta_revisoes(proposta_id,orcamento_revisao_id,status,fotografia)
     VALUES ($1,$2,'aceita','{"totalPrecoCentavos":100000}')`,
    [propostaId, revisaoOrcamentoId],
  );
  const contratoComercialId = (
    await db.query(
      "INSERT INTO contratos(proposta_id,valor_total,status) VALUES ($1,900,'ativo') RETURNING id",
      [propostaId],
    )
  ).rows[0].id;
  await db.query("UPDATE obras SET proposta_id=$1, contrato_id=$2 WHERE id=$3", [
    propostaId,
    contratoComercialId,
    obraId,
  ]);

  const pedidoNovoId = (
    await db.query(
      "INSERT INTO cotacoes_pedidos(obra_id,status,valor_total) VALUES ($1,'parcialmente_recebido',1000) RETURNING id",
      [obraId],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO cotacoes_pedidos_itens(pedido_id,descricao,quantidade,valor_unitario,qtd_recebida) VALUES ($1,'Cimento',10,100,2)",
    [pedidoNovoId],
  );

  const pedidoLegadoId = (
    await db.query(
      "INSERT INTO pedidos_compra(obra_id,status,valor_total) VALUES ($1,'confirmado',1000) RETURNING id",
      [obraId],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO pedido_itens(pedido_id,descricao,quantidade,valor_unit) VALUES ($1,'Aço',10,100)",
    [pedidoLegadoId],
  );
  const pedidoLegadoSemSaldoId = (
    await db.query(
      "INSERT INTO pedidos_compra(obra_id,status,valor_total) VALUES ($1,'confirmado',500) RETURNING id",
      [obraId],
    )
  ).rows[0].id;
  await db.query(
    "INSERT INTO pedido_itens(pedido_id,descricao,quantidade,valor_unit) VALUES ($1,'Areia',5,100)",
    [pedidoLegadoSemSaldoId],
  );

  const contratoEmpreiteiroId = (
    await db.query(
      "INSERT INTO contratos_empreiteiros(obra_id,objeto,status,valor_total_atual_centavos) VALUES ($1,'Alvenaria','ativo',5000) RETURNING id",
      [obraId],
    )
  ).rows[0].id;
  const medicaoId = (
    await db.query(
      "INSERT INTO medicoes_empreiteiros(contrato_empreiteiro_id,status,valor_bruto_centavos,periodo_fim) VALUES ($1,'aprovada',2000,'2026-10-15') RETURNING id",
      [contratoEmpreiteiroId],
    )
  ).rows[0].id;

  await db.query(
    `INSERT INTO contas_pagar(
       obra_id,descricao,valor_total,valor_pago,status,data_vencimento,data_pagamento,pedido_id,etapa_nome,created_at
     ) VALUES ($1,'Pedido legado',400,300,'paga','2026-10-15','2026-10-20',$2,'Fundação','2026-10-15')`,
    [obraId, pedidoLegadoId],
  );
  await db.query(
    `INSERT INTO contas_pagar(
       obra_id,descricao,valor_total,valor_pago,status,data_vencimento,data_pagamento,medicao_empreiteiro_id,etapa_nome,created_at
     ) VALUES ($1,'Medição alvenaria',2000,1000,'paga','2026-10-18','2026-10-25',$2,'Acabamento','2026-10-18')`,
    [obraId, medicaoId],
  );
  await db.query(
    "INSERT INTO contas_receber(obra_id,descricao,valor_total,valor_aditivo,status,data_vencimento) VALUES ($1,'Receita fallback',80000,5000,'aberta','2026-10-30')",
    [obraId],
  );

  await db.query(
    `INSERT INTO resultado_obra_apropriacoes(obra_id,origem_tipo,origem_id,orcamento_etapa_id)
     VALUES ($1,'cotacao_pedido',$2,$3)`,
    [obraId, pedidoNovoId, etapaFundacao],
  );

  return {
    obraId,
    etapaFundacao,
    etapaDuplicadaA,
    pedidoNovoId,
    pedidoLegadoId,
    pedidoLegadoSemSaldoId,
    medicaoId,
  };
}

test("migration cria apropriação auditável, RLS e RPC somente de leitura", async () => {
  const db = await criarBancoBase();
  try {
    await aplicarMigration(db);
    const tabela = (
      await db.query(
        `SELECT relrowsecurity FROM pg_class WHERE oid='resultado_obra_apropriacoes'::regclass`,
      )
    ).rows[0];
    assert.equal(tabela.relrowsecurity, true);
    const constraints = await db.query(`
      SELECT contype FROM pg_constraint WHERE conrelid='resultado_obra_apropriacoes'::regclass
    `);
    assert.ok(constraints.rows.some((item) => item.contype === "u"));
    assert.ok(constraints.rows.filter((item) => item.contype === "f").length >= 2);
    const funcao = (
      await db.query(`
        SELECT prosecdef FROM pg_proc
        WHERE oid='public.obter_resultado_obra(uuid,date,date,text)'::regprocedure
      `)
    ).rows[0];
    assert.equal(funcao.prosecdef, false, "RPC deve ser security invoker");
    const anonExecuta = await db.query(`
      SELECT has_function_privilege('anon','public.obter_resultado_obra(uuid,date,date,text)','EXECUTE') AS permitido
    `);
    assert.equal(anonExecuta.rows[0].permitido, false);
    const authExecuta = await db.query(`
      SELECT has_function_privilege('authenticated','public.obter_resultado_obra(uuid,date,date,text)','EXECUTE') AS permitido
    `);
    assert.equal(authExecuta.rows[0].permitido, true);
  } finally {
    await db.close();
  }
});

test("leitura direta das fontes do cockpit respeita o acesso à obra", async () => {
  const db = await criarBancoBase();
  try {
    await aplicarMigration(db);
    const ids = await semearCenario(db);
    const outraObra = (await db.query("INSERT INTO obras(nome) VALUES ('Obra restrita') RETURNING id")).rows[0].id;
    const outroOrcamento = (await db.query("INSERT INTO orcamentos(obra_id) VALUES ($1) RETURNING id", [outraObra])).rows[0].id;
    await db.query("INSERT INTO orcamento_etapas(orcamento_id,codigo,nome) VALUES ($1,'1','Restrita')", [outroOrcamento]);
    await db.query("INSERT INTO pedidos_compra(obra_id,status) VALUES ($1,'aberto')", [outraObra]);
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      SELECT set_config('request.jwt.claim.role','financeiro',false);
      SELECT set_config('request.jwt.claim.obra_id','${ids.obraId}',false);
    `);
    assert.equal((await db.query("SELECT * FROM orcamentos")).rows.length, 1);
    assert.equal((await db.query("SELECT * FROM orcamento_etapas")).rows.length, 3);
    assert.equal((await db.query("SELECT * FROM pedidos_compra")).rows.length, 2);
  } finally {
    await db.close();
  }
});

test("RPC consolida etapa canônica, compras, contratos e receita sem esconder dados parciais", async () => {
  const db = await criarBancoBase();
  try {
    await aplicarMigration(db);
    const ids = await semearCenario(db);
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      SELECT set_config('request.jwt.claim.role','financeiro',false);
      SELECT set_config('request.jwt.claim.obra_id','${ids.obraId}',false);
    `);
    const linhas = (
      await db.query(
        "SELECT * FROM obter_resultado_obra($1,'2026-10-01','2026-10-31','competencia')",
        [ids.obraId],
      )
    ).rows;

    const orcamento = linhas.find((item) => item.origem === "orcamento");
    assert.equal(Number(orcamento.valor_orcado_centavos), 600);
    assert.equal(orcamento.etapa_id, ids.etapaFundacao);

    const receita = linhas.filter((item) => item.origem === "receita");
    assert.equal(receita.length, 1, "fontes de receita inferiores não devem ser somadas");
    assert.equal(Number(receita[0].valor_receita_centavos), 100000);
    assert.equal(receita[0].metadados.receita_fonte, "revisao_comercial_aceita");
    assert.equal(
      (await db.query("SELECT * FROM proposta_revisoes")).rows.length,
      1,
      "financeiro só lê a revisão comercial ligada à obra autorizada",
    );

    const pedidoNovo = linhas.find((item) => item.origem_id === ids.pedidoNovoId);
    assert.equal(Number(pedidoNovo.valor_comprometido_centavos), 1000);
    assert.equal(Number(pedidoNovo.valor_realizado_centavos), 0);
    assert.equal(pedidoNovo.legado_sem_saldo, false);
    assert.equal(pedidoNovo.etapa_id, ids.etapaFundacao, "apropriação explícita deve prevalecer");

    const pedidoLegado = linhas.find((item) => item.origem_id === ids.pedidoLegadoId);
    assert.equal(Number(pedidoLegado.valor_comprometido_centavos), 1000);
    assert.equal(pedidoLegado.legado_sem_saldo, true);
    const pedidoSemSaldo = linhas.find((item) => item.origem_id === ids.pedidoLegadoSemSaldoId);
    assert.equal(Number(pedidoSemSaldo.valor_comprometido_centavos), 500);
    assert.equal(pedidoSemSaldo.legado_sem_saldo, true);

    const contaFundacao = linhas.find(
      (item) => item.origem === "conta_pagar" && item.origem_vinculo_id === ids.pedidoLegadoId,
    );
    assert.equal(contaFundacao.etapa_id, ids.etapaFundacao, "texto único deve conciliar etapa");
    assert.equal(Number(contaFundacao.valor_realizado_centavos), 400);
    assert.equal(Number(contaFundacao.valor_pago_centavos), 300);

    const contaAmbigua = linhas.find(
      (item) => item.origem === "conta_pagar" && item.origem_vinculo_id === ids.medicaoId,
    );
    assert.equal(contaAmbigua.etapa_id, null, "nome duplicado deve permanecer sem apropriação");

    const contrato = linhas.find(
      (item) => item.origem === "contrato" && item.descricao === "Alvenaria",
    );
    assert.equal(Number(contrato.valor_comprometido_centavos), 3000);
    assert.ok(!linhas.some((item) => item.origem === "transferencia"));
  } finally {
    await db.close();
  }
});

test("regimes e período usam obrigação na competência e liquidação no caixa", async () => {
  const db = await criarBancoBase();
  try {
    await aplicarMigration(db);
    const ids = await semearCenario(db);
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      SELECT set_config('request.jwt.claim.role','financeiro',false);
      SELECT set_config('request.jwt.claim.obra_id','${ids.obraId}',false);
    `);
    const competencia = (
      await db.query(
        "SELECT * FROM obter_resultado_obra($1,'2026-10-15','2026-10-15','competencia') WHERE origem='conta_pagar' AND origem_vinculo_id=$2",
        [ids.obraId, ids.pedidoLegadoId],
      )
    ).rows[0];
    assert.equal(Number(competencia.valor_realizado_centavos), 400);
    assert.equal(Number(competencia.valor_pago_centavos), 0);
    assert.equal(competencia.data_referencia.toISOString().slice(0, 10), "2026-10-15");

    const caixa = (
      await db.query(
        "SELECT * FROM obter_resultado_obra($1,'2026-10-20','2026-10-20','caixa') WHERE origem='conta_pagar' AND origem_vinculo_id=$2",
        [ids.obraId, ids.pedidoLegadoId],
      )
    ).rows[0];
    assert.equal(Number(caixa.valor_realizado_centavos), 300);
    assert.equal(Number(caixa.valor_pago_centavos), 300);
    const apoioFisico = await db.query(
      "SELECT * FROM obter_resultado_obra($1,'2026-10-20','2026-10-20','caixa') WHERE origem IN ('pedido','contrato')",
      [ids.obraId],
    );
    assert.ok(apoioFisico.rows.every((item) => Number(item.valor_realizado_centavos) === 0));
    assert.equal(caixa.data_referencia.toISOString().slice(0, 10), "2026-10-20");
  } finally {
    await db.close();
  }
});

test("RPC nega engenharia, cliente e financeiro sem acesso à obra", async () => {
  const db = await criarBancoBase();
  try {
    await aplicarMigration(db);
    const ids = await semearCenario(db);
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      SELECT set_config('request.jwt.claim.obra_id','${ids.obraId}',false);
    `);
    for (const papel of ["engenharia", "cliente"]) {
      await db.exec(`SELECT set_config('request.jwt.claim.role','${papel}',false)`);
      const linhas = await db.query(
        "SELECT * FROM obter_resultado_obra($1,null,null,'competencia')",
        [ids.obraId],
      );
      assert.equal(linhas.rows.length, 0, `${papel} não pode ler o cockpit financeiro`);
    }
    await db.exec(`
      SELECT set_config('request.jwt.claim.role','financeiro',false);
      SELECT set_config('request.jwt.claim.obra_id','00000000-0000-0000-0000-000000000099',false);
    `);
    const semAcesso = await db.query(
      "SELECT * FROM obter_resultado_obra($1,null,null,'competencia')",
      [ids.obraId],
    );
    assert.equal(semAcesso.rows.length, 0);
  } finally {
    await db.close();
  }
});

test("rollback remove somente o cockpit e permite reaplicar a migration", async () => {
  const db = await criarBancoBase();
  try {
    const migration = await read("supabase/migrations/20261102000000_resultado_obra_cockpit.sql");
    const rollback = await read("supabase/rollbacks/20261102000000_resultado_obra_cockpit.sql");
    await db.exec(migration);
    await db.exec(rollback);
    assert.equal(
      (await db.query("SELECT to_regclass('public.resultado_obra_apropriacoes') AS tabela")).rows[0]
        .tabela,
      null,
    );
    assert.equal(
      (await db.query("SELECT to_regclass('public.obras') AS tabela")).rows[0].tabela,
      "obras",
    );
    await db.exec(migration);
    assert.equal(
      (await db.query("SELECT to_regclass('public.resultado_obra_apropriacoes') AS tabela")).rows[0]
        .tabela,
      "resultado_obra_apropriacoes",
    );
  } finally {
    await db.close();
  }
});
