-- 1. Criar a tabela de contas bancárias
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'aplicacao', 'caixa_interno')),
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir contas bancárias padrão
INSERT INTO public.contas_bancarias (nome, tipo, saldo_inicial, ativo)
VALUES 
  ('Caixa Geral', 'caixa_interno', 0.00, true),
  ('Banco Principal', 'corrente', 0.00, true)
ON CONFLICT DO NOTHING;

-- 2. Criar a tabela de categorias financeiras (DRE)
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  pai_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir algumas categorias DRE padrão estruturadas
INSERT INTO public.categorias_financeiras (id, nome, tipo, pai_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Receitas de Vendas', 'receita', NULL),
  ('a0000000-0000-0000-0000-000000000002', 'Outras Receitas', 'receita', NULL),
  ('a0000000-0000-0000-0000-000000000003', 'Custos de Mercadorias (CMV)', 'despesa', NULL),
  ('a0000000-0000-0000-0000-000000000004', 'Despesas Operacionais', 'despesa', NULL),
  ('a0000000-0000-0000-0000-000000000005', 'Despesas com Pessoal', 'despesa', 'a0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000006', 'Impostos e Contribuições', 'despesa', NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. Estender a tabela lancamentos_financeiros existente
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS categoria_dre_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS competencia date;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

-- 4. Estender contas_receber e contas_pagar para ter relacionamento com contas bancárias e categorias
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS categoria_dre_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS categoria_dre_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false;

-- 5. Habilitar RLS
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

-- 6. Grant de privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_financeiras TO authenticated;

-- 7. Políticas de RLS
CREATE POLICY "contas_bancarias_select" ON public.contas_bancarias FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "contas_bancarias_all" ON public.contas_bancarias FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro')
);

CREATE POLICY "categorias_financeiras_select" ON public.categorias_financeiras FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "categorias_financeiras_all" ON public.categorias_financeiras FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro')
);

-- Triggers de updated_at para manter integridade
CREATE TRIGGER trg_contas_bancarias_updated BEFORE UPDATE ON public.contas_bancarias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_categorias_financeiras_updated BEFORE UPDATE ON public.categorias_financeiras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
