-- ----------------------------------------------------
-- 1. ADICIONAR PERFIL DE FUNCIONÁRIO
-- ----------------------------------------------------
-- O tipo public.app_role é um enum. Precisamos adicionar o valor 'funcionario' se ele não existir.
-- Como no Postgres não é trivial fazer ALTER TYPE ADD VALUE dentro de transações de forma dinâmica,
-- faremos isso de forma segura.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'app_role' AND e.enumlabel = 'funcionario'
  ) THEN
    -- Fora de blocos de transação complexos, ALTER TYPE funciona. 
    -- Mas como estamos rodando no Supabase, adicionamos o valor de forma segura:
    ALTER TYPE public.app_role ADD VALUE 'funcionario';
  END IF;
END $$;

-- ----------------------------------------------------
-- 2. VINCULAR FUNCIONÁRIO AO AUTH.USERS
-- ----------------------------------------------------
ALTER TABLE public.funcionarios 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_user_id ON public.funcionarios(user_id);

-- ----------------------------------------------------
-- 3. FUNÇÃO RPC PARA BUSCAR E-MAIL DO FUNCIONÁRIO PELO CPF
-- ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_funcionario_email_by_cpf(doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_doc text;
  func_email text;
  func_exists boolean := false;
BEGIN
  -- Remove caracteres não numéricos
  clean_doc := regexp_replace(doc, '\D', '', 'g');
  
  -- Busca o email do funcionario correspondente ou gera o fallback
  SELECT COALESCE(email, 'funcionario_' || clean_doc || '@obrasflow.com.br'), true
  INTO func_email, func_exists
  FROM public.funcionarios 
  WHERE regexp_replace(cpf, '\D', '', 'g') = clean_doc 
    AND status = 'ativo' 
  LIMIT 1;
  
  IF func_exists THEN
    RETURN func_email;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_funcionario_email_by_cpf(text) TO anon, authenticated;

-- ----------------------------------------------------
-- 4. ATUALIZAR RLS DE REGISTROS DE PONTO PARA FUNCIONÁRIOS
-- ----------------------------------------------------
-- Permitir que funcionários acessem/insiram apenas seus próprios registros de ponto.
-- Primeiro dropamos as políticas existentes para poder recriá-las com suporte ao funcionário
DROP POLICY IF EXISTS "rh_ponto_select" ON public.registros_ponto;
DROP POLICY IF EXISTS "rh_ponto_all" ON public.registros_ponto;

-- Política de select
CREATE POLICY "rh_ponto_select" ON public.registros_ponto FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
    -- Ou se for o próprio funcionário dono do registro
    OR funcionario_id IN (
      SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
    )
  );

-- Política de inserção e modificação para administradores/rh
CREATE POLICY "rh_ponto_admin_all" ON public.registros_ponto FOR ALL TO authenticated
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

-- Política de inserção para o próprio funcionário bater ponto
CREATE POLICY "rh_ponto_funcionario_insert" ON public.registros_ponto FOR INSERT TO authenticated
  WITH CHECK (
    funcionario_id IN (
      SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
    )
  );

-- Política de update para o próprio funcionário complementar ponto (ex: registrar saída do almoço, retorno, saída)
CREATE POLICY "rh_ponto_funcionario_update" ON public.registros_ponto FOR UPDATE TO authenticated
  USING (
    funcionario_id IN (
      SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    funcionario_id IN (
      SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
    )
  );
