-- Migration to create the Compras (Purchases) module tables, columns, constraints and RLS policies.

-- 1. Create public.fornecedores table
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  cpf text,
  tipo text NOT NULL CHECK (tipo IN ('pf', 'pj')),
  email text,
  telefone text,
  avaliacao integer CHECK (avaliacao BETWEEN 1 AND 5),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create public.materiais table
CREATE TABLE IF NOT EXISTS public.materiais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL,
  categoria text NOT NULL DEFAULT 'MAT',
  estoque_min numeric(10,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create public.solicitacoes_compra table
CREATE TABLE IF NOT EXISTS public.solicitacoes_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  solicitante_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_aprovacao', 'aprovada', 'reprovada', 'pedido_gerado')),
  urgente boolean NOT NULL DEFAULT false,
  observacoes text,
  reprovacao_motivo text,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create public.solicitacao_itens table
CREATE TABLE IF NOT EXISTS public.solicitacao_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_compra(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materiais(id) ON DELETE SET NULL,
  descricao_livre text,
  quantidade numeric(10,3) NOT NULL,
  unidade text NOT NULL,
  etapa_id uuid, -- Sem restrição de FK conforme padrão do sistema
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create public.pedidos_compra table
CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id uuid REFERENCES public.solicitacoes_compra(id) ON DELETE SET NULL,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'emitido' CHECK (status IN ('emitido', 'confirmado', 'entregue_parcial', 'entregue', 'cancelado')),
  data_entrega_prev date,
  observacoes text,
  valor_total bigint NOT NULL DEFAULT 0, -- Em centavos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Create public.pedido_itens table
CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materiais(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL,
  unidade text NOT NULL,
  valor_unit bigint NOT NULL DEFAULT 0, -- Em centavos
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;

-- Define RLS policies

-- Fornecedores Policies
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Materiais Policies
CREATE POLICY "materiais_select" ON public.materiais FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "materiais_insert" ON public.materiais FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "materiais_update" ON public.materiais FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "materiais_delete" ON public.materiais FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Solicitacoes Compra Policies
CREATE POLICY "solicitacoes_select" ON public.solicitacoes_compra FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacoes_insert" ON public.solicitacoes_compra FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacoes_update" ON public.solicitacoes_compra FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacoes_delete" ON public.solicitacoes_compra FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Solicitacao Itens Policies
CREATE POLICY "solicitacao_itens_select" ON public.solicitacao_itens FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacao_itens_insert" ON public.solicitacao_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacao_itens_update" ON public.solicitacao_itens FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'diretor') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'engenharia')
  );

CREATE POLICY "solicitacao_itens_delete" ON public.solicitacao_itens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Pedidos Compra Policies
CREATE POLICY "pedidos_select" ON public.pedidos_compra FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pedidos_insert" ON public.pedidos_compra FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "pedidos_update" ON public.pedidos_compra FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "pedidos_delete" ON public.pedidos_compra FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Pedido Itens Policies
CREATE POLICY "pedido_itens_select" ON public.pedido_itens FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "pedido_itens_insert" ON public.pedido_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras')
  );

CREATE POLICY "pedido_itens_update" ON public.pedido_itens FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'compras') OR 
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "pedido_itens_delete" ON public.pedido_itens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Triggers de updated_at
DROP TRIGGER IF EXISTS trg_fornecedores_updated ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_materiais_updated ON public.materiais;
CREATE TRIGGER trg_materiais_updated BEFORE UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_solicitacoes_compra_updated ON public.solicitacoes_compra;
CREATE TRIGGER trg_solicitacoes_compra_updated BEFORE UPDATE ON public.solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_solicitacao_itens_updated ON public.solicitacao_itens;
CREATE TRIGGER trg_solicitacao_itens_updated BEFORE UPDATE ON public.solicitacao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pedidos_compra_updated ON public.pedidos_compra;
CREATE TRIGGER trg_pedidos_compra_updated BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pedido_itens_updated ON public.pedido_itens;
CREATE TRIGGER trg_pedido_itens_updated BEFORE UPDATE ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
