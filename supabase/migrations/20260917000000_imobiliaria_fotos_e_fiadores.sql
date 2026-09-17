-- ====================================================================
-- MIGRATION: 20260917000000_imobiliaria_fotos_e_fiadores
-- ====================================================================
-- Adiciona suporte a fotos nos imóveis e gestão de fiadores nas locações.
-- ====================================================================

-- 1. TABELA: imob_fiadores (gestão completa de fiadores)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imob_fiadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE CASCADE,
  vinculo_tipo TEXT NOT NULL DEFAULT 'parente' CHECK (vinculo_tipo IN ('parente', 'amigo', 'companheiro', 'outro')),
  renda_mensal NUMERIC(14,2),
  documento_vida TEXT,
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imob_fiadores_cliente_idx ON public.imob_fiadores(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_fiadores TO authenticated;
GRANT ALL ON public.imob_fiadores TO service_role;

ALTER TABLE public.imob_fiadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_fiadores_select" ON public.imob_fiadores;
CREATE POLICY "imob_fiadores_select" ON public.imob_fiadores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "imob_fiadores_write" ON public.imob_fiadores;
CREATE POLICY "imob_fiadores_write" ON public.imob_fiadores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'));

CREATE TRIGGER trg_imob_fiadores_upd BEFORE UPDATE ON public.imob_fiadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. TABELA: imob_indices_reajuste (histórico de índices para simulação)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imob_indices_reajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indice_tipo TEXT NOT NULL CHECK (indice_tipo IN ('ipca', 'igp_m', 'inpc')),
  periodo_ano INTEGER NOT NULL,
  valor_indice NUMERIC(10,4) NOT NULL,
  variacao_percentual NUMERIC(8,4),
  fonte TEXT NOT NULL DEFAULT 'IBGE/FIPE',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS imob_indices_tipo_idx ON public.imob_indices_reajuste(indice_tipo);
CREATE INDEX IF NOT EXISTS imob_indices_ano_idx ON public.imob_indices_reajuste(periodo_ano);
CREATE UNIQUE INDEX IF NOT EXISTS imob_indices_tipo_ano_uniq ON public.imob_indices_reajuste(indice_tipo, periodo_ano);

GRANT SELECT, INSERT, UPDATE ON public.imob_indices_reajuste TO authenticated;
GRANT ALL ON public.imob_indices_reajuste TO service_role;

ALTER TABLE public.imob_indices_reajuste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imob_indices_select" ON public.imob_indices_reajuste;
CREATE POLICY "imob_indices_select" ON public.imob_indices_reajuste
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "imob_indices_write" ON public.imob_indices_reajuste;
CREATE POLICY "imob_indices_write" ON public.imob_indices_reajuste
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'));

-- 3. COLUNA: foto_url na tabela imoveis
-- ====================================================================
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE INDEX IF NOT EXISTS imoveis_foto_idx ON public.imoveis(foto_url) WHERE foto_url IS NOT NULL;

-- 4. COLUNA: fiador_id na tabela locacoes
-- ====================================================================
ALTER TABLE public.locacoes
  ADD COLUMN IF NOT EXISTS fiador_id UUID REFERENCES public.imob_fiadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS locacoes_fiador_idx ON public.locacoes(fiador_id);

-- 5. INSERIR DADOS INICIAIS de índices (simulados — em produção viriam da API)
-- ====================================================================
INSERT INTO public.imob_indices_reajuste (indice_tipo, periodo_ano, valor_indice, variacao_percentual, fonte)
VALUES
  ('ipca', 2024, 4.83, 4.83, 'IBGE'),
  ('ipca', 2025, 4.19, 4.19, 'IBGE'),
  ('igp_m', 2024, -0.36, -0.36, 'FGV'),
  ('igp_m', 2025, 2.87, 2.87, 'FGV'),
  ('inpc', 2024, 5.79, 5.79, 'IBGE'),
  ('inpc', 2025, 4.52, 4.52, 'IBGE')
ON CONFLICT (indice_tipo, periodo_ano) DO NOTHING;
