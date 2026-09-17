CREATE TABLE IF NOT EXISTS public.obra_cronograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.propostas_catalogo_etapas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim date,
  status text NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','executando','concluido','atrasado')),
  progresso int NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_cronograma_obra ON public.obra_cronograma(obra_id, ordem);

ALTER TABLE public.obra_cronograma ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cronograma select" ON public.obra_cronograma FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cronograma insert" ON public.obra_cronograma FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Cronograma update" ON public.obra_cronograma FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Cronograma delete" ON public.obra_cronograma FOR DELETE TO authenticated USING (true);
