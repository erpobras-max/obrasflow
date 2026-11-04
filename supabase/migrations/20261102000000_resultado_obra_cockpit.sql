-- Cockpit de resultado por obra: apropriações explícitas e consulta consolidada somente leitura.

CREATE TABLE IF NOT EXISTS public.resultado_obra_apropriacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  origem_tipo text NOT NULL CHECK (
    origem_tipo IN (
      'pedido_compra', 'cotacao_pedido', 'contrato_empreiteiro',
      'medicao_empreiteiro', 'conta_pagar', 'conta_receber'
    )
  ),
  origem_id uuid NOT NULL,
  orcamento_etapa_id uuid NOT NULL REFERENCES public.orcamento_etapas(id) ON DELETE RESTRICT,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resultado_obra_apropriacoes_origem_unica UNIQUE (origem_tipo, origem_id)
);

CREATE INDEX IF NOT EXISTS resultado_obra_apropriacoes_obra_idx
  ON public.resultado_obra_apropriacoes (obra_id, orcamento_etapa_id);

ALTER TABLE public.resultado_obra_apropriacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resultado_obra_apropriacoes_select ON public.resultado_obra_apropriacoes;
CREATE POLICY resultado_obra_apropriacoes_select
  ON public.resultado_obra_apropriacoes
  FOR SELECT TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'financeiro_civil')
    )
    AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = obra_id)
  );

DROP POLICY IF EXISTS resultado_obra_apropriacoes_insert ON public.resultado_obra_apropriacoes;
CREATE POLICY resultado_obra_apropriacoes_insert
  ON public.resultado_obra_apropriacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'financeiro_civil')
    )
    AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = obra_id)
  );

DROP POLICY IF EXISTS resultado_obra_apropriacoes_update ON public.resultado_obra_apropriacoes;
CREATE POLICY resultado_obra_apropriacoes_update
  ON public.resultado_obra_apropriacoes
  FOR UPDATE TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'financeiro_civil')
    )
    AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = obra_id)
  )
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'financeiro_civil')
    )
    AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = obra_id)
  );

DROP POLICY IF EXISTS resultado_obra_apropriacoes_delete ON public.resultado_obra_apropriacoes;
CREATE POLICY resultado_obra_apropriacoes_delete
  ON public.resultado_obra_apropriacoes
  FOR DELETE TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'financeiro_civil')
    )
    AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = obra_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resultado_obra_apropriacoes TO authenticated;

-- A RPC é security invoker. Estas policies dão aos papéis financeiros somente
-- leitura das fontes que o cockpit precisa, sem ampliar escrita ou acesso a clientes.
DROP POLICY IF EXISTS resultado_obra_leitura ON public.orcamentos;
CREATE POLICY resultado_obra_leitura ON public.orcamentos FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = orcamentos.obra_id));
DROP POLICY IF EXISTS resultado_obra_leitura ON public.orcamento_etapas;
CREATE POLICY resultado_obra_leitura ON public.orcamento_etapas FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.orcamentos orc JOIN public.obras obra ON obra.id = orc.obra_id WHERE orc.id = orcamento_etapas.orcamento_id));
DROP POLICY IF EXISTS resultado_obra_leitura ON public.orcamento_atividades;
CREATE POLICY resultado_obra_leitura ON public.orcamento_atividades FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.orcamento_etapas etapa JOIN public.orcamentos orc ON orc.id = etapa.orcamento_id JOIN public.obras obra ON obra.id = orc.obra_id WHERE etapa.id = orcamento_atividades.etapa_id));
DROP POLICY IF EXISTS resultado_obra_leitura ON public.orcamento_atividade_insumos;
CREATE POLICY resultado_obra_leitura ON public.orcamento_atividade_insumos FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.orcamento_atividades atividade JOIN public.orcamento_etapas etapa ON etapa.id = atividade.etapa_id JOIN public.orcamentos orc ON orc.id = etapa.orcamento_id JOIN public.obras obra ON obra.id = orc.obra_id WHERE atividade.id = orcamento_atividade_insumos.atividade_id));
DROP POLICY IF EXISTS resultado_obra_leitura ON public.pedidos_compra;
CREATE POLICY resultado_obra_leitura ON public.pedidos_compra FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = pedidos_compra.obra_id));
DROP POLICY IF EXISTS resultado_obra_leitura ON public.pedido_itens;
CREATE POLICY resultado_obra_leitura ON public.pedido_itens FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')) AND EXISTS (SELECT 1 FROM public.pedidos_compra pedido JOIN public.obras obra ON obra.id = pedido.obra_id WHERE pedido.id = pedido_itens.pedido_id));

GRANT SELECT ON public.orcamentos, public.orcamento_etapas, public.orcamento_atividades,
  public.orcamento_atividade_insumos, public.pedidos_compra, public.pedido_itens TO authenticated;

DROP POLICY IF EXISTS resultado_obra_revisao_comercial_leitura ON public.proposta_revisoes;
CREATE POLICY resultado_obra_revisao_comercial_leitura ON public.proposta_revisoes FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil'))
    AND EXISTS (
      SELECT 1 FROM public.propostas proposta
      JOIN public.obras obra ON obra.proposta_id = proposta.id
      WHERE proposta.id = proposta_revisoes.proposta_id
    )
  );
GRANT SELECT ON public.proposta_revisoes TO authenticated;

CREATE OR REPLACE FUNCTION public.obter_resultado_obra(
  p_obra_id uuid,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_regime text DEFAULT 'competencia'
)
RETURNS TABLE (
  obra_id uuid,
  obra_nome text,
  etapa_id uuid,
  etapa_nome text,
  origem text,
  origem_id uuid,
  origem_vinculo_id uuid,
  descricao text,
  data_referencia date,
  data_vencimento date,
  valor_em_aberto_centavos bigint,
  valor_orcado_centavos bigint,
  valor_receita_centavos bigint,
  valor_comprometido_centavos bigint,
  valor_realizado_centavos bigint,
  valor_pago_centavos bigint,
  avanco_fisico_percentual numeric,
  legado_sem_saldo boolean,
  competencia_fallback boolean,
  origem_url text,
  metadados jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_regime NOT IN ('caixa', 'competencia') THEN
    RAISE EXCEPTION 'Regime inválido';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'financeiro_civil')
  ) THEN
    RETURN;
  END IF;

  -- A consulta de obras abaixo permanece sujeita à RLS porque a função é security invoker.
  IF NOT EXISTS (SELECT 1 FROM public.obras obra WHERE obra.id = p_obra_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH orcamento_atual AS (
    SELECT orc.id
      FROM public.orcamentos orc
     WHERE orc.obra_id = p_obra_id
       AND orc.analitico_ativo
     ORDER BY orc.id DESC
     LIMIT 1
  ),
  etapas AS (
    SELECT etapa.id, etapa.nome, etapa.ordem, etapa.orcamento_id,
           count(*) OVER (PARTITION BY lower(btrim(etapa.nome))) AS nomes_iguais
      FROM public.orcamento_etapas etapa
      JOIN orcamento_atual atual ON atual.id = etapa.orcamento_id
  ),
  orcamento AS (
    SELECT etapa.id AS etapa_id,
           etapa.nome AS etapa_nome,
           COALESCE(sum(round(atividade.quantidade * insumo.coeficiente * insumo.preco_unitario_centavos)), 0)::bigint AS valor
      FROM etapas etapa
      JOIN public.orcamento_atividades atividade ON atividade.etapa_id = etapa.id
      JOIN public.orcamento_atividade_insumos insumo ON insumo.atividade_id = atividade.id
     GROUP BY etapa.id, etapa.nome, etapa.ordem
  ),
  receita_candidatas AS (
    SELECT 1 AS prioridade,
           COALESCE(revisao.id, proposta.id) AS origem_id,
           'Revisão comercial aceita'::text AS descricao,
           COALESCE(NULLIF(revisao.fotografia->>'totalPrecoCentavos', '')::bigint, round(proposta.valor_total * 100)::bigint) AS valor,
           CASE WHEN revisao.id IS NULL THEN 'proposta_aceita_legada' ELSE 'revisao_comercial_aceita' END::text AS fonte
      FROM public.obras obra
      JOIN public.propostas proposta ON proposta.id = obra.proposta_id
      LEFT JOIN LATERAL (
        SELECT pr.id, pr.fotografia
          FROM public.proposta_revisoes pr
         WHERE pr.proposta_id = proposta.id
           AND pr.status = 'aceita'
         ORDER BY pr.id DESC
         LIMIT 1
      ) revisao ON true
     WHERE obra.id = p_obra_id
       AND (proposta.status = 'aceita' OR revisao.id IS NOT NULL)
     ORDER BY revisao.id DESC NULLS LAST, proposta.id DESC
     LIMIT 1
  ),
  receita_contrato AS (
    SELECT 2 AS prioridade,
           contrato.id AS origem_id,
           'Contrato comercial ativo'::text AS descricao,
           round(contrato.valor_total * 100)::bigint AS valor,
           'contrato_comercial'::text AS fonte
      FROM public.obras obra
      JOIN public.contratos contrato ON contrato.id = obra.contrato_id
     WHERE obra.id = p_obra_id
       AND contrato.status = 'ativo'
     LIMIT 1
  ),
  receita_obra AS (
    SELECT 3 AS prioridade,
           obra.id AS origem_id,
           'Valor contratual da obra'::text AS descricao,
           round(obra.orcamento * 100)::bigint AS valor,
           'valor_obra'::text AS fonte
      FROM public.obras obra
     WHERE obra.id = p_obra_id
       AND obra.orcamento > 0
  ),
  receita_contas AS (
    SELECT 4 AS prioridade,
           (array_agg(conta.id ORDER BY conta.id))[1] AS origem_id,
           'Contas a receber da obra'::text AS descricao,
           sum(conta.valor_total + COALESCE(conta.valor_aditivo, 0))::bigint AS valor,
           'contas_receber'::text AS fonte
      FROM public.contas_receber conta
     WHERE conta.obra_id = p_obra_id
       AND conta.status <> 'cancelada'
    HAVING count(*) > 0
  ),
  receita AS (
    SELECT * FROM (
      SELECT * FROM receita_candidatas
      UNION ALL SELECT * FROM receita_contrato
      UNION ALL SELECT * FROM receita_obra
      UNION ALL SELECT * FROM receita_contas
    ) candidatas
    ORDER BY prioridade
    LIMIT 1
  ),
  contas_pedido_legado AS (
    SELECT conta.pedido_id,
           sum(conta.valor_total)::bigint AS realizado,
           sum(COALESCE(conta.valor_pago, 0))::bigint AS pago
      FROM public.contas_pagar conta
     WHERE conta.obra_id = p_obra_id
       AND conta.pedido_id IS NOT NULL
       AND conta.status <> 'cancelada'
     GROUP BY conta.pedido_id
  ),
  contas_vinculadas AS (
    SELECT COALESCE(conta.cotacao_pedido_id, conta.medicao_empreiteiro_id) AS vinculo_id,
           sum(conta.valor_total)::bigint AS valor_obrigacao
      FROM public.contas_pagar conta
     WHERE conta.obra_id = p_obra_id
       AND conta.status <> 'cancelada'
       AND (conta.cotacao_pedido_id IS NOT NULL OR conta.medicao_empreiteiro_id IS NOT NULL)
     GROUP BY COALESCE(conta.cotacao_pedido_id, conta.medicao_empreiteiro_id)
  ),
  pedidos_legados AS (
    SELECT pedido.id,
           COALESCE(NULLIF(sum(item.quantidade * item.valor_unit), 0), pedido.valor_total)::bigint AS total,
           true AS legado_sem_saldo,
           pedido.created_at::date AS data_referencia,
           apropriacao.orcamento_etapa_id AS etapa_id
      FROM public.pedidos_compra pedido
      LEFT JOIN public.pedido_itens item ON item.pedido_id = pedido.id
      LEFT JOIN contas_pedido_legado conta ON conta.pedido_id = pedido.id
      LEFT JOIN public.resultado_obra_apropriacoes apropriacao
        ON apropriacao.origem_tipo = 'pedido_compra' AND apropriacao.origem_id = pedido.id
     WHERE pedido.obra_id = p_obra_id
       AND pedido.status <> 'cancelado'
      GROUP BY pedido.id, pedido.valor_total, pedido.created_at, conta.realizado,
              conta.pedido_id, apropriacao.orcamento_etapa_id
  ),
  pedidos_novos AS (
    SELECT pedido.id,
           greatest(sum(item.quantidade * item.valor_unitario) - COALESCE(vinculo.valor_obrigacao, 0), 0)::bigint AS comprometido,
           pedido.created_at::date AS data_referencia,
           apropriacao.orcamento_etapa_id AS etapa_id
      FROM public.cotacoes_pedidos pedido
      JOIN public.cotacoes_pedidos_itens item ON item.pedido_id = pedido.id
      LEFT JOIN public.resultado_obra_apropriacoes apropriacao
        ON apropriacao.origem_tipo = 'cotacao_pedido' AND apropriacao.origem_id = pedido.id
      LEFT JOIN contas_vinculadas vinculo ON vinculo.vinculo_id = pedido.id
     WHERE pedido.obra_id = p_obra_id
       AND pedido.status <> 'cancelado'
     GROUP BY pedido.id, pedido.created_at, apropriacao.orcamento_etapa_id, vinculo.valor_obrigacao
  ),
  medicoes_contrato AS (
    SELECT medicao.id, medicao.contrato_empreiteiro_id,
           medicao.valor_bruto_centavos,
           COALESCE(medicao.periodo_fim, medicao.created_at::date) AS data_referencia,
           COALESCE(vinculo.valor_obrigacao, 0)::bigint AS valor_obrigacao,
           apropriacao.orcamento_etapa_id AS etapa_id
      FROM public.medicoes_empreiteiros medicao
      LEFT JOIN public.resultado_obra_apropriacoes apropriacao
        ON apropriacao.origem_tipo = 'medicao_empreiteiro' AND apropriacao.origem_id = medicao.id
      LEFT JOIN contas_vinculadas vinculo ON vinculo.vinculo_id = medicao.id
     WHERE medicao.status IN ('aprovada', 'paga')
  ),
  contratos_obra AS (
    SELECT contrato.id, contrato.objeto,
           greatest(
             contrato.valor_total_atual_centavos - COALESCE(sum(medicao.valor_obrigacao), 0),
             0
           )::bigint AS comprometido,
           apropriacao.orcamento_etapa_id AS etapa_id,
           contrato.created_at::date AS data_referencia
      FROM public.contratos_empreiteiros contrato
      LEFT JOIN medicoes_contrato medicao ON medicao.contrato_empreiteiro_id = contrato.id
      LEFT JOIN public.resultado_obra_apropriacoes apropriacao
        ON apropriacao.origem_tipo = 'contrato_empreiteiro' AND apropriacao.origem_id = contrato.id
     WHERE contrato.obra_id = p_obra_id
       AND contrato.status IN ('ativo', 'concluido')
     GROUP BY contrato.id, contrato.objeto, contrato.valor_total_atual_centavos,
              apropriacao.orcamento_etapa_id, contrato.created_at
  ),
  contas AS (
    SELECT conta.id,
           conta.descricao,
           COALESCE(conta.cotacao_pedido_id, conta.pedido_id, conta.medicao_empreiteiro_id) AS vinculo_id,
           COALESCE(
             CASE WHEN etapa_direta.id IS NOT NULL THEN etapa_direta.id END,
             apropriacao.orcamento_etapa_id,
             CASE WHEN etapa_texto.nomes_iguais = 1 THEN etapa_texto.id END
           ) AS etapa_id,
           CASE
             WHEN p_regime = 'caixa' THEN conta.data_pagamento
             ELSE conta.created_at::date
           END AS data_referencia,
           conta.data_vencimento,
           greatest(conta.valor_total - COALESCE(conta.valor_pago, 0), 0)::bigint AS valor_em_aberto,
           CASE
             WHEN p_regime = 'caixa'
               AND conta.data_pagamento IS NOT NULL
               AND (p_data_inicio IS NULL OR conta.data_pagamento >= p_data_inicio)
               AND (p_data_fim IS NULL OR conta.data_pagamento <= p_data_fim)
               THEN COALESCE(conta.valor_pago, 0)
             WHEN p_regime = 'competencia'
               AND (p_data_inicio IS NULL OR conta.created_at::date >= p_data_inicio)
               AND (p_data_fim IS NULL OR conta.created_at::date <= p_data_fim)
               THEN conta.valor_total
             ELSE 0
           END::bigint AS realizado,
           CASE
             WHEN conta.data_pagamento IS NOT NULL
               AND (p_data_inicio IS NULL OR conta.data_pagamento >= p_data_inicio)
               AND (p_data_fim IS NULL OR conta.data_pagamento <= p_data_fim)
               THEN COALESCE(conta.valor_pago, 0)
             ELSE 0
           END::bigint AS pago
      FROM public.contas_pagar conta
      LEFT JOIN etapas etapa_direta ON etapa_direta.id = conta.etapa_id
      LEFT JOIN public.resultado_obra_apropriacoes apropriacao
        ON apropriacao.origem_tipo = 'conta_pagar' AND apropriacao.origem_id = conta.id
      LEFT JOIN etapas etapa_texto
        ON lower(btrim(etapa_texto.nome)) = lower(btrim(conta.etapa_nome))
     WHERE conta.obra_id = p_obra_id
       AND conta.status <> 'cancelada'
  ),
  linhas AS (
    SELECT p_obra_id, obra.nome, orcamento.etapa_id, orcamento.etapa_nome,
           'orcamento'::text, orcamento.etapa_id, NULL::uuid,
           orcamento.etapa_nome, NULL::date, NULL::date, 0::bigint,
           orcamento.valor, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
           NULL::numeric, false, false, '/orcamentos'::text,
           jsonb_build_object('fonte', 'orcamento_analitico')
      FROM orcamento
      JOIN public.obras obra ON obra.id = p_obra_id

    UNION ALL
    SELECT p_obra_id, obra.nome, NULL::uuid, NULL::text,
           'receita', receita.origem_id, NULL::uuid, receita.descricao,
           NULL::date, NULL::date, 0::bigint, 0::bigint, receita.valor,
           0::bigint, 0::bigint, 0::bigint, NULL::numeric, false, false,
           '/comercial/propostas'::text, jsonb_build_object('receita_fonte', receita.fonte)
      FROM receita
      JOIN public.obras obra ON obra.id = p_obra_id

    UNION ALL
    SELECT p_obra_id, obra.nome, pedido.etapa_id, etapa.nome,
           'pedido', pedido.id, NULL::uuid, 'Pedido de compra (cotação)',
           pedido.data_referencia, NULL::date, 0::bigint, 0::bigint, 0::bigint,
           pedido.comprometido, 0::bigint, 0::bigint, NULL::numeric,
           false, false, '/suprimentos/cotacoes'::text,
           jsonb_build_object('fluxo', 'cotacao')
      FROM pedidos_novos pedido
      JOIN public.obras obra ON obra.id = p_obra_id
      LEFT JOIN etapas etapa ON etapa.id = pedido.etapa_id

    UNION ALL
    SELECT p_obra_id, obra.nome, pedido.etapa_id, etapa.nome,
           'pedido', pedido.id, NULL::uuid, 'Pedido de compra legado',
           pedido.data_referencia, NULL::date, 0::bigint, 0::bigint, 0::bigint,
           pedido.total, 0::bigint, 0::bigint,
           NULL::numeric, pedido.legado_sem_saldo, false, '/compras/pedidos'::text,
           jsonb_build_object('fluxo', 'legado')
      FROM pedidos_legados pedido
      JOIN public.obras obra ON obra.id = p_obra_id
      LEFT JOIN etapas etapa ON etapa.id = pedido.etapa_id

    UNION ALL
    SELECT p_obra_id, obra.nome, contrato.etapa_id, etapa.nome,
           'contrato', contrato.id, NULL::uuid, contrato.objeto,
           contrato.data_referencia, NULL::date, 0::bigint, 0::bigint, 0::bigint,
           contrato.comprometido, 0::bigint, 0::bigint, NULL::numeric,
           false, false, '/contratos-empreiteiros'::text,
           jsonb_build_object('tipo', 'contrato_empreiteiro')
      FROM contratos_obra contrato
      JOIN public.obras obra ON obra.id = p_obra_id
      LEFT JOIN etapas etapa ON etapa.id = contrato.etapa_id

    UNION ALL
    SELECT p_obra_id, obra.nome, medicao.etapa_id, etapa.nome,
           'contrato', medicao.id, NULL::uuid, 'Medição de empreiteiro',
           medicao.data_referencia, NULL::date, 0::bigint, 0::bigint, 0::bigint,
           0::bigint, 0::bigint, 0::bigint, NULL::numeric,
           false, false, '/contratos-empreiteiros'::text,
           jsonb_build_object('tipo', 'medicao_empreiteiro')
      FROM medicoes_contrato medicao
      JOIN public.contratos_empreiteiros contrato ON contrato.id = medicao.contrato_empreiteiro_id
      JOIN public.obras obra ON obra.id = contrato.obra_id AND obra.id = p_obra_id
      LEFT JOIN etapas etapa ON etapa.id = medicao.etapa_id

    UNION ALL
    SELECT p_obra_id, obra.nome, conta.etapa_id, etapa.nome,
           'conta_pagar', conta.id, conta.vinculo_id, conta.descricao,
           conta.data_referencia, conta.data_vencimento, conta.valor_em_aberto,
           0::bigint, 0::bigint, 0::bigint, conta.realizado, conta.pago,
           NULL::numeric, false, (p_regime = 'competencia'), '/financeiro'::text,
           jsonb_build_object('regime', p_regime)
      FROM contas conta
      JOIN public.obras obra ON obra.id = p_obra_id
      LEFT JOIN etapas etapa ON etapa.id = conta.etapa_id

  )
  SELECT * FROM linhas;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_resultado_obra(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_resultado_obra(uuid, date, date, text) TO authenticated;

COMMENT ON FUNCTION public.obter_resultado_obra(uuid, date, date, text) IS
  'Retorna fontes normalizadas e auditáveis do cockpit financeiro por obra, respeitando RLS.';

