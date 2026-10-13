-- Repara instalações antigas do módulo de Compras e acrescenta valores estimados.
-- Os valores desta tabela são armazenados em reais; pedidos de compra continuam em centavos.
-- Esta migration é idempotente: pode ser aplicada mesmo quando parte do módulo já existe.

CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  nome text NOT NULL,
  categoria text,
  unidade text NOT NULL DEFAULT 'UN',
  preco_custo numeric(14,2) NOT NULL DEFAULT 0,
  preco_venda numeric(14,2) NOT NULL DEFAULT 0,
  ncm text,
  gtin text,
  situacao text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'inativo')),
  estoque_min numeric(10,3) DEFAULT 0,
  estoque_max numeric(10,3) DEFAULT 0,
  imagem_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS public.solicitacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_compra(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao_livre text,
  quantidade numeric(10,3) NOT NULL CHECK (quantidade > 0),
  unidade text NOT NULL,
  valor_unit_estimado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_unit_estimado >= 0),
  valor_total_estimado numeric(14,2) GENERATED ALWAYS AS (round(quantidade * valor_unit_estimado, 2)) STORED,
  etapa_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (produto_id IS NOT NULL OR nullif(trim(descricao_livre), '') IS NOT NULL)
);

-- Compatibilidade com instalações que tenham a tabela sem os campos recentes.
ALTER TABLE public.solicitacao_itens
  ADD COLUMN IF NOT EXISTS valor_unit_estimado numeric(14,2) NOT NULL DEFAULT 0;

-- Uma coluna gerada só pode ser incluída quando ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitacao_itens'
      AND column_name = 'valor_total_estimado'
  ) THEN
    ALTER TABLE public.solicitacao_itens
      ADD COLUMN valor_total_estimado numeric(14,2)
      GENERATED ALWAYS AS (round(quantidade * valor_unit_estimado, 2)) STORED;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL CHECK (quantidade > 0),
  unidade text NOT NULL,
  valor_unit bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solicitacao_itens_solicitacao_id_idx ON public.solicitacao_itens(solicitacao_id);
CREATE INDEX IF NOT EXISTS solicitacao_itens_produto_id_idx ON public.solicitacao_itens(produto_id);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacao_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;

DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "produtos_write" ON public.produtos;
CREATE POLICY "produtos_write" ON public.produtos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'almoxarifado'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'almoxarifado'));

DROP POLICY IF EXISTS "solicitacoes_select" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_select" ON public.solicitacoes_compra FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacoes_insert" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_insert" ON public.solicitacoes_compra FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacoes_update" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_update" ON public.solicitacoes_compra FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacoes_delete" ON public.solicitacoes_compra;
CREATE POLICY "solicitacoes_delete" ON public.solicitacoes_compra FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "solicitacao_itens_select" ON public.solicitacao_itens;
CREATE POLICY "solicitacao_itens_select" ON public.solicitacao_itens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacao_itens_insert" ON public.solicitacao_itens;
CREATE POLICY "solicitacao_itens_insert" ON public.solicitacao_itens FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacao_itens_update" ON public.solicitacao_itens;
CREATE POLICY "solicitacao_itens_update" ON public.solicitacao_itens FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'engenharia'));

DROP POLICY IF EXISTS "solicitacao_itens_delete" ON public.solicitacao_itens;
CREATE POLICY "solicitacao_itens_delete" ON public.solicitacao_itens FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';

