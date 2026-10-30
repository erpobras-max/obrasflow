-- ==============================================================================
-- Script de Restauração das 5 Obras de Teste Antigas (Caso Necessário)
-- ==============================================================================

BEGIN;

INSERT INTO public.obras (id, numero, nome, status, data_inicio, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000005', 'OBRA-2026-0005', 'Tica - Rural Net', 'em_andamento', CURRENT_DATE, NOW()),
  ('a0000000-0000-0000-0000-000000000006', 'OBRA-2026-0006', 'Obra Lucas - Obra 1', 'em_andamento', CURRENT_DATE, NOW()),
  ('a0000000-0000-0000-0000-000000000007', 'OBRA-2026-0007', 'CASA 13', 'em_andamento', CURRENT_DATE, NOW()),
  ('a0000000-0000-0000-0000-000000000008', 'OBRA-2026-0008', 'Flatiron Building', 'em_andamento', CURRENT_DATE, NOW()),
  ('a0000000-0000-0000-0000-000000000009', 'OBRA-2026-0009', 'Obra Caio Henrique / Kennedy', 'em_andamento', CURRENT_DATE, NOW())
ON CONFLICT (numero) DO NOTHING;

-- Cria os orçamentos vazios correspondentes
INSERT INTO public.orcamentos (obra_id, analitico_ativo, bdi_geral, status, versao)
SELECT id, true, 25.00, 'em_elaboracao', 1
FROM public.obras
WHERE numero IN ('OBRA-2026-0005', 'OBRA-2026-0006', 'OBRA-2026-0007', 'OBRA-2026-0008', 'OBRA-2026-0009')
ON CONFLICT DO NOTHING;

COMMIT;
