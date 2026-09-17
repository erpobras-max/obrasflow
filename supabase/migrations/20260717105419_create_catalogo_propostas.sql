
-- ============ CLIENTES: flag de relação ============
DO $$ BEGIN
  CREATE TYPE public.tipo_relacao_cliente AS ENUM ('cliente','fornecedor','ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_relacao public.tipo_relacao_cliente NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS codigo_externo text;

CREATE INDEX IF NOT EXISTS clientes_tipo_relacao_idx ON public.clientes(tipo_relacao);
CREATE INDEX IF NOT EXISTS clientes_codigo_externo_idx ON public.clientes(codigo_externo);

-- ============ PRODUTOS ============
DO $$ BEGIN
  CREATE TYPE public.situacao_produto AS ENUM ('ativo','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  nome text NOT NULL,
  descricao text,
  categoria text,
  unidade text NOT NULL DEFAULT 'UN',
  preco_custo numeric(14,4) NOT NULL DEFAULT 0,
  preco_venda numeric(14,4) NOT NULL DEFAULT 0,
  ncm text,
  gtin text,
  situacao public.situacao_produto NOT NULL DEFAULT 'ativo',
  estoque_minimo numeric(14,4) NOT NULL DEFAULT 0,
  estoque_maximo numeric(14,4) NOT NULL DEFAULT 0,
  peso_kg numeric(14,4),
  imagem_url text,
  observacoes text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produtos_sku_unique UNIQUE (sku)
);
CREATE INDEX IF NOT EXISTS produtos_nome_idx ON public.produtos(nome);
CREATE INDEX IF NOT EXISTS produtos_gtin_idx ON public.produtos(gtin);
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON public.produtos(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_select_auth" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "produtos_insert_priv" ON public.produtos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "produtos_update_priv" ON public.produtos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "produtos_delete_priv" ON public.produtos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DEPÓSITOS ============
CREATE TABLE IF NOT EXISTS public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depositos TO authenticated;
GRANT ALL ON public.depositos TO service_role;
ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depositos_select_auth" ON public.depositos FOR SELECT TO authenticated USING (true);
CREATE POLICY "depositos_write_priv" ON public.depositos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_depositos_updated BEFORE UPDATE ON public.depositos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.depositos (nome, padrao) VALUES ('Depósito Principal', true)
  ON CONFLICT DO NOTHING;

-- ============ SALDO POR DEPÓSITO ============
CREATE TABLE IF NOT EXISTS public.produto_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  saldo numeric(14,4) NOT NULL DEFAULT 0,
  custo_medio numeric(14,4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, deposito_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_estoque TO authenticated;
GRANT ALL ON public.produto_estoque TO service_role;
ALTER TABLE public.produto_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prodestoque_select_auth" ON public.produto_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "prodestoque_write_priv" ON public.produto_estoque FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

-- ============ MOVIMENTAÇÕES ESTOQUE ============
DO $$ BEGIN
  CREATE TYPE public.tipo_mov_estoque AS ENUM ('entrada','saida','ajuste','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  deposito_destino_id uuid REFERENCES public.depositos(id) ON DELETE RESTRICT,
  tipo public.tipo_mov_estoque NOT NULL,
  quantidade numeric(14,4) NOT NULL,
  custo_unitario numeric(14,4) NOT NULL DEFAULT 0,
  documento text,
  observacoes text,
  data_movimento timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mov_estoque_produto_idx ON public.movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS mov_estoque_data_idx ON public.movimentacoes_estoque(data_movimento DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_estoque TO authenticated;
GRANT ALL ON public.movimentacoes_estoque TO service_role;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mov_estoque_select_auth" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "mov_estoque_write_priv" ON public.movimentacoes_estoque FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

-- Trigger para atualizar saldo automaticamente
CREATE OR REPLACE FUNCTION public.aplicar_movimentacao_estoque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric(14,4);
BEGIN
  IF NEW.tipo = 'entrada' THEN
    delta := NEW.quantidade;
  ELSIF NEW.tipo = 'saida' THEN
    delta := -NEW.quantidade;
  ELSIF NEW.tipo = 'ajuste' THEN
    delta := NEW.quantidade; -- pode ser negativo
  ELSIF NEW.tipo = 'transferencia' THEN
    -- saída do depósito origem
    INSERT INTO public.produto_estoque (produto_id, deposito_id, saldo)
      VALUES (NEW.produto_id, NEW.deposito_id, -NEW.quantidade)
      ON CONFLICT (produto_id, deposito_id) DO UPDATE
        SET saldo = produto_estoque.saldo - NEW.quantidade, updated_at = now();
    -- entrada no destino
    IF NEW.deposito_destino_id IS NOT NULL THEN
      INSERT INTO public.produto_estoque (produto_id, deposito_id, saldo)
        VALUES (NEW.produto_id, NEW.deposito_destino_id, NEW.quantidade)
        ON CONFLICT (produto_id, deposito_id) DO UPDATE
          SET saldo = produto_estoque.saldo + NEW.quantidade, updated_at = now();
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.produto_estoque (produto_id, deposito_id, saldo, custo_medio)
    VALUES (NEW.produto_id, NEW.deposito_id, delta, NEW.custo_unitario)
    ON CONFLICT (produto_id, deposito_id) DO UPDATE
      SET saldo = produto_estoque.saldo + delta,
          custo_medio = CASE
            WHEN NEW.tipo = 'entrada' AND (produto_estoque.saldo + delta) > 0 THEN
              ((produto_estoque.saldo * produto_estoque.custo_medio) + (delta * NEW.custo_unitario)) / (produto_estoque.saldo + delta)
            ELSE produto_estoque.custo_medio
          END,
          updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_aplicar_mov_estoque
  AFTER INSERT ON public.movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_movimentacao_estoque();

-- ============ PEDIDOS DE VENDA ============
DO $$ BEGIN
  CREATE TYPE public.situacao_pedido_venda AS ENUM ('em_aberto','aprovado','atendido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.pedidos_venda_numero_seq;

CREATE TABLE IF NOT EXISTS public.pedidos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vendedor_id uuid REFERENCES auth.users(id),
  situacao public.situacao_pedido_venda NOT NULL DEFAULT 'em_aberto',
  data_pedido date NOT NULL DEFAULT CURRENT_DATE,
  data_prevista date,
  forma_pagamento text,
  frete numeric(14,2) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_produtos numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  codigo_externo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero)
);
CREATE INDEX IF NOT EXISTS pv_cliente_idx ON public.pedidos_venda(cliente_id);
CREATE INDEX IF NOT EXISTS pv_situacao_idx ON public.pedidos_venda(situacao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda TO authenticated;
GRANT ALL ON public.pedidos_venda TO service_role;
ALTER TABLE public.pedidos_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pv_select_auth" ON public.pedidos_venda FOR SELECT TO authenticated USING (true);
CREATE POLICY "pv_write_priv" ON public.pedidos_venda FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'PV-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.pedidos_venda_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pv_numero BEFORE INSERT ON public.pedidos_venda
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_pedido_venda();
CREATE TRIGGER trg_pv_updated BEFORE UPDATE ON public.pedidos_venda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pedidos_venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(14,4) NOT NULL DEFAULT 1,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS ((quantidade * valor_unitario) - desconto) STORED,
  ordem int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pvi_pedido_idx ON public.pedidos_venda_itens(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda_itens TO authenticated;
GRANT ALL ON public.pedidos_venda_itens TO service_role;
ALTER TABLE public.pedidos_venda_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pvi_select_auth" ON public.pedidos_venda_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "pvi_write_priv" ON public.pedidos_venda_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

-- ============ PEDIDOS DE COMPRA ============
DO $$ BEGIN
  CREATE TYPE public.situacao_pedido_compra AS ENUM ('em_aberto','aprovado','recebido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.pedidos_compra_numero_seq;

CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  fornecedor_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  situacao public.situacao_pedido_compra NOT NULL DEFAULT 'em_aberto',
  data_pedido date NOT NULL DEFAULT CURRENT_DATE,
  data_prevista date,
  forma_pagamento text,
  frete numeric(14,2) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_produtos numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  codigo_externo text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero)
);
CREATE INDEX IF NOT EXISTS pc_forn_idx ON public.pedidos_compra(fornecedor_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT ALL ON public.pedidos_compra TO service_role;
ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc_select_auth" ON public.pedidos_compra FOR SELECT TO authenticated USING (true);
CREATE POLICY "pc_write_priv" ON public.pedidos_compra FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

CREATE OR REPLACE FUNCTION public.gerar_numero_pedido_compra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'PC-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.pedidos_compra_numero_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_pc_numero BEFORE INSERT ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_pedido_compra();
CREATE TRIGGER trg_pc_updated BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.pedidos_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  quantidade numeric(14,4) NOT NULL DEFAULT 1,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS ((quantidade * valor_unitario) - desconto) STORED,
  ordem int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS pci_pedido_idx ON public.pedidos_compra_itens(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra_itens TO authenticated;
GRANT ALL ON public.pedidos_compra_itens TO service_role;
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pci_select_auth" ON public.pedidos_compra_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "pci_write_priv" ON public.pedidos_compra_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

-- ============ CONTAS BANCÁRIAS ============
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_bancarias TO authenticated;
GRANT ALL ON public.contas_bancarias TO service_role;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_select_auth" ON public.contas_bancarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "cb_write_priv" ON public.contas_bancarias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_cb_updated BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CATEGORIAS FINANCEIRAS ============
CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  parent_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_financeiras TO authenticated;
GRANT ALL ON public.categorias_financeiras TO service_role;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cf_select_auth" ON public.categorias_financeiras FOR SELECT TO authenticated USING (true);
CREATE POLICY "cf_write_priv" ON public.categorias_financeiras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_cf_updated BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTENSÃO LANÇAMENTOS FINANCEIROS ============
ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS competencia date,
  ADD COLUMN IF NOT EXISTS pedido_venda_id uuid REFERENCES public.pedidos_venda(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS codigo_externo text;

-- ============ IMPORTAÇÕES ============
DO $$ BEGIN
  CREATE TYPE public.tipo_importacao AS ENUM ('clientes','produtos','pedidos_venda','contas_pagar','contas_receber');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_importacao AS ENUM ('processando','concluida','erro','parcial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.importacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_importacao NOT NULL,
  origem text NOT NULL DEFAULT 'bling',
  arquivo_nome text,
  total_linhas int NOT NULL DEFAULT 0,
  linhas_sucesso int NOT NULL DEFAULT 0,
  linhas_erro int NOT NULL DEFAULT 0,
  status public.status_importacao NOT NULL DEFAULT 'processando',
  detalhes jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS imp_log_tipo_idx ON public.importacoes_log(tipo);
CREATE INDEX IF NOT EXISTS imp_log_created_at_idx ON public.importacoes_log(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_log TO authenticated;
GRANT ALL ON public.importacoes_log TO service_role;
ALTER TABLE public.importacoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "implog_select_priv" ON public.importacoes_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "implog_write_priv" ON public.importacoes_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

CREATE TABLE IF NOT EXISTS public.importacoes_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.importacoes_log(id) ON DELETE CASCADE,
  linha int NOT NULL,
  campo text,
  mensagem text NOT NULL,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS imp_err_imp_idx ON public.importacoes_erros(importacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes_erros TO authenticated;
GRANT ALL ON public.importacoes_erros TO service_role;
ALTER TABLE public.importacoes_erros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imperr_select_priv" ON public.importacoes_erros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "imperr_write_priv" ON public.importacoes_erros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor') OR public.has_role(auth.uid(),'financeiro'));

-- Categorias padrão
INSERT INTO public.categorias_financeiras (nome, tipo, ordem) VALUES
  ('Vendas de Produtos', 'receita', 10),
  ('Prestação de Serviços', 'receita', 20),
  ('Outras Receitas', 'receita', 90),
  ('Fornecedores', 'despesa', 10),
  ('Salários e Encargos', 'despesa', 20),
  ('Impostos', 'despesa', 30),
  ('Despesas Administrativas', 'despesa', 40),
  ('Outras Despesas', 'despesa', 90)
ON CONFLICT DO NOTHING;
