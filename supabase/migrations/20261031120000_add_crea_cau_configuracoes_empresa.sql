-- Migration para adicionar CREA/CAU oficial no cadastro da empresa
ALTER TABLE public.configuracoes_empresa
  ADD COLUMN IF NOT EXISTS crea_cau text;

COMMENT ON COLUMN public.configuracoes_empresa.crea_cau IS 'Registro profissional da empresa no CREA ou CAU para documentos, propostas e contratos.';
