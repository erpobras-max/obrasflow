-- ====================================================================
-- MIGRATION: 20260917000004_financeiro_roles
-- ====================================================================
-- Atualiza enum app_role para separar financeiro em:
-- - financeiro_civil (obra civil)
-- - financeiro_imobiliaria (imobiliária)
-- Mantém 'financeiro' para compatibilidade, mas marca como deprecated
-- Adiciona 'imobiliaria' role
-- ====================================================================

-- 1. Adicionar novos valores ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro_civil';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro_imobiliaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'imobiliaria';

-- 2. Mapear usuários existentes com perfil 'financeiro' para 'financeiro_civil'
-- (mantendo compatibilidade - financeiro civil é o padrão)
UPDATE public.perfis_usuarios
SET perfil = 'financeiro_civil'
WHERE perfil = 'financeiro';

-- 4. Inserir roles na tabela user_roles para usuários migrados
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'financeiro_civil' FROM public.perfis_usuarios
WHERE perfil = 'financeiro_civil'
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Inserir roles para usuários imobiliaria
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'imobiliaria' FROM public.perfis_usuarios
WHERE perfil = 'imobiliaria'
ON CONFLICT (user_id, role) DO NOTHING;