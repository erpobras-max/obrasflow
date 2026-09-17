-- ====================================================================
-- TABELA: imobiliaria_clientes
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imobiliaria_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('pf', 'pj')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT NOT NULL,
  rg_ie TEXT,
  email TEXT,
  telefone TEXT,
  celular TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS imob_clientes_cpf_cnpj_unique 
  ON public.imobiliaria_clientes (cpf_cnpj) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS imob_clientes_nome_idx ON public.imobiliaria_clientes (nome);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imobiliaria_clientes TO authenticated;
GRANT ALL ON public.imobiliaria_clientes TO service_role;

ALTER TABLE public.imobiliaria_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso imobiliaria clientes" ON public.imobiliaria_clientes;
CREATE POLICY "Acesso imobiliaria clientes" ON public.imobiliaria_clientes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro')
  );

-- ====================================================================
-- TABELA: imoveis
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'apartamento' CHECK (tipo IN ('apartamento', 'casa', 'comercial', 'terreno')),
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'alugado', 'vendido', 'inativo')),
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  quartos INTEGER NOT NULL DEFAULT 0,
  banheiros INTEGER NOT NULL DEFAULT 0,
  suites INTEGER NOT NULL DEFAULT 0,
  vagas INTEGER NOT NULL DEFAULT 0,
  area_privativa NUMERIC(10,2),
  area_total NUMERIC(10,2),
  valor_locacao NUMERIC(14,2),
  valor_venda NUMERIC(14,2),
  valor_condominio NUMERIC(14,2),
  valor_iptu NUMERIC(14,2),
  proprietario_id UUID NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imoveis_codigo_idx ON public.imoveis (codigo);
CREATE INDEX IF NOT EXISTS imoveis_proprietario_idx ON public.imoveis (proprietario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imoveis TO authenticated;
GRANT ALL ON public.imoveis TO service_role;

ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso imoveis" ON public.imoveis;
CREATE POLICY "Acesso imoveis" ON public.imoveis
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro')
  );

-- ====================================================================
-- TABELA: locacoes
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.locacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_numero TEXT NOT NULL,
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE RESTRICT,
  locatario_id UUID NOT NULL REFERENCES public.imobiliaria_clientes(id) ON DELETE RESTRICT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  valor_aluguel NUMERIC(14,2) NOT NULL,
  taxa_administracao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (taxa_administracao_percentual >= 0 AND taxa_administracao_percentual <= 100),
  garantia_tipo TEXT NOT NULL DEFAULT 'sem_garantia' CHECK (garantia_tipo IN ('caucao', 'fiador', 'seguro_fianca', 'sem_garantia')),
  garantia_valor NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'finalizado', 'rescindido')),
  observacoes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locacoes_contrato_idx ON public.locacoes (contrato_numero);
CREATE INDEX IF NOT EXISTS locacoes_imovel_idx ON public.locacoes (imovel_id);
CREATE INDEX IF NOT EXISTS locacoes_locatario_idx ON public.locacoes (locatario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.locacoes TO authenticated;
GRANT ALL ON public.locacoes TO service_role;

ALTER TABLE public.locacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso locacoes" ON public.locacoes;
CREATE POLICY "Acesso locacoes" ON public.locacoes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'financeiro')
  );

-- ====================================================================
-- MODIFICAÇÃO DAS TABELAS FINANCEIRAS EXISTENTES
-- ====================================================================

-- 1. contas_receber
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'erp' CHECK (origem IN ('erp', 'imobiliaria'));
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS imob_locacao_id UUID REFERENCES public.locacoes(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS imob_cliente_id UUID REFERENCES public.imobiliaria_clientes(id) ON DELETE SET NULL;

-- 2. contas_pagar
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'erp' CHECK (origem IN ('erp', 'imobiliaria'));
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS imob_locacao_id UUID REFERENCES public.locacoes(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS imob_cliente_id UUID REFERENCES public.imobiliaria_clientes(id) ON DELETE SET NULL;
