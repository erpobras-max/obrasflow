-- ==============================================================================
-- Script 100% Dinâmico e Seguro para Exclusão das 5 Obras Antigas de Teste
-- Resolve dependências de Compras (cotações/solicitações) e Orçamento Analítico
-- ==============================================================================

BEGIN;

-- 1. Identifica e isola as 5 obras alvo
CREATE TEMP TABLE temp_obras_alvo ON COMMIT DROP AS
SELECT id, numero, nome FROM public.obras
WHERE numero IN (
  'OBRA-2026-0005',
  'OBRA-2026-0006',
  'OBRA-2026-0007',
  'OBRA-2026-0008',
  'OBRA-2026-0009'
);

-- Tabela temporária de orçamentos vinculados
CREATE TEMP TABLE temp_orcamentos_alvo ON COMMIT DROP AS
SELECT id, obra_id FROM public.orcamentos
WHERE obra_id IN (SELECT id FROM temp_obras_alvo);

-- 2. Limpeza bottom-up das tabelas filhas do novo orçamento analítico
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_memoriais') THEN
    DELETE FROM public.orcamento_memoriais
    WHERE atividade_id IN (
      SELECT a.id FROM public.orcamento_atividades a
      JOIN public.orcamento_etapas e ON e.id = a.etapa_id
      JOIN temp_orcamentos_alvo o ON o.id = e.orcamento_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_atividade_insumos') THEN
    DELETE FROM public.orcamento_atividade_insumos
    WHERE atividade_id IN (
      SELECT a.id FROM public.orcamento_atividades a
      JOIN public.orcamento_etapas e ON e.id = a.etapa_id
      JOIN temp_orcamentos_alvo o ON o.id = e.orcamento_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_atividades') THEN
    DELETE FROM public.orcamento_atividades
    WHERE etapa_id IN (
      SELECT e.id FROM public.orcamento_etapas e
      JOIN temp_orcamentos_alvo o ON o.id = e.orcamento_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_etapas') THEN
    DELETE FROM public.orcamento_etapas
    WHERE orcamento_id IN (SELECT id FROM temp_orcamentos_alvo);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orcamento_itens') THEN
    DELETE FROM public.orcamento_itens
    WHERE orcamento_id IN (SELECT id FROM temp_orcamentos_alvo);
  END IF;

  DELETE FROM public.orcamentos
  WHERE id IN (SELECT id FROM temp_orcamentos_alvo);
END $$;

-- 3. Limpeza das tabelas de Compras (cotacoes_pedidos -> cotacoes_compra -> solicitacoes_compra)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_pedidos') THEN
    DELETE FROM public.cotacoes_pedidos 
    WHERE obra_id IN (SELECT id FROM temp_obras_alvo)
       OR cotacao_id IN (
         SELECT c.id FROM public.cotacoes_compra c
         WHERE c.obra_id IN (SELECT id FROM temp_obras_alvo) 
            OR c.solicitacao_id IN (SELECT s.id FROM public.solicitacoes_compra s WHERE s.obra_id IN (SELECT id FROM temp_obras_alvo))
       );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_compra') THEN
    DELETE FROM public.cotacoes_compra
    WHERE obra_id IN (SELECT id FROM temp_obras_alvo)
       OR solicitacao_id IN (SELECT s.id FROM public.solicitacoes_compra s WHERE s.obra_id IN (SELECT id FROM temp_obras_alvo));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'solicitacoes_compra') THEN
    DELETE FROM public.solicitacoes_compra
    WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
END $$;

-- 4. Limpeza de medições de terceirizados (filhas de servicos_terceirizados)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medicoes_terceirizados') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_terceirizados') THEN
    DELETE FROM public.medicoes_terceirizados
    WHERE servico_id IN (
      SELECT id FROM public.servicos_terceirizados
      WHERE obra_id IN (SELECT id FROM temp_obras_alvo)
    );
  END IF;
END $$;

-- 5. Tratamento dinâmico das demais tabelas públicas que contêm a coluna 'obra_id'
DO $$
DECLARE
  rec RECORD;
BEGIN
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
      EXECUTE format('DELETE FROM public.%I WHERE obra_id IN (SELECT id FROM temp_obras_alvo)', rec.table_name);
    ELSIF rec.is_nullable = 'YES' THEN
      EXECUTE format('UPDATE public.%I SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo)', rec.table_name);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE obra_id IN (SELECT id FROM temp_obras_alvo)', rec.table_name);
    END IF;
  END LOOP;
END $$;

-- 6. Exclusão definitiva das 5 obras alvo
DELETE FROM public.obras
WHERE id IN (SELECT id FROM temp_obras_alvo);

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

COMMIT;
