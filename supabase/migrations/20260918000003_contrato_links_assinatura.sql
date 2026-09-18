-- Links públicos, revogáveis e de uso único para assinatura de contratos.
CREATE TABLE IF NOT EXISTS public.contrato_links_assinatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  locacao_id UUID REFERENCES public.locacoes(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('contratada','contratante','locador','locatario','testemunha_1','testemunha_2')),
  papel_label TEXT NOT NULL,
  nome_esperado TEXT,
  documento_esperado TEXT,
  documento_titulo TEXT NOT NULL,
  documento_resumo TEXT NOT NULL,
  criado_por UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  usado_em TIMESTAMPTZ,
  revogado_em TIMESTAMPTZ,
  CONSTRAINT contrato_links_documento_check CHECK (
    (contrato_id IS NOT NULL AND locacao_id IS NULL) OR
    (contrato_id IS NULL AND locacao_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS contrato_links_contrato_papel_ativo_idx
  ON public.contrato_links_assinatura(contrato_id, papel)
  WHERE contrato_id IS NOT NULL AND usado_em IS NULL AND revogado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contrato_links_locacao_papel_ativo_idx
  ON public.contrato_links_assinatura(locacao_id, papel)
  WHERE locacao_id IS NOT NULL AND usado_em IS NULL AND revogado_em IS NULL;

ALTER TABLE public.contrato_links_assinatura ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contrato_links_assinatura TO authenticated;
GRANT ALL ON public.contrato_links_assinatura TO service_role;

DROP POLICY IF EXISTS "contrato_links_assinatura_acesso" ON public.contrato_links_assinatura;
CREATE POLICY "contrato_links_assinatura_acesso" ON public.contrato_links_assinatura
  FOR ALL TO authenticated
  USING (
    (locacao_id IS NOT NULL AND public.can_access_real_estate(auth.uid())) OR
    (contrato_id IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR
      public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil') OR
      public.has_role(auth.uid(), 'engenharia')
    ))
  )
  WITH CHECK (criado_por = auth.uid() AND (
    (locacao_id IS NOT NULL AND public.can_access_real_estate(auth.uid())) OR
    (contrato_id IS NOT NULL AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR
      public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'financeiro_civil')
    ))
  ));

CREATE OR REPLACE FUNCTION public.obter_link_assinatura(_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'papel', papel, 'papel_label', papel_label, 'nome_esperado', nome_esperado,
    'documento_esperado', documento_esperado, 'documento_titulo', documento_titulo,
    'documento_resumo', documento_resumo, 'expira_em', expira_em
  )
  FROM public.contrato_links_assinatura
  WHERE token = _token AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > now();
$$;

CREATE OR REPLACE FUNCTION public.assinar_contrato_publico(
  _token UUID, _nome TEXT, _documento TEXT, _assinatura_data_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link public.contrato_links_assinatura%ROWTYPE; _assinatura_id UUID;
BEGIN
  SELECT * INTO _link FROM public.contrato_links_assinatura
  WHERE token = _token AND usado_em IS NULL AND revogado_em IS NULL AND expira_em > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link inválido, expirado ou já utilizado'; END IF;
  IF char_length(trim(_nome)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF _assinatura_data_url NOT LIKE 'data:image/png;base64,%' OR octet_length(_assinatura_data_url) > 1048576 THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;

  INSERT INTO public.contrato_assinaturas (
    contrato_id, locacao_id, papel, nome_assinante, documento_assinante,
    assinatura_data_url, assinado_por, assinado_em, deleted_at
  ) VALUES (
    _link.contrato_id, _link.locacao_id, _link.papel, trim(_nome), nullif(trim(_documento), ''),
    _assinatura_data_url, NULL, now(), NULL
  ) RETURNING id INTO _assinatura_id;

  UPDATE public.contrato_links_assinatura SET usado_em = now() WHERE id = _link.id;
  RETURN jsonb_build_object('ok', true, 'assinatura_id', _assinatura_id);
END;
$$;

REVOKE ALL ON FUNCTION public.obter_link_assinatura(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assinar_contrato_publico(UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_link_assinatura(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinar_contrato_publico(UUID,TEXT,TEXT,TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
