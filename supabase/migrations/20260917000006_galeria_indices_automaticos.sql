-- Galeria de imóveis e controle da atualização dos índices imobiliários.

CREATE TABLE IF NOT EXISTS public.imovel_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0 CHECK (ordem >= 0 AND ordem < 10),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (imovel_id, object_key)
);

CREATE INDEX IF NOT EXISTS imovel_fotos_imovel_ordem_idx
  ON public.imovel_fotos(imovel_id, ordem);

CREATE OR REPLACE FUNCTION public.limit_imovel_fotos()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.imovel_fotos WHERE imovel_id = NEW.imovel_id) >= 10 THEN
    RAISE EXCEPTION 'Um imóvel pode ter no máximo 10 fotos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limit_imovel_fotos_trigger ON public.imovel_fotos;
CREATE TRIGGER limit_imovel_fotos_trigger
  BEFORE INSERT ON public.imovel_fotos
  FOR EACH ROW EXECUTE FUNCTION public.limit_imovel_fotos();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_fotos TO authenticated;
GRANT ALL ON public.imovel_fotos TO service_role;
ALTER TABLE public.imovel_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imovel_fotos_acesso_por_cargo" ON public.imovel_fotos;
CREATE POLICY "imovel_fotos_acesso_por_cargo" ON public.imovel_fotos
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()));

-- Preserva fotos cadastradas no campo legado.
INSERT INTO public.imovel_fotos (imovel_id, object_key, ordem)
SELECT id, foto_url, 0
FROM public.imoveis
WHERE foto_url IS NOT NULL AND btrim(foto_url) <> ''
ON CONFLICT (imovel_id, object_key) DO NOTHING;

ALTER TABLE public.imob_indices_reajuste
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

UPDATE public.imob_indices_reajuste
SET atualizado_em = COALESCE(criado_em, now())
WHERE atualizado_em IS NULL;

ALTER TABLE public.imob_indices_reajuste
  ALTER COLUMN atualizado_em SET DEFAULT now(),
  ALTER COLUMN atualizado_em SET NOT NULL;

-- A tabela original não concedia DELETE, causando "permission denied".
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_indices_reajuste TO authenticated;

DROP POLICY IF EXISTS "imob_indices_reajuste_acesso_por_cargo" ON public.imob_indices_reajuste;
DROP POLICY IF EXISTS "imob_indices_select_por_cargo" ON public.imob_indices_reajuste;
DROP POLICY IF EXISTS "imob_indices_write_por_cargo" ON public.imob_indices_reajuste;
DROP POLICY IF EXISTS "imob_indices_update_por_cargo" ON public.imob_indices_reajuste;
DROP POLICY IF EXISTS "imob_indices_delete_por_cargo" ON public.imob_indices_reajuste;

CREATE POLICY "imob_indices_select_por_cargo" ON public.imob_indices_reajuste
  FOR SELECT TO authenticated
  USING (public.can_access_real_estate(auth.uid()));

CREATE POLICY "imob_indices_write_por_cargo" ON public.imob_indices_reajuste
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro_imobiliaria')
  );

CREATE POLICY "imob_indices_update_por_cargo" ON public.imob_indices_reajuste
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro_imobiliaria')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro_imobiliaria')
  );

CREATE POLICY "imob_indices_delete_por_cargo" ON public.imob_indices_reajuste
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro_imobiliaria')
  );
