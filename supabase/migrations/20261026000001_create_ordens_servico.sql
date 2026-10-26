-- Migration: Criar tabela para Ordens de Serviço (OS) com prazos, prioridade e responsavel
-- Data: 2026-10-26

CREATE SEQUENCE IF NOT EXISTS public.ordens_servico_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT ('OS-' || LPAD(nextval('public.ordens_servico_numero_seq')::text, 4, '0')),
  
  -- Vínculos opcionais
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  
  -- Dados da OS
  titulo TEXT NOT NULL,
  descricao TEXT,
  
  -- Responsável pela execução
  responsavel_id UUID REFERENCES public.perfis_usuarios(id) ON DELETE SET NULL,
  responsavel_nome TEXT,
  responsavel_telefone TEXT,
  
  -- Prazos e Controle
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao DATE NOT NULL,
  data_conclusao TIMESTAMPTZ,
  
  -- Prioridade e Situação
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'aguardando_material', 'concluida', 'cancelada')),
  
  observacoes TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para buscas rápidas e filtros de prazo
CREATE INDEX IF NOT EXISTS idx_ordens_servico_obra_id ON public.ordens_servico(obra_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_id ON public.ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_previsao ON public.ordens_servico(data_previsao);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_responsavel ON public.ordens_servico(responsavel_id);

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ordens_servico_numero_seq TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;

-- Habilitar RLS
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ordens_servico'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ordens_servico', policy_row.policyname);
  END LOOP;
END;
$$;

-- Política para equipe interna
CREATE POLICY "ordens_servico_equipe_all" ON public.ordens_servico
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
    OR public.has_role(auth.uid(), 'financeiro')
    OR public.has_role(auth.uid(), 'compras')
    OR NOT public.has_role(auth.uid(), 'cliente')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
    OR NOT public.has_role(auth.uid(), 'cliente')
  );

-- Política para portal do cliente (se houver OS vinculada ao cliente)
CREATE POLICY "ordens_servico_portal_cliente_select" ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = ordens_servico.cliente_id
        AND c.auth_user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );
