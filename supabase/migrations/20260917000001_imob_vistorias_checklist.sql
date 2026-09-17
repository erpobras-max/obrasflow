-- ====================================================================
-- MIGRATION: 20260917000001_imob_vistorias_checklist
-- ====================================================================
-- Adiciona tabela de itens de checklist para vistorias
-- ====================================================================

-- TABELA: imob_vistorias_itens (checklist de vistoria)
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

-- 2. COLUNA: tipo_contrato na tabela locacoes
-- ====================================================================
ALTER TABLE public.locacoes
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'inicial' CHECK (tipo_contrato IN ('inicial', 'renovacao', 'rescisao'));

CREATE INDEX IF NOT EXISTS locacoes_tipo_contrato_idx ON public.locacoes(tipo_contrato);

-- 3. COLUNA: indice_reajuste na tabela locacoes
-- ====================================================================
ALTER TABLE public.locacoes
  ADD COLUMN IF NOT EXISTS indice_reajuste TEXT CHECK (indice_reajuste IN ('ipca', 'igp_m', 'inpc', 'manual'));

-- 4. INSERIR ITENS DE CHECKLIST PADRÃO PARA VISTORIAS
-- ====================================================================
-- Estes itens serão carregados automaticamente quando uma vistoria for criada
-- A lógica de inserção automática será feita no frontend
