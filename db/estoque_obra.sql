CREATE TABLE IF NOT EXISTS public.estoque_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  produto_id uuid,
  quantidade numeric(14,2) NOT NULL DEFAULT 0,
  unidade text,
  estoque_min numeric(14,2) DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estoque_obra_obra ON public.estoque_obra(obra_id);
ALTER TABLE public.estoque_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_obra_select" ON public.estoque_obra FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque_obra_insert" ON public.estoque_obra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "estoque_obra_update" ON public.estoque_obra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "estoque_obra_delete" ON public.estoque_obra FOR DELETE TO authenticated USING (true);
