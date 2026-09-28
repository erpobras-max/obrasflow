-- Cronograma físico criado automaticamente quando uma proposta aceita gera a obra.
-- As etapas permanecem editáveis pela engenharia após a criação da obra.

CREATE TABLE IF NOT EXISTS public.obras_cronogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL UNIQUE REFERENCES public.obras(id) ON DELETE CASCADE,
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras_cronogramas TO authenticated;
GRANT ALL ON public.obras_cronogramas TO service_role;

ALTER TABLE public.obras_cronogramas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obras_cronogramas_select_civil" ON public.obras_cronogramas;
CREATE POLICY "obras_cronogramas_select_civil" ON public.obras_cronogramas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "obras_cronogramas_write_civil" ON public.obras_cronogramas;
CREATE POLICY "obras_cronogramas_write_civil" ON public.obras_cronogramas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia')
  );

ALTER TABLE public.obra_cronograma
  ADD COLUMN IF NOT EXISTS percentual_planejado NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.obra_cronograma
  DROP CONSTRAINT IF EXISTS obra_cronograma_percentual_planejado_check;
ALTER TABLE public.obra_cronograma
  ADD CONSTRAINT obra_cronograma_percentual_planejado_check
  CHECK (percentual_planejado >= 0 AND percentual_planejado <= 100);

ALTER TABLE public.obra_cronograma
  DROP CONSTRAINT IF EXISTS obra_cronograma_datas_previstas_check;
ALTER TABLE public.obra_cronograma
  ADD CONSTRAINT obra_cronograma_datas_previstas_check
  CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim);

CREATE OR REPLACE FUNCTION public.criar_cronograma_da_obra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.obras_cronogramas (obra_id, proposta_id)
  VALUES (NEW.id, NEW.proposta_id)
  ON CONFLICT (obra_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obras_criar_cronograma ON public.obras;
CREATE TRIGGER obras_criar_cronograma
  AFTER INSERT ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.criar_cronograma_da_obra();

-- Garante cronograma para as obras que já existiam antes desta melhoria.
INSERT INTO public.obras_cronogramas (obra_id, proposta_id)
SELECT id, proposta_id FROM public.obras
ON CONFLICT (obra_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validar_percentual_planejado_cronograma()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC(7,2);
BEGIN
  SELECT COALESCE(SUM(percentual_planejado), 0)
    INTO v_total
    FROM public.obra_cronograma
   WHERE obra_id = NEW.obra_id
     AND id IS DISTINCT FROM NEW.id;

  IF v_total + COALESCE(NEW.percentual_planejado, 0) > 100 THEN
    RAISE EXCEPTION 'O percentual planejado ultrapassa 100%%. Saldo disponível: %%%', GREATEST(0, 100 - v_total);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obra_cronograma_validar_percentual_planejado ON public.obra_cronograma;
CREATE TRIGGER obra_cronograma_validar_percentual_planejado
  BEFORE INSERT OR UPDATE OF obra_id, percentual_planejado ON public.obra_cronograma
  FOR EACH ROW EXECUTE FUNCTION public.validar_percentual_planejado_cronograma();
