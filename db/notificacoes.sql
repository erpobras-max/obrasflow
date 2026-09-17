CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('atraso','medicao','itr','contrato')),
  titulo text NOT NULL,
  mensagem text,
  lida boolean NOT NULL DEFAULT false,
  criado_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes(usuario_id, criado_at DESC);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notificacoes select" ON public.notificacoes FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Notificacoes insert" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
