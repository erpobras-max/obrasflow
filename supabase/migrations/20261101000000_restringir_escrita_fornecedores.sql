-- Separa a escrita de empreiteiros da escrita de fornecedores comuns.
-- A policy ampla anterior era combinada por OR com as policies originais e também
-- permitia que diretor e financeiro alterassem registros classificados como terceirizado.
BEGIN;

DROP POLICY IF EXISTS "forn_write" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete" ON public.fornecedores;

CREATE POLICY "fornecedores_insert"
  ON public.fornecedores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      classificacao = 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras')
      )
    ) OR (
      classificacao <> 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras') OR
        public.has_role(auth.uid(), 'diretor') OR
        public.has_role(auth.uid(), 'financeiro')
      )
    )
  );

CREATE POLICY "fornecedores_update"
  ON public.fornecedores
  FOR UPDATE
  TO authenticated
  USING (
    (
      classificacao = 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras')
      )
    ) OR (
      classificacao <> 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras') OR
        public.has_role(auth.uid(), 'diretor') OR
        public.has_role(auth.uid(), 'financeiro')
      )
    )
  )
  WITH CHECK (
    (
      classificacao = 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras')
      )
    ) OR (
      classificacao <> 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'compras') OR
        public.has_role(auth.uid(), 'diretor') OR
        public.has_role(auth.uid(), 'financeiro')
      )
    )
  );

CREATE POLICY "fornecedores_delete"
  ON public.fornecedores
  FOR DELETE
  TO authenticated
  USING (
    (classificacao = 'terceirizado' AND public.has_role(auth.uid(), 'admin')) OR
    (
      classificacao <> 'terceirizado' AND (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'diretor') OR
        public.has_role(auth.uid(), 'financeiro')
      )
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
