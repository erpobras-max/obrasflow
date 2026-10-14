-- ============================================================================
-- FASE 1: QR Code e movimentações do almoxarifado
-- Migration: 20261013000006_almoxarifado_qr
--
-- Saldo é controlado por produto e depósito.
-- Prateleira é apenas uma localização auxiliar.
-- Transferência fica fora do escopo desta fase.
--
-- Esta migration não altera RLS nem GRANTs de produto_estoque ou
-- movimentacoes_estoque. A restrição de escrita dessas tabelas ficará para a
-- migration 20261013000007.
-- ============================================================================

-- 1. QR Code dos produtos
-- ============================================================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS qr_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS produtos_qr_token_uidx
  ON public.produtos(qr_token);

-- 2. Prateleiras/localizações do depósito
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.estoque_prateleiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  descricao text,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT estoque_prateleiras_deposito_codigo_uidx UNIQUE (deposito_id, codigo),
  CONSTRAINT estoque_prateleiras_qr_token_uidx UNIQUE (qr_token)
);

CREATE INDEX IF NOT EXISTS estoque_prateleiras_deposito_idx
  ON public.estoque_prateleiras(deposito_id);

DROP TRIGGER IF EXISTS trg_estoque_prateleiras_updated
  ON public.estoque_prateleiras;

CREATE TRIGGER trg_estoque_prateleiras_updated
  BEFORE UPDATE ON public.estoque_prateleiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.estoque_prateleiras TO authenticated;
GRANT ALL ON public.estoque_prateleiras TO service_role;

ALTER TABLE public.estoque_prateleiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estoque_prateleiras_select"
  ON public.estoque_prateleiras;
DROP POLICY IF EXISTS "estoque_prateleiras_insert"
  ON public.estoque_prateleiras;
DROP POLICY IF EXISTS "estoque_prateleiras_update"
  ON public.estoque_prateleiras;
DROP POLICY IF EXISTS "estoque_prateleiras_delete"
  ON public.estoque_prateleiras;

CREATE POLICY "estoque_prateleiras_select"
  ON public.estoque_prateleiras
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "estoque_prateleiras_insert"
  ON public.estoque_prateleiras
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'almoxarifado')
  );

CREATE POLICY "estoque_prateleiras_update"
  ON public.estoque_prateleiras
  FOR UPDATE TO authenticated
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

CREATE POLICY "estoque_prateleiras_delete"
  ON public.estoque_prateleiras
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'almoxarifado')
  );

-- 3. Colunas novas no histórico existente
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE RESTRICT,
  prateleira_id uuid REFERENCES public.estoque_prateleiras(id) ON DELETE SET NULL,
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

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS obra_id uuid,
  ADD COLUMN IF NOT EXISTS prateleira_id uuid,
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS saldo_anterior numeric(14,4),
  ADD COLUMN IF NOT EXISTS saldo_apos numeric(14,4),
  ADD COLUMN IF NOT EXISTS custo_medio_apos numeric(14,4),
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS custo_unitario numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_movimento timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'movimentacoes_estoque_obra_id_fkey'
      AND conrelid = 'public.movimentacoes_estoque'::regclass
  ) THEN
    ALTER TABLE public.movimentacoes_estoque
      ADD CONSTRAINT movimentacoes_estoque_obra_id_fkey
      FOREIGN KEY (obra_id)
      REFERENCES public.obras(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'movimentacoes_estoque_prateleira_id_fkey'
      AND conrelid = 'public.movimentacoes_estoque'::regclass
  ) THEN
    ALTER TABLE public.movimentacoes_estoque
      ADD CONSTRAINT movimentacoes_estoque_prateleira_id_fkey
      FOREIGN KEY (prateleira_id)
      REFERENCES public.estoque_prateleiras(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS movimentacoes_estoque_obra_idx
  ON public.movimentacoes_estoque(obra_id, created_at DESC);

CREATE INDEX IF NOT EXISTS movimentacoes_estoque_prateleira_idx
  ON public.movimentacoes_estoque(prateleira_id, created_at DESC);

CREATE INDEX IF NOT EXISTS movimentacoes_estoque_user_idx
  ON public.movimentacoes_estoque(user_id, created_at DESC);

-- 4. Trigger compatível com a RPC e com inserções legadas
-- ============================================================================
-- A RPC marca a transação antes de inserir o histórico, porque ela já atualiza
-- o saldo explicitamente. O trigger ignora somente essa inserção marcada.
-- Inserções diretas legadas continuam atualizando o saldo pelo trigger.
CREATE OR REPLACE FUNCTION public.aplicar_movimentacao_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_delta numeric(14,4);
BEGIN
  IF current_setting('app.mov_ja_aplicada', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'entrada' THEN
    v_saldo_delta := NEW.quantidade;
  ELSIF NEW.tipo = 'saida' THEN
    v_saldo_delta := -NEW.quantidade;
  ELSIF NEW.tipo = 'ajuste' THEN
    v_saldo_delta := NEW.quantidade;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.produto_estoque (
    produto_id,
    deposito_id,
    saldo,
    updated_at
  )
  VALUES (
    NEW.produto_id,
    NEW.deposito_id,
    v_saldo_delta,
    now()
  )
  ON CONFLICT (produto_id, deposito_id) DO UPDATE
  SET saldo = public.produto_estoque.saldo + EXCLUDED.saldo,
      updated_at = now();

  RETURN NEW;
END;
$$;

-- 5. RPC transacional do almoxarifado
-- ============================================================================
DROP FUNCTION IF EXISTS public.registrar_movimentacao_almoxarifado(
  uuid, uuid, text, numeric, uuid, uuid, text, text, numeric
);

CREATE OR REPLACE FUNCTION public.registrar_movimentacao_almoxarifado(
  p_produto_id uuid,
  p_deposito_id uuid,
  p_tipo text,
  p_quantidade numeric,
  p_obra_id uuid DEFAULT NULL,
  p_prateleira_id uuid DEFAULT NULL,
  p_documento text DEFAULT NULL,
  p_justificativa text DEFAULT NULL,
  p_custo_unitario numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movimentacao_id uuid;
  v_saldo_atual numeric(14,4);
  v_saldo_novo numeric(14,4);
  v_preco_custo_produto numeric(14,4);
  v_custo_unitario numeric(14,4);
  v_custo_medio_atual numeric(14,4);
  v_custo_medio_novo numeric(14,4);
  v_produto_ativo boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.perfis_usuarios pu
    WHERE pu.user_id = auth.uid()
      AND pu.ativo = true
      AND pu.perfil IN ('admin', 'diretor', 'almoxarifado')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.perfis_usuarios pu ON pu.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND pu.ativo = true
      AND ur.role IN ('admin', 'diretor', 'almoxarifado')
  ) THEN
    RAISE EXCEPTION
      'Usuário sem cargo autorizado para registrar movimentações.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('entrada', 'saida', 'ajuste') THEN
    RAISE EXCEPTION 'Tipo inválido. Use entrada, saida ou ajuste.';
  END IF;

  IF p_quantidade IS NULL OR p_quantidade < 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior ou igual a zero.';
  END IF;

  IF p_tipo IN ('entrada', 'saida') AND p_quantidade = 0 THEN
    RAISE EXCEPTION 'A quantidade deve ser maior que zero.';
  END IF;

  IF p_tipo = 'saida' AND p_obra_id IS NULL THEN
    RAISE EXCEPTION 'obra_id é obrigatório para saída de estoque.';
  END IF;

  IF p_tipo = 'ajuste'
     AND NULLIF(trim(COALESCE(p_justificativa, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A justificativa é obrigatória para ajuste de saldo.';
  END IF;

  SELECT situacao::text = 'ativo', COALESCE(preco_custo, 0)
    INTO v_produto_ativo, v_preco_custo_produto
  FROM public.produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_produto_ativo THEN
    RAISE EXCEPTION 'Produto inexistente ou inativo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.depositos
    WHERE id = p_deposito_id
      AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Depósito inexistente ou inativo.';
  END IF;

  IF p_prateleira_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.estoque_prateleiras
       WHERE id = p_prateleira_id
         AND deposito_id = p_deposito_id
         AND ativo = true
     ) THEN
    RAISE EXCEPTION
      'Prateleira inexistente, inativa ou pertencente a outro depósito.';
  END IF;

  INSERT INTO public.produto_estoque (
    produto_id,
    deposito_id,
    saldo
  )
  VALUES (
    p_produto_id,
    p_deposito_id,
    0
  )
  ON CONFLICT (produto_id, deposito_id) DO NOTHING;

  SELECT saldo
    INTO v_saldo_atual
  FROM public.produto_estoque
  WHERE produto_id = p_produto_id
    AND deposito_id = p_deposito_id
  FOR UPDATE;

  v_custo_unitario := COALESCE(p_custo_unitario, v_preco_custo_produto);
  v_custo_medio_atual := v_preco_custo_produto;

  SELECT COALESCE(custo_medio_apos, v_preco_custo_produto)
    INTO v_custo_medio_atual
  FROM public.movimentacoes_estoque
  WHERE produto_id = p_produto_id
    AND deposito_id = p_deposito_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_custo_medio_atual := COALESCE(
    v_custo_medio_atual,
    v_preco_custo_produto
  );

  IF p_tipo = 'entrada' THEN
    v_saldo_novo := v_saldo_atual + p_quantidade;

    IF v_saldo_novo > 0 THEN
      v_custo_medio_novo := (
        (v_saldo_atual * v_custo_medio_atual) +
        (p_quantidade * v_custo_unitario)
      ) / v_saldo_novo;
    ELSE
      v_custo_medio_novo := v_custo_unitario;
    END IF;
  ELSIF p_tipo = 'saida' THEN
    IF p_quantidade > v_saldo_atual THEN
      RAISE EXCEPTION
        'Saldo insuficiente. Disponível: %, solicitado: %.',
        v_saldo_atual,
        p_quantidade;
    END IF;

    v_saldo_novo := v_saldo_atual - p_quantidade;
    v_custo_medio_novo := v_custo_medio_atual;
  ELSE
    -- Ajuste representa o novo saldo físico final.
    v_saldo_novo := p_quantidade;
    v_custo_medio_novo := CASE
      WHEN p_custo_unitario IS NULL AND v_custo_medio_atual > 0
        THEN v_custo_medio_atual
      ELSE v_custo_unitario
    END;
  END IF;

  IF p_tipo IN ('entrada', 'ajuste') THEN
    UPDATE public.produtos
    SET preco_custo = v_custo_medio_novo
    WHERE id = p_produto_id;
  END IF;

  PERFORM set_config('app.mov_ja_aplicada', 'on', true);

  BEGIN
    UPDATE public.produto_estoque
    SET saldo = v_saldo_novo,
        updated_at = now()
    WHERE produto_id = p_produto_id
      AND deposito_id = p_deposito_id;

    INSERT INTO public.movimentacoes_estoque (
      obra_id,
      produto_id,
      deposito_id,
      prateleira_id,
      tipo,
      quantidade,
      custo_unitario,
      saldo_anterior,
      saldo_apos,
      custo_medio_apos,
      documento,
      justificativa,
      observacao,
      user_id,
      usuario_id,
      created_at,
      data_movimento
    )
    VALUES (
      p_obra_id,
      p_produto_id,
      p_deposito_id,
      p_prateleira_id,
      p_tipo,
      p_quantidade,
      v_custo_unitario,
      v_saldo_atual,
      v_saldo_novo,
      v_custo_medio_novo,
      NULLIF(trim(p_documento), ''),
      NULLIF(trim(p_justificativa), ''),
      NULLIF(trim(p_justificativa), ''),
      auth.uid(),
      auth.uid(),
      now(),
      now()
    )
    RETURNING id INTO v_movimentacao_id;

    PERFORM set_config('app.mov_ja_aplicada', 'off', true);
  EXCEPTION
    WHEN OTHERS THEN
      PERFORM set_config('app.mov_ja_aplicada', 'off', true);
      RAISE;
  END;

  RETURN v_movimentacao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_almoxarifado(
  uuid, uuid, text, numeric, uuid, uuid, text, text, numeric
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.registrar_movimentacao_almoxarifado(
  uuid, uuid, text, numeric, uuid, uuid, text, text, numeric
) FROM anon;

GRANT EXECUTE ON FUNCTION public.registrar_movimentacao_almoxarifado(
  uuid, uuid, text, numeric, uuid, uuid, text, text, numeric
) TO authenticated;

-- 6. Recarrega o cache de schema do PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';
