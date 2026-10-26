-- Migration: Criar tabelas de push subscriptions e historico de notificacoes
-- Data: 2026-10-26

-- 1. Tabela de Inscrições Push para dispositivos móveis e navegadores
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_user_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Tabela de Histórico de Envios para evitar duplicidade de notificações no mesmo dia
CREATE TABLE IF NOT EXISTS public.notificacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'push', 'sino')),
  referencia_tipo TEXT NOT NULL,
  referencia_id UUID NOT NULL,
  destinatario TEXT NOT NULL,
  data_envio DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'sucesso' CHECK (status IN ('sucesso', 'erro')),
  detalhes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_notificacao_diaria UNIQUE (referencia_tipo, referencia_id, tipo, data_envio)
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_historico_data ON public.notificacoes_historico(data_envio);
CREATE INDEX IF NOT EXISTS idx_notificacoes_historico_ref ON public.notificacoes_historico(referencia_tipo, referencia_id);

GRANT SELECT, INSERT, UPDATE ON public.notificacoes_historico TO authenticated;
GRANT ALL ON public.notificacoes_historico TO service_role;

ALTER TABLE public.notificacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_historico_select" ON public.notificacoes_historico
  FOR SELECT TO authenticated
  USING (true);
