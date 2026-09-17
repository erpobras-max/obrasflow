-- ====================================================================
-- TABELA: imob_vistorias
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imob_vistorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locacao_id UUID REFERENCES public.locacoes(id) ON DELETE CASCADE,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'periodica')),
  data_vistoria DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  responsavel TEXT NOT NULL,
  parecer_geral TEXT,
  fotos TEXT[] DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imob_vistorias_locacao_id_idx ON public.imob_vistorias (locacao_id);
CREATE INDEX IF NOT EXISTS imob_vistorias_imovel_id_idx ON public.imob_vistorias (imovel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imob_vistorias TO authenticated;
GRANT ALL ON public.imob_vistorias TO service_role;

ALTER TABLE public.imob_vistorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso imob vistorias" ON public.imob_vistorias;
CREATE POLICY "Acesso imob vistorias" ON public.imob_vistorias
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro')
  );
