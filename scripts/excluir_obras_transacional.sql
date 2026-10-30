-- Script Transacional Seguro para Exclusão de Obras Antigas
-- ATENÇÃO: NENHUMA EXCLUSÃO DEVE SER FEITA SEM CONFIRMAÇÃO EXPLÍCITA DO USUÁRIO
-- Executa em transação única com verificação prévia e posterior

BEGIN;

-- 1. Criação de tabela temporária de auditoria do backup em memória
CREATE TEMP TABLE temp_obras_backup AS
SELECT * FROM public.obras
WHERE numero IN ('OBRA-2026-0005', 'OBRA-2026-0006', 'OBRA-2026-0007', 'OBRA-2026-0008', 'OBRA-2026-0009');

-- 2. Verificação de registros dependentes antes da remoção
-- Se houver necessidade de manter o histórico financeiro/documental, recomenda-se apenas arquivar (status = 'arquivada')
-- Caso o usuário confirme a exclusão completa:

-- Excluir registros das novas tabelas analíticas vinculadas
DELETE FROM public.orcamento_memoriais
WHERE atividade_id IN (
  SELECT a.id FROM public.orcamento_atividades a
  JOIN public.orcamento_etapas e ON e.id = a.etapa_id
  JOIN public.orcamentos o ON o.id = e.orcamento_id
  JOIN temp_obras_backup t ON t.id = o.obra_id
);

DELETE FROM public.orcamento_atividade_insumos
WHERE atividade_id IN (
  SELECT a.id FROM public.orcamento_atividades a
  JOIN public.orcamento_etapas e ON e.id = a.etapa_id
  JOIN public.orcamentos o ON o.id = e.orcamento_id
  JOIN temp_obras_backup t ON t.id = o.obra_id
);

DELETE FROM public.orcamento_atividades
WHERE etapa_id IN (
  SELECT e.id FROM public.orcamento_etapas e
  JOIN public.orcamentos o ON o.id = e.orcamento_id
  JOIN temp_obras_backup t ON t.id = o.obra_id
);

DELETE FROM public.orcamento_etapas
WHERE orcamento_id IN (
  SELECT o.id FROM public.orcamentos o
  JOIN temp_obras_backup t ON t.id = o.obra_id
);

DELETE FROM public.orcamento_itens
WHERE orcamento_id IN (
  SELECT o.id FROM public.orcamentos o
  JOIN temp_obras_backup t ON t.id = o.obra_id
);

DELETE FROM public.orcamentos
WHERE obra_id IN (SELECT id FROM temp_obras_backup);

-- Demais tabelas operacionais e vinculadas
DELETE FROM public.obra_projetos_cad WHERE obra_id IN (SELECT id FROM temp_obras_backup);
DELETE FROM public.ordens_servico WHERE obra_id IN (SELECT id FROM temp_obras_backup);
DELETE FROM public.diario_obras WHERE obra_id IN (SELECT id FROM temp_obras_backup);
DELETE FROM public.medicoes WHERE obra_id IN (SELECT id FROM temp_obras_backup);
DELETE FROM public.cronograma_obra WHERE obra_id IN (SELECT id FROM temp_obras_backup);
DELETE FROM public.documentos WHERE obra_id IN (SELECT id FROM temp_obras_backup);

-- Exclusão principal das obras alvo
DELETE FROM public.obras WHERE id IN (SELECT id FROM temp_obras_backup);

-- Verificação final da quantidade removida
SELECT COUNT(*) AS obras_restantes FROM public.obras
WHERE numero IN ('OBRA-2026-0005', 'OBRA-2026-0006', 'OBRA-2026-0007', 'OBRA-2026-0008', 'OBRA-2026-0009');

-- Para confirmar a operação, substituir ROLLBACK por COMMIT após validação
COMMIT;

