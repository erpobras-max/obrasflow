-- ====================================================================
-- MIGRATION: 20260917000003_user_roles
-- ====================================================================
-- Tabela para permitir múltiplos roles por usuário
-- ====================================================================
-- Adiciona suporte para múltiplos roles por usuário, incluindo
-- financeiro_civil e financeiro_imobiliaria.

-- Os valores só serão usados em migrations posteriores, depois do commit
-- desta transação.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro_civil';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro_imobiliaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'imobiliaria';

-- Tabela de associação de roles por usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Atualizar a tabela perfis_usuarios para permitir múltiplos roles
-- ====================================================================
-- Adicionar coluna de ativo e índices
ALTER TABLE public.perfis_usuarios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Criar índice para busca por role
CREATE INDEX IF NOT EXISTS idx_perfis_usuarios_perfil ON public.perfis_usuarios(perfil);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- A função passa a considerar o perfil principal e os cargos adicionais.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.perfis_usuarios
      WHERE user_id = _user_id AND perfil = _role AND ativo = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.perfis_usuarios pu ON pu.user_id = ur.user_id
      WHERE ur.user_id = _user_id AND ur.role = _role AND pu.ativo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- 3. Atualizar a política de visualização para usar a nova função
DROP POLICY IF EXISTS "Users view own profile" ON public.perfis_usuarios;
CREATE POLICY "Users view own profile" ON public.perfis_usuarios
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Inserir roles padrão para usuários existentes (baseado no perfil existente)
-- ====================================================================
-- Inserir roles padrão (atualizados com financeiro_civil e financeiro_imobiliaria)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, perfil FROM public.perfis_usuarios
ON CONFLICT (user_id, role) DO NOTHING;
