-- Script de Auditoria e Contagem de Registros Vinculados às Obras
-- Execute este script no SQL Editor do Supabase para verificar todas as tabelas vinculadas antes de qualquer exclusão

WITH obras_alvo AS (
  SELECT id, numero, nome FROM public.obras
  WHERE numero IN (
    'OBRA-2026-0005',
    'OBRA-2026-0006',
    'OBRA-2026-0007',
    'OBRA-2026-0008',
    'OBRA-2026-0009'
  )
)
SELECT 
  o.numero,
  o.nome,
  (SELECT COUNT(*) FROM public.orcamentos WHERE obra_id = o.id) AS total_orcamentos,
  (SELECT COUNT(*) FROM public.orcamento_etapas WHERE orcamento_id IN (SELECT id FROM public.orcamentos WHERE obra_id = o.id)) AS total_orcamento_etapas,
  (SELECT COUNT(*) FROM public.orcamento_itens WHERE orcamento_id IN (SELECT id FROM public.orcamentos WHERE obra_id = o.id)) AS total_orcamento_itens_legados,
  (SELECT COUNT(*) FROM public.propostas WHERE obra_id = o.id) AS total_propostas,
  (SELECT COUNT(*) FROM public.contratos WHERE obra_id = o.id) AS total_contratos,
  (SELECT COUNT(*) FROM public.medicoes WHERE obra_id = o.id) AS total_medicoes,
  (SELECT COUNT(*) FROM public.diario_obras WHERE obra_id = o.id) AS total_diario_obras,
  (SELECT COUNT(*) FROM public.cronograma_obra WHERE obra_id = o.id) AS total_cronogramas,
  (SELECT COUNT(*) FROM public.documentos WHERE obra_id = o.id) AS total_documentos,
  (SELECT COUNT(*) FROM public.contas_pagar WHERE obra_id = o.id) AS total_contas_pagar,
  (SELECT COUNT(*) FROM public.contas_receber WHERE obra_id = o.id) AS total_contas_receber,
  (SELECT COUNT(*) FROM public.movimentacoes_financeiras WHERE obra_id = o.id) AS total_movimentacoes_financeiras,
  (SELECT COUNT(*) FROM public.estoque_movimentacoes WHERE obra_id = o.id) AS total_estoque_movimentacoes,
  (SELECT COUNT(*) FROM public.pedidos_compra WHERE obra_id = o.id) AS total_pedidos_compra,
  (SELECT COUNT(*) FROM public.ordens_servico WHERE obra_id = o.id) AS total_ordens_servico,
  (SELECT COUNT(*) FROM public.obra_projetos_cad WHERE obra_id = o.id) AS total_projetos_cad
FROM obras_alvo o
ORDER BY o.numero;

