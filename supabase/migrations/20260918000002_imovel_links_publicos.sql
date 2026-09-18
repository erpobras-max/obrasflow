-- Links públicos revogáveis para apresentação de imóveis.
CREATE TABLE IF NOT EXISTS public.imovel_links_publicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  criado_por UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS imovel_links_publicos_ativo_idx
  ON public.imovel_links_publicos(imovel_id) WHERE revogado_em IS NULL;

ALTER TABLE public.imovel_links_publicos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imovel_links_publicos TO authenticated;
GRANT ALL ON public.imovel_links_publicos TO service_role;

DROP POLICY IF EXISTS "imovel_links_publicos_acesso" ON public.imovel_links_publicos;
CREATE POLICY "imovel_links_publicos_acesso" ON public.imovel_links_publicos
  FOR ALL TO authenticated
  USING (public.can_access_real_estate(auth.uid()))
  WITH CHECK (public.can_access_real_estate(auth.uid()) AND criado_por = auth.uid());

CREATE OR REPLACE FUNCTION public.obter_imovel_publico(_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', i.id,
    'codigo', i.codigo,
    'titulo', i.titulo,
    'descricao', i.descricao,
    'tipo', i.tipo,
    'status', i.status,
    'valor_locacao', i.valor_locacao,
    'valor_venda', i.valor_venda,
    'valor_condominio', i.valor_condominio,
    'valor_iptu', i.valor_iptu,
    'logradouro', i.logradouro,
    'numero', i.numero,
    'complemento', i.complemento,
    'bairro', i.bairro,
    'cidade', i.cidade,
    'uf', i.uf,
    'cep', i.cep,
    'quartos', i.quartos,
    'banheiros', i.banheiros,
    'suites', i.suites,
    'vagas', i.vagas,
    'area_privativa', i.area_privativa,
    'area_total', i.area_total,
    'fotos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('object_key', f.object_key, 'ordem', f.ordem) ORDER BY f.ordem)
      FROM public.imovel_fotos f WHERE f.imovel_id = i.id
    ), '[]'::jsonb)
  )
  FROM public.imovel_links_publicos l
  JOIN public.imoveis i ON i.id = l.imovel_id
  WHERE l.token = _token
    AND l.revogado_em IS NULL
    AND (l.expira_em IS NULL OR l.expira_em > now())
    AND i.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.obter_imovel_publico(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_imovel_publico(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
