-- ====================================================================
-- MIGRATION: 20260917000002_imob_indices_atualizacao
-- ====================================================================
-- Atualiza tabela de índices de reajuste para suportar:
-- - periodo_mes (mês do índice)
-- - acumulado_12m (acumulado 12 meses para reajuste)
-- - created_by (responsável pela inserção)
-- - unique constraint por (indice_tipo, periodo_ano, periodo_mes)
-- ====================================================================

-- 1. Adicionar novas colunas à tabela imob_indices_reajuste
-- ====================================================================
ALTER TABLE public.imob_indices_reajuste
  ADD COLUMN IF NOT EXISTS periodo_mes INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM now()),
  ADD COLUMN IF NOT EXISTS acumulado_12m NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Remover constraint unique antiga e criar nova
-- ====================================================================
DROP INDEX IF EXISTS public.imob_indices_tipo_ano_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS imob_indices_tipo_ano_mes_uniq
  ON public.imob_indices_reajuste(indice_tipo, periodo_ano, periodo_mes);

-- 3. Adicionar índice para busca por mes
-- ====================================================================
CREATE INDEX IF NOT EXISTS imob_indices_mes_idx ON public.imob_indices_reajuste(periodo_mes);

-- 3. Atualizar constraint de tipo_contrato na tabela locacoes
-- ====================================================================
ALTER TABLE public.locacoes
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'inicial' CHECK (tipo_contrato IN ('inicial', 'renovacao', 'rescisao')),
  ADD COLUMN IF NOT EXISTS indice_reajuste TEXT CHECK (indice_reajuste IN ('ipca', 'igp_m', 'inpc', 'manual'));

CREATE INDEX IF NOT EXISTS locacoes_tipo_contrato_idx ON public.locacoes(tipo_contrato);
CREATE INDEX IF NOT EXISTS locacoes_indice_reajuste_idx ON public.locacoes(indice_reajuste);

-- 3. TABELA: imob_vistorias_itens (checklist de vistoria)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imob_vistorias_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID NOT NULL REFERENCES public.imob_vistorias(id) ON DELETE CASCADE,
  item_categoria TEXT NOT NULL CHECK (item_categoria IN ('estrutura', 'hidrossanitario', 'eletrico', 'acabamento', 'externo')),
  item_nome TEXT NOT NULL,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ok', 'defeito', 'observacao')),
  ordem INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imob_vistorias_itens_vistoria_idx ON public.imob_vistorias_itens(vistoria_id);
CREATE INDEX IF NOT EXISTS imob_vistorias_itens_categoria_idx ON public.imob_vistorias_itens(item_categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_vistorias_itens TO authenticated;
GRANT ALL ON public.imob_vistorias_itens TO service_role;

ALTER TABLE public.imob_vistorias_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_vistorias_itens_select" ON public.imob_vistorias_itens;
CREATE POLICY "imob_vistorias_itens_select" ON public.imob_vistorias_itens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "imob_vistorias_itens_write" ON public.imob_vistorias_itens;
CREATE POLICY "imob_vistorias_itens_write" ON public.imob_vistorias_itens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'));

CREATE TRIGGER trg_imob_vist_itens_upd BEFORE UPDATE ON public.imob_vistorias_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ATUALIZAR DADOS INICIAIS DE ÍNDICES (com mes)
-- ====================================================================
-- Remover dados antigos e inserir novos com mes
DELETE FROM public.imob_indices_reajuste;

INSERT INTO public.imob_indices_reajuste (indice_tipo, periodo_ano, periodo_mes, valor_indice, variacao_percentual, acumulado_12m, fonte, criado_em)
VALUES
  ('ipca', 2024, 12, 4.62, 4.62, 4.62, 'BCB/SGS'),
  ('ipca', 2025, 12, 4.83, 4.83, 4.83, 'BCB/SGS'),
  ('igp_m', 2024, 12, 3.72, 3.72, 3.72, 'BCB/SGS'),
  ('igp_m', 2025, 12, -0.36, -0.36, -0.36, 'BCB/SGS'),
  ('inpc', 2024, 12, 4.62, 4.62, 4.62, 'BCB/SGS'),
  ('inpc', 2025, 12, 4.52, 4.52, 4.52, 'BCB/SGS')
ON CONFLICT (indice_tipo, periodo_ano, periodo_mes) DO NOTHING;

-- 5. Remover constraint única antiga da tabela locacoes (se existir)
-- ====================================================================
-- A constraint única antiga (indice_tipo, periodo_ano) foi removida
-- A nova constraint é (indice_tipo, periodo_ano, periodo_mes)