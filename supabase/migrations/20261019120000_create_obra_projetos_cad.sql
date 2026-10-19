-- Migration: Criar tabela para projetos CAD/BIM e modelagem 3D das obras
-- Data: 2026-10-19

CREATE TABLE IF NOT EXISTS public.obra_projetos_cad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  
  -- Metadados do Projeto
  versao INTEGER NOT NULL DEFAULT 1,
  titulo VARCHAR(255) NOT NULL DEFAULT 'Projeto Arquitetônico 3D',
  descricao TEXT,
  
  -- Estado completo do CAD / BIM (Paredes, Aberturas, Ambientes, Cobertura, Camadas)
  dados_projeto JSONB NOT NULL DEFAULT '{
    "config": {
      "peDireito": 2.80,
      "espessuraParedePadrao": 0.15,
      "unidade": "m"
    },
    "paredes": [],
    "aberturas": [],
    "ambientes": [],
    "cobertura": {
      "tipo": "embutida",
      "inclinacao": 10,
      "beiral": 0.50
    },
    "layers": {
      "telhado": true,
      "paredes": true,
      "esquadrias": true,
      "piso": true,
      "estrutura": true
    }
  }'::jsonb,

  -- Snapshot da imagem 3D capturada para a capa do dossiê
  foto_capa_3d TEXT,
  fotos_adicionais JSONB DEFAULT '[]'::jsonb,

  -- Memória de cálculo e quantitativos gerados
  quantitativos_calculados JSONB DEFAULT '{}'::jsonb,
  
  -- Parâmetros de BDI e Configurações Comerciais
  config_bdi JSONB DEFAULT '{
    "lucroLiquido": 12.0,
    "impostos": 8.0,
    "administracaoLocal": 5.0,
    "contingencia": 3.0,
    "taxaBdiTotal": 31.5
  }'::jsonb,

  -- Configuração de visualização no Portal do Cliente
  visivel_no_portal BOOLEAN NOT NULL DEFAULT true,
  permitir_download_dossie_portal BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT uq_obra_projetos_cad_obra UNIQUE (obra_id)
);

-- Índices para alta performance
CREATE INDEX IF NOT EXISTS idx_obra_projetos_cad_obra_id ON public.obra_projetos_cad(obra_id);

-- Conceder privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_projetos_cad TO authenticated;
GRANT ALL ON public.obra_projetos_cad TO service_role;

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.obra_projetos_cad ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'obra_projetos_cad'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.obra_projetos_cad', policy_row.policyname);
  END LOOP;
END;
$$;

-- Política 1: Usuários da equipe interna (qualquer usuário autenticado que não seja apenas cliente)
CREATE POLICY "obra_projetos_cad_equipe_all" ON public.obra_projetos_cad
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

-- Política 2: Clientes no Portal (Somente Leitura da sua respectiva obra)
CREATE POLICY "obra_projetos_cad_portal_cliente_select" ON public.obra_projetos_cad
  FOR SELECT TO authenticated
  USING (
    visivel_no_portal = true AND EXISTS (
      SELECT 1 FROM public.obras o
      JOIN public.clientes c ON c.id = o.cliente_id
      WHERE o.id = obra_projetos_cad.obra_id
        AND c.auth_user_id = auth.uid()
        AND c.deleted_at IS NULL
    )
  );
