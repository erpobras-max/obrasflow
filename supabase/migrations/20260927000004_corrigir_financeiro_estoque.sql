-- ====================================================================
-- MIGRATION: corrigir_financeiro_estoque
-- Restaura estruturas ausentes no banco publicado e padroniza o acesso
-- do módulo financeiro e dos alertas de estoque.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  banco text,
  agencia text,
  conta text,
  tipo text,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  parent_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bancos que foram criados por versões anteriores sem todos os campos.
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_dre_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_dre_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS valor_total numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS pedidos_compra_created_at_idx ON public.pedidos_compra(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_financeiras TO authenticated;

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_bancarias_select" ON public.contas_bancarias;
DROP POLICY IF EXISTS "contas_bancarias_all" ON public.contas_bancarias;
DROP POLICY IF EXISTS "cb_select_auth" ON public.contas_bancarias;
DROP POLICY IF EXISTS "cb_write_priv" ON public.contas_bancarias;
CREATE POLICY "cb_select_auth" ON public.contas_bancarias
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "cb_write_priv" ON public.contas_bancarias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS "categorias_financeiras_select" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "categorias_financeiras_all" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "cf_select_auth" ON public.categorias_financeiras;
DROP POLICY IF EXISTS "cf_write_priv" ON public.categorias_financeiras;
CREATE POLICY "cf_select_auth" ON public.categorias_financeiras
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "cf_write_priv" ON public.categorias_financeiras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'financeiro'));

-- A base publicada ainda possui o estoque legado por obra. Em instalações
-- novas ele pode não existir, pois o sistema usa produto_estoque.
DO $$
BEGIN
  IF to_regclass('public.estoque_obra') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.estoque_obra TO authenticated';
    EXECUTE 'ALTER TABLE public.estoque_obra ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "auth_estoque" ON public.estoque_obra';
    EXECUTE 'DROP POLICY IF EXISTS "estoque_obra_select_auth" ON public.estoque_obra';
    EXECUTE 'CREATE POLICY "estoque_obra_select_auth" ON public.estoque_obra FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;

INSERT INTO public.contas_bancarias (nome, tipo, saldo_inicial, ativo)
SELECT 'Caixa Geral', 'caixa_interno', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.contas_bancarias);

INSERT INTO public.categorias_financeiras (nome, tipo, ordem)
SELECT v.nome, v.tipo, v.ordem
FROM (VALUES
  ('Prestação de Serviços', 'receita', 10),
  ('Outras Receitas', 'receita', 90),
  ('Fornecedores', 'despesa', 10),
  ('Salários e Encargos', 'despesa', 20),
  ('Impostos', 'despesa', 30),
  ('Despesas Administrativas', 'despesa', 40)
) AS v(nome, tipo, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias_financeiras c WHERE c.nome = v.nome AND c.tipo = v.tipo
);
