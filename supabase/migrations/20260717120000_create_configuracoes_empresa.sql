-- Criar tabela de configurações da empresa empregadora
CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
  id INT PRIMARY KEY DEFAULT 1,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  endereco TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insere um registro padrão se não existir
INSERT INTO public.configuracoes_empresa (id, razao_social, cnpj, endereco)
VALUES (1, 'Minha Empresa Empregadora Ltda', '00.000.000/0001-00', 'Av. Brasil, 1000 - Centro')
ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS e dar permissões
ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permitir_select_empresa" ON public.configuracoes_empresa;
CREATE POLICY "permitir_select_empresa" ON public.configuracoes_empresa FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "permitir_update_empresa" ON public.configuracoes_empresa;
CREATE POLICY "permitir_update_empresa" ON public.configuracoes_empresa FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  );

GRANT SELECT, INSERT, UPDATE ON public.configuracoes_empresa TO authenticated;
GRANT ALL ON public.configuracoes_empresa TO service_role;
