-- ==============================================================================
-- Script 100% Autocontido em Bloco Único PL/pgSQL
-- Não depende de tabelas temporárias (elimina erro 42P01)
-- Trata toda a cascata de Compras, Terceirizados e Orçamento Analítico
-- ==============================================================================

DO $$
DECLARE
  v_obras_ids uuid[];
  v_orcamentos_ids uuid[];
  v_cotacoes_ids uuid[];
  v_solicitacoes_ids uuid[];
  rec RECORD;
  v_total_removido integer := 0;
BEGIN
  -- 1. Coleta os IDs das 5 obras alvo em array na memória
  SELECT array_agg(id) INTO v_obras_ids
  FROM public.obras
  WHERE numero IN (
    'OBRA-2026-0005',
    'OBRA-2026-0006',
    'OBRA-2026-0007',
    'OBRA-2026-0008',
    'OBRA-2026-0009'
  );

  IF v_obras_ids IS NULL OR array_length(v_obras_ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhuma das 5 obras alvo foi encontrada (já foram excluídas).';
    RETURN;
  END IF;

  -- Coleta orçamentos vinculados
  SELECT coalesce(array_agg(id), '{}') INTO v_orcamentos_ids
  FROM public.orcamentos
  WHERE obra_id = ANY(v_obras_ids);

  -- 2. Limpeza do orçamento analítico
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_memoriais') THEN
    DELETE FROM public.orcamento_memoriais
    WHERE atividade_id IN (
      SELECT a.id FROM public.orcamento_atividades a
      JOIN public.orcamento_etapas e ON e.id = a.etapa_id
      WHERE e.orcamento_id = ANY(v_orcamentos_ids)
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_atividade_insumos') THEN
    DELETE FROM public.orcamento_atividade_insumos
    WHERE atividade_id IN (
      SELECT a.id FROM public.orcamento_atividades a
      JOIN public.orcamento_etapas e ON e.id = a.etapa_id
      WHERE e.orcamento_id = ANY(v_orcamentos_ids)
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_atividades') THEN
    DELETE FROM public.orcamento_atividades
    WHERE etapa_id IN (
      SELECT e.id FROM public.orcamento_etapas e
      WHERE e.orcamento_id = ANY(v_orcamentos_ids)
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_etapas') THEN
    DELETE FROM public.orcamento_etapas
    WHERE orcamento_id = ANY(v_orcamentos_ids);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_itens') THEN
    DELETE FROM public.orcamento_itens
    WHERE orcamento_id = ANY(v_orcamentos_ids);
  END IF;

  DELETE FROM public.orcamentos
  WHERE id = ANY(v_orcamentos_ids);

  -- 3. Limpeza do módulo de Compras (cotacoes_pedidos -> cotacoes_compra -> solicitacoes_compra)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'solicitacoes_compra') THEN
    SELECT coalesce(array_agg(id), '{}') INTO v_solicitacoes_ids
    FROM public.solicitacoes_compra
    WHERE obra_id = ANY(v_obras_ids);

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_compra') THEN
      SELECT coalesce(array_agg(id), '{}') INTO v_cotacoes_ids
      FROM public.cotacoes_compra
      WHERE obra_id = ANY(v_obras_ids) OR solicitacao_id = ANY(v_solicitacoes_ids);

      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_pedidos') THEN
        DELETE FROM public.cotacoes_pedidos
        WHERE obra_id = ANY(v_obras_ids) OR cotacao_id = ANY(v_cotacoes_ids);
      END IF;

      DELETE FROM public.cotacoes_compra
      WHERE id = ANY(v_cotacoes_ids);
    END IF;

    DELETE FROM public.solicitacoes_compra
    WHERE id = ANY(v_solicitacoes_ids);
  END IF;

  -- 4. Limpeza de medições de terceirizados
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medicoes_terceirizados') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_terceirizados') THEN
    DELETE FROM public.medicoes_terceirizados
    WHERE servico_id IN (
      SELECT id FROM public.servicos_terceirizados
      WHERE obra_id = ANY(v_obras_ids)
    );
  END IF;

  -- 5. Demais tabelas que possuem a coluna obra_id
  FOR rec IN (
    SELECT c.table_name, c.is_nullable
    FROM information_schema.columns c
    JOIN information_schema.tables t 
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'obra_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name NOT IN ('obras', 'orcamentos', 'solicitacoes_compra', 'cotacoes_compra', 'cotacoes_pedidos')
  ) LOOP
    IF rec.table_name IN (
      'obra_projetos_cad', 'obra_cronograma', 'obras_cronogramas', 'obras_equipe', 
      'obra_funcionarios', 'diarios_obra', 'diario_obras', 'ordens_servico', 
      'medicoes', 'servicos_terceirizados', 'documentos', 'estoque_obra'
    ) THEN
      EXECUTE format('DELETE FROM public.%I WHERE obra_id = ANY($1)', rec.table_name) USING v_obras_ids;
    ELSIF rec.is_nullable = 'YES' THEN
      EXECUTE format('UPDATE public.%I SET obra_id = NULL WHERE obra_id = ANY($1)', rec.table_name) USING v_obras_ids;
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE obra_id = ANY($1)', rec.table_name) USING v_obras_ids;
    END IF;
  END LOOP;

  -- 6. Exclusão definitiva das obras alvo
  DELETE FROM public.obras
  WHERE id = ANY(v_obras_ids);

  GET DIAGNOSTICS v_total_removido = ROW_COUNT;
  RAISE NOTICE 'Sucesso! Foram excluídas % obras e todos os seus vínculos limpos.', v_total_removido;
END $$;

-- 7. Conferência final: deve retornar 0
SELECT 
  COUNT(*) AS total_obras_restantes_com_esses_numeros
FROM public.obras
WHERE numero IN (
  'OBRA-2026-0005',
  'OBRA-2026-0006',
  'OBRA-2026-0007',
  'OBRA-2026-0008',
  'OBRA-2026-0009'
);
