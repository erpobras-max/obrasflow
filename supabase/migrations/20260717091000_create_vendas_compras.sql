-- 1. Criar a tabela de pedidos de venda
CREATE TABLE IF NOT EXISTS public.pedidos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  vendedor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id),
  situacao text NOT NULL DEFAULT 'em_aberto' CHECK (situacao IN ('em_aberto', 'atendido', 'cancelado')),
  forma_pagamento text,
  valor_frete numeric(14,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(14,2) NOT NULL DEFAULT 0,
  valor_produtos numeric(14,2) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  observacoes text,
  
  -- NF-e placeholders
  nfe_chave text,
  nfe_numero text,
  nfe_status text NOT NULL DEFAULT 'rascunho' CHECK (nfe_status IN ('rascunho', 'processando', 'autorizada', 'cancelada', 'rejeitada')),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Criar a tabela de itens do pedido de venda
CREATE TABLE IF NOT EXISTS public.pedidos_venda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_venda_id uuid NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade numeric(10,3) NOT NULL,
  valor_unitario numeric(14,2) NOT NULL,
  valor_total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Adicionar colunas de relacionamento no financeiro
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS pedido_venda_id uuid REFERENCES public.pedidos_venda(id) ON DELETE SET NULL;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS pedido_venda_id uuid REFERENCES public.pedidos_venda(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS pedido_venda_id uuid REFERENCES public.pedidos_venda(id) ON DELETE SET NULL;
ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS pedido_compra_id uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

-- 4. Habilitar RLS
ALTER TABLE public.pedidos_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_venda_itens ENABLE ROW LEVEL SECURITY;

-- 5. Grant de privilégios
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_venda_itens TO authenticated;

-- 6. Políticas de RLS
CREATE POLICY "pedidos_venda_select" ON public.pedidos_venda FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pedidos_venda_all" ON public.pedidos_venda FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro') OR 
  public.has_role(auth.uid(), 'compras')
);

CREATE POLICY "pedidos_venda_itens_select" ON public.pedidos_venda_itens FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "pedidos_venda_itens_all" ON public.pedidos_venda_itens FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'financeiro') OR 
  public.has_role(auth.uid(), 'compras')
);

-- Triggers de updated_at para manter integridade
CREATE TRIGGER trg_pedidos_venda_updated BEFORE UPDATE ON public.pedidos_venda
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Trigger para baixa automática de estoque e lançamento financeiro
CREATE OR REPLACE FUNCTION public.trg_baixa_estoque_e_faturamento_venda()
RETURNS TRIGGER AS $$
DECLARE
  v_item record;
  v_cliente_nome text;
BEGIN
  -- Se o pedido foi marcado como 'atendido' e antes não estava
  IF NEW.situacao = 'atendido' AND (OLD.situacao IS NULL OR OLD.situacao <> 'atendido') THEN
    
    -- Obter nome do cliente
    SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = NEW.cliente_id;

    -- Baixar estoque para cada item
    FOR v_item IN 
      SELECT produto_id, quantidade, valor_unitario 
      FROM public.pedidos_venda_itens 
      WHERE pedido_venda_id = NEW.id
    LOOP
      PERFORM public.registrar_movimentacao_produto(
        v_item.produto_id,
        NEW.deposito_id,
        'saida',
        v_item.quantidade,
        0, -- Saída não afeta o custo médio
        NULL,
        'Baixa automática — Pedido de Venda #' || NEW.numero
      );
    END LOOP;

    -- Lançar contas a receber automaticamente no financeiro
    -- O valor total no financeiro (contas_receber) é armazenado em CENTAVOS (bigint)
    INSERT INTO public.contas_receber (
      cliente_id,
      pedido_venda_id,
      descricao,
      valor_total,
      data_vencimento,
      status,
      observacoes
    ) VALUES (
      NEW.cliente_id,
      NEW.id,
      'Faturamento de Pedido de Venda #' || NEW.numero || ' — ' || COALESCE(v_cliente_nome, ''),
      (CURRENT_DATE + INTERVAL '30 days')::date,
      'aberta',
      'Lançamento financeiro gerado automaticamente pelo faturamento do pedido de venda #' || NEW.numero
    );

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_pedidos_venda_atendido
AFTER UPDATE ON public.pedidos_venda
FOR EACH ROW
EXECUTE FUNCTION public.trg_baixa_estoque_e_faturamento_venda();
