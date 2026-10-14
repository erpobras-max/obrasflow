-- Serviços em rascunho podem ser geridos pelos cargos operacionais.
-- Após aprovação, somente o administrador pode editar ou excluir.
DROP POLICY IF EXISTS servicos_terceirizados_write ON public.servicos_terceirizados;
DROP POLICY IF EXISTS servicos_terceirizados_insert ON public.servicos_terceirizados;
DROP POLICY IF EXISTS servicos_terceirizados_update ON public.servicos_terceirizados;
DROP POLICY IF EXISTS servicos_terceirizados_delete ON public.servicos_terceirizados;

CREATE POLICY servicos_terceirizados_insert ON public.servicos_terceirizados
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR
    public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY servicos_terceirizados_update ON public.servicos_terceirizados
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR status = 'rascunho'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR
    public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY servicos_terceirizados_delete ON public.servicos_terceirizados
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR status = 'rascunho'
  );

NOTIFY pgrst, 'reload schema';

