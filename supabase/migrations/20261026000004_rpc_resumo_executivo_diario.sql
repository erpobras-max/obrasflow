-- ============================================================================
-- RPC: obter_resumo_executivo_diario
-- Agrega métricas matinais para boletim executivo do dono/gestores:
-- 1. Ordens de Serviço (vencendo hoje, atrasadas e críticas)
-- 2. Financeiro do dia (contas a pagar e receber que vencem na data)
-- 3. Operacional (obras ativas e presença de funcionários no ponto)
-- 4. Alertas de estoque crítico
-- 5. Destinatários gestores (admin e diretor)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.obter_resumo_executivo_diario(p_data DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_nome TEXT;
  v_os_vencendo_hoje INT := 0;
  v_os_atrasadas INT := 0;
  v_os_em_andamento INT := 0;
  v_os_criticas JSONB := '[]'::jsonb;
  
  v_pagar_total NUMERIC(14,2) := 0;
  v_pagar_qtd INT := 0;
  v_receber_total NUMERIC(14,2) := 0;
  v_receber_qtd INT := 0;
  v_saldo_dia NUMERIC(14,2) := 0;
  v_contas_criticas JSONB := '[]'::jsonb;
  
  v_obras_ativas INT := 0;
  v_pontos_hoje INT := 0;
  v_estoque_critico INT := 0;
  v_destinatarios JSONB := '[]'::jsonb;
  
  v_resultado JSONB;
BEGIN
  -- 1. Nome da Empresa
  SELECT COALESCE(razao_social, 'ObrasFlow ERP')
  INTO v_empresa_nome
  FROM public.configuracoes_empresa
  LIMIT 1;

  IF v_empresa_nome IS NULL THEN
    v_empresa_nome := 'ObrasFlow ERP';
  END IF;

  -- 2. Estatísticas de Ordens de Serviço
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordens_servico') THEN
    SELECT
      COUNT(id) FILTER (WHERE data_previsao = p_data AND status NOT IN ('concluida', 'cancelada')),
      COUNT(id) FILTER (WHERE data_previsao < p_data AND status NOT IN ('concluida', 'cancelada')),
      COUNT(id) FILTER (WHERE status IN ('aberta', 'em_andamento'))
    INTO
      v_os_vencendo_hoje,
      v_os_atrasadas,
      v_os_em_andamento
    FROM public.ordens_servico;

    -- Top 5 OS críticas (atrasadas ou vencendo hoje)
    SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_os_criticas
    FROM (
      SELECT
        os.numero,
        os.titulo,
        os.prioridade,
        os.data_previsao::text,
        os.responsavel_nome,
        ob.nome AS obra_nome,
        CASE
          WHEN os.data_previsao < p_data THEN 'atrasada'
          WHEN os.data_previsao = p_data THEN 'vence_hoje'
          ELSE 'em_breve'
        END AS status_prazo
      FROM public.ordens_servico os
      LEFT JOIN public.obras ob ON ob.id = os.obra_id
      WHERE os.status NOT IN ('concluida', 'cancelada')
        AND os.data_previsao <= p_data
      ORDER BY os.data_previsao ASC, (os.prioridade = 'urgente') DESC
      LIMIT 5
    ) item;
  END IF;

  -- 3. Financeiro do Dia (Contas a Pagar e Receber)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_pagar') THEN
    SELECT
      COALESCE(SUM(valor_total - COALESCE(valor_pago, 0)), 0),
      COUNT(id)
    INTO
      v_pagar_total,
      v_pagar_qtd
    FROM public.contas_pagar
    WHERE data_vencimento = p_data
      AND status NOT IN ('paga', 'cancelada');
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_receber') THEN
    SELECT
      COALESCE(SUM(valor_total - COALESCE(valor_recebido, 0)), 0),
      COUNT(id)
    INTO
      v_receber_total,
      v_receber_qtd
    FROM public.contas_receber
    WHERE data_vencimento = p_data
      AND status NOT IN ('recebida', 'cancelada');
  END IF;

  v_saldo_dia := v_receber_total - v_pagar_total;

  -- Lista das principais contas a vencer hoje
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_pagar') THEN
    SELECT COALESCE(jsonb_agg(c), '[]'::jsonb)
    INTO v_contas_criticas
    FROM (
      (
        SELECT
          cp.id::text,
          cp.descricao,
          cp.valor_total::numeric AS valor,
          'pagar' AS tipo,
          ob.nome AS obra_nome
        FROM public.contas_pagar cp
        LEFT JOIN public.obras ob ON ob.id = cp.obra_id
        WHERE cp.data_vencimento = p_data
          AND cp.status NOT IN ('paga', 'cancelada')
        LIMIT 4
      )
      UNION ALL
      (
        SELECT
          cr.id::text,
          cr.descricao,
          cr.valor_total::numeric AS valor,
          'receber' AS tipo,
          ob.nome AS obra_nome
        FROM public.contas_receber cr
        LEFT JOIN public.obras ob ON ob.id = cr.obra_id
        WHERE cr.data_vencimento = p_data
          AND cr.status NOT IN ('recebida', 'cancelada')
        LIMIT 4
      )
    ) c;
  END IF;

  -- 4. Obras Ativas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obras') THEN
    SELECT COUNT(id)
    INTO v_obras_ativas
    FROM public.obras
    WHERE status NOT IN ('concluida', 'cancelada');
  END IF;

  -- 5. Presença no Ponto Eletrônico Hoje
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registros_ponto') THEN
    SELECT COUNT(id)
    INTO v_pontos_hoje
    FROM public.registros_ponto
    WHERE data = p_data;
  END IF;

  -- 6. Estoque Crítico
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estoque_obra') THEN
    SELECT COUNT(id)
    INTO v_estoque_critico
    FROM public.estoque_obra
    WHERE saldo < 0;
  END IF;

  -- 7. Destinatários (Admins e Diretores)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'perfis_usuarios') THEN
    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
    INTO v_destinatarios
    FROM (
      SELECT DISTINCT nome, email, perfil::text
      FROM public.perfis_usuarios
      WHERE perfil IN ('admin', 'diretor')
        AND email IS NOT NULL
        AND email <> ''
      ORDER BY email
    ) d;
  END IF;

  -- Montagem final do JSON
  v_resultado := jsonb_build_object(
    'empresa_nome', v_empresa_nome,
    'data_referencia', p_data::text,
    'data_formatada', to_char(p_data, 'DD/MM/YYYY'),
    'os_stats', jsonb_build_object(
      'vencendo_hoje', COALESCE(v_os_vencendo_hoje, 0),
      'atrasadas', COALESCE(v_os_atrasadas, 0),
      'em_andamento', COALESCE(v_os_em_andamento, 0),
      'criticas', v_os_criticas
    ),
    'financeiro_stats', jsonb_build_object(
      'pagar_hoje_total', COALESCE(v_pagar_total, 0),
      'pagar_hoje_qtd', COALESCE(v_pagar_qtd, 0),
      'receber_hoje_total', COALESCE(v_receber_total, 0),
      'receber_hoje_qtd', COALESCE(v_receber_qtd, 0),
      'saldo_projetado_dia', COALESCE(v_saldo_dia, 0),
      'contas_criticas', v_contas_criticas
    ),
    'operacional_stats', jsonb_build_object(
      'obras_ativas_qtd', COALESCE(v_obras_ativas, 0),
      'pontos_registrados_hoje', COALESCE(v_pontos_hoje, 0)
    ),
    'estoque_stats', jsonb_build_object(
      'itens_criticos_qtd', COALESCE(v_estoque_critico, 0)
    ),
    'destinatarios', v_destinatarios
  );

  RETURN v_resultado;
END;
$$;

-- Permissões de execução para qualquer cliente autenticado ou anon da API cron
GRANT EXECUTE ON FUNCTION public.obter_resumo_executivo_diario(DATE) TO anon, authenticated, service_role;
