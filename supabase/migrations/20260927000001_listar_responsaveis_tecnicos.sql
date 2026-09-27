-- Retorna somente usuários ativos com cargo de Engenharia, considerando
-- tanto o perfil principal legado quanto os múltiplos cargos de user_roles.

CREATE OR REPLACE FUNCTION public.listar_responsaveis_tecnicos()
RETURNS TABLE (user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.nome
    FROM public.perfis_usuarios p
   WHERE p.ativo = true
     AND (
       p.perfil = 'engenharia'
       OR EXISTS (
         SELECT 1
           FROM public.user_roles ur
          WHERE ur.user_id = p.user_id
            AND ur.role = 'engenharia'
       )
     )
   ORDER BY p.nome;
$$;

REVOKE ALL ON FUNCTION public.listar_responsaveis_tecnicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_responsaveis_tecnicos() TO authenticated;
