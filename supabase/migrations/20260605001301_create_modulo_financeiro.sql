
-- ============================================
-- DIÁRIO DE OBRA
-- ============================================
CREATE TABLE public.diarios_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  clima TEXT,
  temperatura NUMERIC(5,2),
  efetivo JSONB NOT NULL DEFAULT '[]'::jsonb,
  atividades TEXT,
  ocorrencias TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diarios_obra_obra ON public.diarios_obra(obra_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra TO authenticated;
GRANT ALL ON public.diarios_obra TO service_role;
ALTER TABLE public.diarios_obra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarios_select" ON public.diarios_obra FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "diarios_insert" ON public.diarios_obra FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_update" ON public.diarios_obra FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_delete" ON public.diarios_obra FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_diarios_obra_updated BEFORE UPDATE ON public.diarios_obra
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fotos do diário
CREATE TABLE public.diarios_obra_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_id UUID NOT NULL REFERENCES public.diarios_obra(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diarios_fotos_diario ON public.diarios_obra_fotos(diario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diarios_obra_fotos TO authenticated;
GRANT ALL ON public.diarios_obra_fotos TO service_role;
ALTER TABLE public.diarios_obra_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diarios_fotos_select" ON public.diarios_obra_fotos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "diarios_fotos_insert" ON public.diarios_obra_fotos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "diarios_fotos_delete" ON public.diarios_obra_fotos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));

-- ============================================
-- MEDIÇÕES
-- ============================================
CREATE SEQUENCE IF NOT EXISTS public.medicoes_numero_seq START 1;

CREATE TABLE public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  percentual_total NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicoes_obra ON public.medicoes(obra_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated;
GRANT ALL ON public.medicoes TO service_role;
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes_select" ON public.medicoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_insert" ON public.medicoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));
CREATE POLICY "medicoes_update" ON public.medicoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_delete" ON public.medicoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE OR REPLACE FUNCTION public.gerar_numero_medicao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'MED-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.medicoes_numero_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_medicoes_numero BEFORE INSERT ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_medicao();

CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens de medição
CREATE TABLE public.medicoes_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  unidade TEXT,
  qtd_contratada NUMERIC(14,4) NOT NULL DEFAULT 0,
  qtd_executada NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medicoes_itens_medicao ON public.medicoes_itens(medicao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes_itens TO authenticated;
GRANT ALL ON public.medicoes_itens TO service_role;
ALTER TABLE public.medicoes_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medicoes_itens_select" ON public.medicoes_itens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "medicoes_itens_mod" ON public.medicoes_itens FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'engenharia'));

-- Recalcula total da medição
CREATE OR REPLACE FUNCTION public.recalc_medicao_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mid uuid;
BEGIN
  mid := COALESCE(NEW.medicao_id, OLD.medicao_id);
  UPDATE public.medicoes
    SET valor_total = COALESCE((SELECT SUM(valor_total) FROM public.medicoes_itens WHERE medicao_id = mid), 0)
    WHERE id = mid;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_medicoes_itens_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.medicoes_itens
FOR EACH ROW EXECUTE FUNCTION public.recalc_medicao_total();

-- ============================================
-- FINANCEIRO
-- ============================================
CREATE TABLE public.lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lanc_venc ON public.lancamentos_financeiros(data_vencimento);
CREATE INDEX idx_lanc_status ON public.lancamentos_financeiros(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_financeiros TO authenticated;
GRANT ALL ON public.lancamentos_financeiros TO service_role;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lanc_select" ON public.lancamentos_financeiros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_insert" ON public.lancamentos_financeiros FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_update" ON public.lancamentos_financeiros FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "lanc_delete" ON public.lancamentos_financeiros FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_lanc_updated BEFORE UPDATE ON public.lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
