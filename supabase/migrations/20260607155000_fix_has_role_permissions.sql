-- Fix permission denied for function has_role by granting EXECUTE permission to authenticated users.
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Fix permission denied for function validar_cpf_cnpj (used in CHECK constraint on clientes) by granting EXECUTE permission to authenticated users.
GRANT EXECUTE ON FUNCTION public.validar_cpf_cnpj(text) TO authenticated;

-- Make get_client_email_by_cpf_cnpj robust by returning a fallback generated email if it is null in the database
CREATE OR REPLACE FUNCTION public.get_client_email_by_cpf_cnpj(doc text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_doc text;
  client_email text;
  client_exists boolean := false;
BEGIN
  -- Remove caracteres não numéricos
  clean_doc := regexp_replace(doc, '\D', '', 'g');
  
  -- Busca o email do cliente correspondente ou gera o fallback
  SELECT COALESCE(email, 'cliente_' || clean_doc || '@obrasflow.com.br'), true
  INTO client_email, client_exists
  FROM public.clientes 
  WHERE regexp_replace(cpf_cnpj, '\D', '', 'g') = clean_doc 
    AND deleted_at IS NULL 
  LIMIT 1;
  
  IF client_exists THEN
    RETURN client_email;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_email_by_cpf_cnpj(text) TO anon, authenticated;
