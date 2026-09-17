CREATE TABLE IF NOT EXISTS public.obra_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  etapa_cronograma_id uuid REFERENCES public.obra_cronograma(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','reprovado','corrigido')),
  foto_url text,
  criado_por uuid REFERENCES auth.users(id),
  criado_at timestamptz NOT NULL DEFAULT now(),
  atualizado_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obras_itr_obra ON public.obra_itr(obra_id);

ALTER TABLE public.obra_itr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ITR select" ON public.obra_itr FOR SELECT TO authenticated USING (true);
CREATE POLICY "ITR insert" ON public.obra_itr FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ITR update" ON public.obra_itr FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ITR delete" ON public.obra_itr FOR DELETE TO authenticated USING (true);
