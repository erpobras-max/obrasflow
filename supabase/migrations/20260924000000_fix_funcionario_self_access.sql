-- Permite ao funcionário autenticado consultar somente a própria ficha.
-- Essa leitura é necessária para identificar o funcionario_id na tela de ponto
-- e para as políticas de registros_ponto validarem o vínculo com auth.uid().

DROP POLICY IF EXISTS "rh_func_select" ON public.funcionarios;

CREATE POLICY "rh_func_select" ON public.funcionarios
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
    OR user_id = auth.uid()
  );

