-- ==============================================================================
-- Script Transacional Seguro para Exclusão das 5 Obras Antigas de Teste
-- Obras-alvo:
--   - OBRA-2026-0005: Tica - Rural Net
--   - OBRA-2026-0006: Obra Lucas - Obra 1
--   - OBRA-2026-0007: CASA 13
--   - OBRA-2026-0008: Flatiron Building
--   - OBRA-2026-0009: Obra Caio Henrique / Kennedy
-- ==============================================================================

BEGIN;

-- 1. Criação de tabela temporária com IDs e dados das obras para backup
CREATE TEMP TABLE temp_obras_alvo ON COMMIT DROP AS
SELECT * FROM public.obras
WHERE numero IN (
  'OBRA-2026-0005',
  'OBRA-2026-0006',
  'OBRA-2026-0007',
  'OBRA-2026-0008',
  'OBRA-2026-0009'
);

-- Tabela de orçamentos vinculados
CREATE TEMP TABLE temp_orcamentos_alvo ON COMMIT DROP AS
SELECT id, obra_id FROM public.orcamentos
WHERE obra_id IN (SELECT id FROM temp_obras_alvo);

-- 2. Limpeza das tabelas filhas do novo orçamento analítico (Issue #197 / #199)
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

-- 3. Limpeza ou desvinculação segura de tabelas operacionais
DO $$
BEGIN
  -- Projetos 3D / CAD
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obra_projetos_cad') THEN
    DELETE FROM public.obra_projetos_cad WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Ordens de serviço
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ordens_servico') THEN
    DELETE FROM public.ordens_servico WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Diário de obras
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diarios_obra') THEN
    DELETE FROM public.diarios_obra WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diario_obras') THEN
    DELETE FROM public.diario_obras WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Medições e serviços terceirizados
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medicoes_terceirizados') THEN
    DELETE FROM public.medicoes_terceirizados WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'servicos_terceirizados') THEN
    DELETE FROM public.servicos_terceirizados WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medicoes') THEN
    DELETE FROM public.medicoes WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Cronogramas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obra_cronograma') THEN
    DELETE FROM public.obra_cronograma WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obras_cronogramas') THEN
    DELETE FROM public.obras_cronogramas WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Equipe / Funcionários da obra
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obras_equipe') THEN
    DELETE FROM public.obras_equipe WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'obra_funcionarios') THEN
    DELETE FROM public.obra_funcionarios WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Estoque da obra
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estoque_obra') THEN
    DELETE FROM public.estoque_obra WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'movimentacoes_estoque') THEN
    UPDATE public.movimentacoes_estoque SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Cotações e pedidos de compra
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_pedidos') THEN
    UPDATE public.cotacoes_pedidos SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cotacoes_compra') THEN
    UPDATE public.cotacoes_compra SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'solicitacoes_compra') THEN
    UPDATE public.solicitacoes_compra SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Financeiro (desvincular obra para manter histórico contábil sem órfãos)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_pagar') THEN
    UPDATE public.contas_pagar SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contas_receber') THEN
    UPDATE public.contas_receber SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lancamentos_financeiros') THEN
    UPDATE public.lancamentos_financeiros SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Contratos e propostas (desvincular para não quebrar cadastros comerciais)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contratos') THEN
    UPDATE public.contratos SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'propostas') THEN
    UPDATE public.propostas SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Documentos
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documentos') THEN
    DELETE FROM public.documentos WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;

  -- Entidades gerais que possuam obra_id opcional
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipamentos') THEN
    UPDATE public.equipamentos SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'funcionarios') THEN
    UPDATE public.funcionarios SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fornecedores') THEN
    UPDATE public.fornecedores SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'depositos') THEN
    UPDATE public.depositos SET obra_id = NULL WHERE obra_id IN (SELECT id FROM temp_obras_alvo);
  END IF;
END $$;

-- 4. Exclusão final das 5 obras alvo
DELETE FROM public.obras
WHERE id IN (SELECT id FROM temp_obras_alvo);

-- 5. Conferência de integridade
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

-- Confirmação da transação
COMMIT;
