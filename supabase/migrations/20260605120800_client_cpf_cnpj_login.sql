-- 1. Vincular cliente ao usuário do Supabase Auth se a coluna não existir
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id);

-- 2. Função segura para buscar e-mail por CPF/CNPJ (rodando como SECURITY DEFINER para ignorar RLS antes do login)
CREATE OR REPLACE FUNCTION public.get_client_email_by_cpf_cnpj(doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_doc text;
  client_email text;
BEGIN
  -- Remove caracteres não numéricos
  clean_doc := regexp_replace(doc, '\D', '', 'g');
  
  -- Busca o email do cliente correspondente
  SELECT email INTO client_email 
  FROM public.clientes 
  WHERE regexp_replace(cpf_cnpj, '\D', '', 'g') = clean_doc 
    AND deleted_at IS NULL 
  LIMIT 1;
  
  RETURN client_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_email_by_cpf_cnpj(text) TO anon, authenticated;

-- 3. Habilitar políticas de leitura cruzando com o auth_user_id do cliente logado:
-- Clientes
DROP POLICY IF EXISTS "cliente_ver_proprio" ON public.clientes;
CREATE POLICY "cliente_ver_proprio" ON public.clientes
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Obras
DROP POLICY IF EXISTS "cliente_obras_select" ON public.obras;
CREATE POLICY "cliente_obras_select" ON public.obras 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.clientes c 
      WHERE c.id = public.obras.cliente_id AND c.auth_user_id = auth.uid()
    )
  );

-- Diários
DROP POLICY IF EXISTS "cliente_diarios_select" ON public.diarios_obra;
CREATE POLICY "cliente_diarios_select" ON public.diarios_obra 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE o.id = public.diarios_obra.obra_id AND c.auth_user_id = auth.uid()
    )
  );

-- Fotos dos diários
DROP POLICY IF EXISTS "cliente_diarios_fotos_select" ON public.diarios_obra_fotos;
CREATE POLICY "cliente_diarios_fotos_select" ON public.diarios_obra_fotos 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.diarios_obra d
      JOIN public.obras o ON o.id = d.obra_id
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE d.id = public.diarios_obra_fotos.diario_id AND c.auth_user_id = auth.uid()
    )
  );

-- Documentos
DROP POLICY IF EXISTS "cliente_documentos_select" ON public.documentos;
CREATE POLICY "cliente_documentos_select" ON public.documentos 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE o.id = public.documentos.obra_id AND c.auth_user_id = auth.uid()
    )
  );

-- Versões de Documentos
DROP POLICY IF EXISTS "cliente_documentos_versoes_select" ON public.documentos_versoes;
CREATE POLICY "cliente_documentos_versoes_select" ON public.documentos_versoes 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.documentos d
      JOIN public.obras o ON o.id = d.obra_id
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE d.id = public.documentos_versoes.documento_id AND c.auth_user_id = auth.uid()
    )
  );

-- Financeiro (Lançamentos Financeiros)
DROP POLICY IF EXISTS "cliente_financeiro_select" ON public.lancamentos_financeiros;
CREATE POLICY "cliente_financeiro_select" ON public.lancamentos_financeiros 
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.obras o
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE o.id = public.lancamentos_financeiros.obra_id AND c.auth_user_id = auth.uid()
    )
  );
