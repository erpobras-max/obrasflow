-- Corrige os privilégios e as políticas do cronograma das obras.
CREATE TABLE IF NOT EXISTS public.obra_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  status TEXT NOT NULL DEFAULT 'planejado',
  progresso NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obra_cronograma_obra_ordem_idx
  ON public.obra_cronograma(obra_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_cronograma TO authenticated;
GRANT ALL ON public.obra_cronograma TO service_role;

ALTER TABLE public.obra_cronograma ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'obra_cronograma'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.obra_cronograma', policy_row.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "obra_cronograma_select_civil" ON public.obra_cronograma
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "obra_cronograma_insert_civil" ON public.obra_cronograma
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "obra_cronograma_update_civil" ON public.obra_cronograma
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "obra_cronograma_delete_civil" ON public.obra_cronograma
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
  );
