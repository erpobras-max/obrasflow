-- Recupera somente a base do estoque quando as tabelas não existem.
-- Não remove tabelas, colunas ou dados. A migration 20261013000006 instala
-- QR, prateleiras, trigger compatível e a RPC de movimentação.

CREATE TABLE IF NOT EXISTS public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.produto_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  saldo numeric(14,4) NOT NULL DEFAULT 0,
  custo_medio numeric(14,4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produto_estoque_produto_deposito_uidx UNIQUE (produto_id, deposito_id)
);

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  prateleira_id uuid,
  deposito_destino_id uuid REFERENCES public.depositos(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantidade numeric(14,4) NOT NULL CHECK (quantidade >= 0),
  custo_unitario numeric(14,4) NOT NULL DEFAULT 0,
  saldo_anterior numeric(14,4),
  saldo_apos numeric(14,4) NOT NULL DEFAULT 0,
  custo_medio_apos numeric(14,4),
  documento text,
  justificativa text,
  observacao text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  data_movimento timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.depositos TO authenticated;
GRANT ALL ON public.depositos TO service_role;
GRANT SELECT ON public.produto_estoque, public.movimentacoes_estoque TO authenticated;
GRANT ALL ON public.produto_estoque, public.movimentacoes_estoque TO service_role;

ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depositos_select_auth" ON public.depositos;
CREATE POLICY "depositos_select_auth" ON public.depositos
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "depositos_manage_almoxarifado" ON public.depositos;
CREATE POLICY "depositos_manage_almoxarifado" ON public.depositos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'almoxarifado')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'almoxarifado')
  );

DROP POLICY IF EXISTS "produto_estoque_select_auth" ON public.produto_estoque;
CREATE POLICY "produto_estoque_select_auth" ON public.produto_estoque
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "movimentacoes_estoque_select_auth" ON public.movimentacoes_estoque;
CREATE POLICY "movimentacoes_estoque_select_auth" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.depositos (nome, codigo, ativo)
VALUES ('Depósito Geral', 'DPG', true)
ON CONFLICT (codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
