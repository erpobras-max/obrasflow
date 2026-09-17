-- Migration to create the Orçamentos and Custos module tables, constraints, triggers and RLS policies.

-- 1. Create public.referencia_insumos table
CREATE TABLE IF NOT EXISTS public.referencia_insumos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte text NOT NULL CHECK (fonte IN ('sinapi', 'sicro')),
  uf char(2) NOT NULL,
  mes_referencia text NOT NULL, -- e.g. '05/2026'
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL,
  preco_mediano bigint NOT NULL, -- in centavos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_referencia_insumos UNIQUE (fonte, uf, mes_referencia, codigo)
);

-- 2. Create public.referencia_composicoes table
CREATE TABLE IF NOT EXISTS public.referencia_composicoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte text NOT NULL CHECK (fonte IN ('sinapi', 'sicro')),
  uf char(2) NOT NULL,
  mes_referencia text NOT NULL, -- e.g. '05/2026'
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL,
  custo_total bigint NOT NULL, -- in centavos
  tipo_classe text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_referencia_composicoes UNIQUE (fonte, uf, mes_referencia, codigo)
);

-- 3. Create public.orcamentos table
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE UNIQUE,
  total_estimado bigint NOT NULL DEFAULT 0, -- in centavos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create public.orcamento_itens table
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  codigo text,
  descricao text NOT NULL,
  unidade text NOT NULL,
  quantidade numeric(14,4) NOT NULL DEFAULT 1.0000,
  valor_unitario bigint NOT NULL, -- in centavos
  valor_total bigint NOT NULL, -- in centavos
  fonte_referencia text NOT NULL DEFAULT 'proprio', -- e.g. 'sinapi', 'sicro', 'proprio'
  etapa text NOT NULL DEFAULT 'Geral', -- e.g. 'Serviços Preliminares', 'Fundação'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.referencia_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referencia_composicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

-- 6. Configure RLS Policies
-- referencia_insumos policies
CREATE POLICY "select_referencia_insumos" ON public.referencia_insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_referencia_insumos" ON public.referencia_insumos FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

-- referencia_composicoes policies
CREATE POLICY "select_referencia_composicoes" ON public.referencia_composicoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_referencia_composicoes" ON public.referencia_composicoes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

-- orcamentos policies
CREATE POLICY "manage_orcamentos" ON public.orcamentos FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

-- orcamento_itens policies
CREATE POLICY "manage_orcamento_itens" ON public.orcamento_itens FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

-- 7. Add updated_at triggers
CREATE TRIGGER trg_referencia_insumos_updated BEFORE UPDATE ON public.referencia_insumos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_referencia_composicoes_updated BEFORE UPDATE ON public.referencia_composicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_orcamento_itens_updated BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referencia_insumos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referencia_composicoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;

GRANT ALL ON public.referencia_insumos TO service_role;
GRANT ALL ON public.referencia_composicoes TO service_role;
GRANT ALL ON public.orcamentos TO service_role;
GRANT ALL ON public.orcamento_itens TO service_role;
