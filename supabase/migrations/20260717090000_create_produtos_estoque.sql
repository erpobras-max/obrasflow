-- 1. Remover tabelas antigas de materiais e estoque de obra e chaves estrangeiras
ALTER TABLE IF EXISTS public.solicitacao_itens DROP CONSTRAINT IF EXISTS solicitacao_itens_material_id_fkey;
ALTER TABLE IF EXISTS public.pedido_itens DROP CONSTRAINT IF EXISTS pedido_itens_material_id_fkey;

DROP TABLE IF EXISTS public.movimentacoes_estoque CASCADE;
DROP TABLE IF EXISTS public.estoque_obra CASCADE;
DROP TABLE IF EXISTS public.materiais CASCADE;

-- 2. Criar a tabela de produtos
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

-- Renomear material_id para produto_id nas tabelas associadas e adicionar novas chaves estrangeiras
ALTER TABLE IF EXISTS public.solicitacao_itens RENAME COLUMN material_id TO produto_id;
ALTER TABLE IF EXISTS public.pedido_itens RENAME COLUMN material_id TO produto_id;

ALTER TABLE IF EXISTS public.solicitacao_itens ADD CONSTRAINT solicitacao_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.pedido_itens ADD CONSTRAINT pedido_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE SET NULL;

-- 3. Criar a tabela de depósitos (Warehouses)
CREATE TABLE IF NOT EXISTS public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir depósito padrão
INSERT INTO public.depositos (nome, codigo, ativo) 
VALUES ('Depósito Geral', 'DPG', true) 
ON CONFLICT (codigo) DO NOTHING;

-- 4. Criar a tabela de saldos de produto por depósito
CREATE TABLE IF NOT EXISTS public.produto_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  saldo numeric(10,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_produto_deposito UNIQUE (produto_id, deposito_id)
);

-- 5. Criar a tabela de movimentações de estoque de produtos
CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  deposito_destino_id uuid REFERENCES public.depositos(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  quantidade numeric(10,3) NOT NULL,
  custo_unitario numeric(14,2) NOT NULL DEFAULT 0,
  saldo_apos numeric(10,3) NOT NULL,
  custo_medio_apos numeric(14,2) NOT NULL DEFAULT 0,
  observacao text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Habilitar RLS nas tabelas
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

-- 7. Grant de privilégios para usuários autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.depositos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_estoque TO authenticated;

-- 8. Políticas de RLS
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "produtos_all" ON public.produtos FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'compras') OR 
  public.has_role(auth.uid(), 'almoxarifado')
);

CREATE POLICY "depositos_select" ON public.depositos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "depositos_all" ON public.depositos FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor')
);

CREATE POLICY "produto_estoque_select" ON public.produto_estoque FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "produto_estoque_all" ON public.produto_estoque FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'compras') OR 
  public.has_role(auth.uid(), 'almoxarifado')
);

CREATE POLICY "movimentacoes_estoque_select" ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "movimentacoes_estoque_all" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'diretor') OR 
  public.has_role(auth.uid(), 'compras') OR 
  public.has_role(auth.uid(), 'almoxarifado')
);

-- Triggers de updated_at para manter integridade
CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_depositos_updated BEFORE UPDATE ON public.depositos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Função PL/pgSQL para controle de estoque e cálculo de custo médio ponderado
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_produto(
  p_produto_id uuid,
  p_deposito_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_custo_unitario numeric,
  p_deposito_destino_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_saldo_atual numeric := 0;
  v_custo_medio_atual numeric := 0;
  v_saldo_novo numeric := 0;
  v_custo_medio_novo numeric := 0;
  v_preco_custo_produto numeric := 0;
BEGIN
  -- Obter saldo atual
  SELECT COALESCE(saldo, 0) INTO v_saldo_atual
  FROM public.produto_estoque
  WHERE produto_id = p_produto_id AND deposito_id = p_deposito_id;

  -- Obter preço de custo cadastrado do produto
  SELECT COALESCE(preco_custo, 0) INTO v_preco_custo_produto
  FROM public.produtos
  WHERE id = p_produto_id;
  
  -- Para custo médio atual, busca a última movimentação ou usa o preco_custo cadastrado
  SELECT COALESCE(custo_medio_apos, v_preco_custo_produto) INTO v_custo_medio_atual
  FROM public.movimentacoes_estoque
  WHERE produto_id = p_produto_id AND deposito_id = p_deposito_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Calcular novos valores conforme o tipo de movimentação
  IF p_tipo = 'entrada' THEN
    v_saldo_novo := v_saldo_atual + p_quantidade;
    IF v_saldo_novo > 0 THEN
      v_custo_medio_novo := ((v_saldo_atual * v_custo_medio_atual) + (p_quantidade * p_custo_unitario)) / v_saldo_novo;
    ELSE
      v_custo_medio_novo := p_custo_unitario;
    END IF;
    
    -- Atualizar o preco_custo global do produto
    UPDATE public.produtos SET preco_custo = v_custo_medio_novo WHERE id = p_produto_id;

  ELSIF p_tipo = 'saida' THEN
    v_saldo_novo := v_saldo_atual - p_quantidade;
    v_custo_medio_novo := v_custo_medio_atual;
    IF v_saldo_novo < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente no depósito de origem para saída (Solicitado: %, Disponível: %).', p_quantidade, v_saldo_atual;
    END IF;

  ELSIF p_tipo = 'ajuste' THEN
    -- No ajuste o valor de p_quantidade é o novo saldo absoluto
    v_saldo_novo := p_quantidade;
    v_custo_medio_novo := CASE WHEN p_custo_unitario > 0 THEN p_custo_unitario ELSE v_custo_medio_atual END;
    
    UPDATE public.produtos SET preco_custo = v_custo_medio_novo WHERE id = p_produto_id;

  ELSIF p_tipo = 'transferencia' THEN
    IF p_deposito_destino_id IS NULL THEN
      RAISE EXCEPTION 'Depósito de destino é obrigatório para transferências.';
    END IF;
    
    -- Saída do depósito de origem
    v_saldo_novo := v_saldo_atual - p_quantidade;
    v_custo_medio_novo := v_custo_medio_atual;
    IF v_saldo_novo < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente no depósito de origem para transferência.';
    END IF;

  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido.';
  END IF;

  -- Gravar saldo no depósito de origem
  INSERT INTO public.produto_estoque (produto_id, deposito_id, saldo, updated_at)
  VALUES (p_produto_id, p_deposito_id, v_saldo_novo, now())
  ON CONFLICT (produto_id, deposito_id) DO UPDATE
  SET saldo = v_saldo_novo, updated_at = now();

  -- Inserir registro de movimentação de origem
  INSERT INTO public.movimentacoes_estoque (
    produto_id, deposito_id, deposito_destino_id, tipo, quantidade, custo_unitario, saldo_apos, custo_medio_apos, observacao, usuario_id
  ) VALUES (
    p_produto_id, p_deposito_id, p_deposito_destino_id, p_tipo, p_quantidade, p_custo_unitario, v_saldo_novo, v_custo_medio_novo, p_observacao, auth.uid()
  );

  -- Se for transferência, processar a entrada no depósito de destino
  IF p_tipo = 'transferencia' THEN
    DECLARE
      v_saldo_dest numeric := 0;
      v_custo_dest numeric := 0;
      v_saldo_dest_novo numeric := 0;
    BEGIN
      SELECT COALESCE(saldo, 0) INTO v_saldo_dest
      FROM public.produto_estoque
      WHERE produto_id = p_produto_id AND deposito_id = p_deposito_destino_id;

      SELECT COALESCE(custo_medio_apos, v_preco_custo_produto) INTO v_custo_dest
      FROM public.movimentacoes_estoque
      WHERE produto_id = p_produto_id AND deposito_id = p_deposito_destino_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1;

      v_saldo_dest_novo := v_saldo_dest + p_quantidade;

      -- Gravar saldo no depósito de destino
      INSERT INTO public.produto_estoque (produto_id, deposito_id, saldo, updated_at)
      VALUES (p_produto_id, p_deposito_destino_id, v_saldo_dest_novo, now())
      ON CONFLICT (produto_id, deposito_id) DO UPDATE
      SET saldo = v_saldo_dest_novo, updated_at = now();

      -- Registrar movimentação de entrada no destino
      INSERT INTO public.movimentacoes_estoque (
        produto_id, deposito_id, deposito_destino_id, tipo, quantidade, custo_unitario, saldo_apos, custo_medio_apos, observacao, usuario_id
      ) VALUES (
        p_produto_id, p_deposito_destino_id, NULL, 'entrada', p_quantidade, v_custo_medio_atual, v_saldo_dest_novo, v_custo_medio_atual, 'Transferência recebida do depósito de origem', auth.uid()
      );
    END;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_produto(uuid, uuid, text, numeric, numeric, uuid, text) TO authenticated;
