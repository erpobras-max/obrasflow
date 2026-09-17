CREATE TABLE IF NOT EXISTS public.medicao_da_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  periodo_inicio date,
  periodo_fim date,
  percentual_total numeric(5,2),
  status text NOT NULL DEFAULT 'rascunho',
  criado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_medicao_obra_obra ON public.medicao_da_obra(obra_id);
ALTER TABLE public.medicao_da_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicao_da_obra_select" ON public.medicao_da_obra FOR SELECT TO authenticated USING (true);
CREATE POLICY "medicao_da_obra_insert" ON public.medicao_da_obra FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "medicao_da_obra_update" ON public.medicao_da_obra FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "medicao_da_obra_delete" ON public.medicao_da_obra FOR DELETE TO authenticated USING (true);
