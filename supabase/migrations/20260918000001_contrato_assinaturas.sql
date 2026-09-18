-- Assinaturas manuscritas de contratos comerciais e de locação
CREATE TABLE IF NOT EXISTS public.contrato_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  locacao_id UUID REFERENCES public.locacoes(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN (
    'contratada', 'contratante', 'locador', 'locatario', 'testemunha_1', 'testemunha_2'
  )),
  nome_assinante TEXT NOT NULL CHECK (char_length(trim(nome_assinante)) BETWEEN 2 AND 160),
  documento_assinante TEXT,
  assinatura_data_url TEXT NOT NULL CHECK (
    assinatura_data_url LIKE 'data:image/png;base64,%'
    AND octet_length(assinatura_data_url) <= 1048576
  ),
  assinado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contrato_assinaturas_documento_check CHECK (
    (contrato_id IS NOT NULL AND locacao_id IS NULL)
    OR (contrato_id IS NULL AND locacao_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS contrato_assinaturas_contrato_papel_ativo_idx
  ON public.contrato_assinaturas(contrato_id, papel)
  WHERE contrato_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contrato_assinaturas_locacao_papel_ativo_idx
  ON public.contrato_assinaturas(locacao_id, papel)
  WHERE locacao_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contrato_assinaturas_contrato_idx
  ON public.contrato_assinaturas(contrato_id)
  WHERE contrato_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contrato_assinaturas_locacao_idx
  ON public.contrato_assinaturas(locacao_id)
  WHERE locacao_id IS NOT NULL;

ALTER TABLE public.contrato_assinaturas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.contrato_assinaturas TO authenticated;
GRANT ALL ON public.contrato_assinaturas TO service_role;

DROP POLICY IF EXISTS "contrato_assinaturas_select" ON public.contrato_assinaturas;
CREATE POLICY "contrato_assinaturas_select"
  ON public.contrato_assinaturas
  FOR SELECT TO authenticated
  USING (
    (
      contrato_id IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'diretor')
        OR public.has_role(auth.uid(), 'financeiro_civil')
        OR public.has_role(auth.uid(), 'financeiro')
        OR public.has_role(auth.uid(), 'engenharia')
      )
    )
    OR (
      locacao_id IS NOT NULL
      AND public.can_access_real_estate(auth.uid())
    )
  );

DROP POLICY IF EXISTS "contrato_assinaturas_insert" ON public.contrato_assinaturas;
CREATE POLICY "contrato_assinaturas_insert"
  ON public.contrato_assinaturas
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      contrato_id IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'diretor')
        OR public.has_role(auth.uid(), 'financeiro_civil')
        OR public.has_role(auth.uid(), 'financeiro')
      )
    )
    OR (
      locacao_id IS NOT NULL
      AND public.can_access_real_estate(auth.uid())
    )
  );

DROP POLICY IF EXISTS "contrato_assinaturas_update" ON public.contrato_assinaturas;
CREATE POLICY "contrato_assinaturas_update"
  ON public.contrato_assinaturas
  FOR UPDATE TO authenticated
  USING (
    (
      contrato_id IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'diretor')
        OR public.has_role(auth.uid(), 'financeiro_civil')
        OR public.has_role(auth.uid(), 'financeiro')
      )
    )
    OR (
      locacao_id IS NOT NULL
      AND public.can_access_real_estate(auth.uid())
    )
  )
  WITH CHECK (
    (
      contrato_id IS NOT NULL
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'diretor')
        OR public.has_role(auth.uid(), 'financeiro_civil')
        OR public.has_role(auth.uid(), 'financeiro')
      )
    )
    OR (
      locacao_id IS NOT NULL
      AND public.can_access_real_estate(auth.uid())
    )
  );

DROP TRIGGER IF EXISTS trg_contrato_assinaturas_updated_at ON public.contrato_assinaturas;
CREATE TRIGGER trg_contrato_assinaturas_updated_at
  BEFORE UPDATE ON public.contrato_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
