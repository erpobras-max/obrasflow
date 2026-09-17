CREATE TABLE IF NOT EXISTS public.estoque_obra (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id     uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  saldo       numeric(10,3) NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(obra_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  material_id   uuid NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('entrada','saida','transferencia','ajuste')),
  quantidade    numeric(10,3) NOT NULL,
  saldo_apos    numeric(10,3) NOT NULL,
  pedido_id     uuid REFERENCES public.pedidos_compra(id) ON DELETE SET NULL,
  etapa_id      uuid, -- Sem restrição de chave estrangeira pois a tabela obras_etapas não existe fisicamente
  responsavel   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_obra_material ON public.estoque_obra(obra_id, material_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_obra    ON public.movimentacoes_estoque(obra_id, created_at DESC);

ALTER TABLE public.estoque_obra           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_estoque"       ON public.estoque_obra           FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_movimentacoes" ON public.movimentacoes_estoque  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- Função: movimentar estoque com atualização de saldo
CREATE OR REPLACE FUNCTION public.movimentar_estoque(
  p_obra_id     uuid,
  p_material_id uuid,
  p_tipo        text,
  p_quantidade  numeric,
  p_pedido_id   uuid DEFAULT NULL,
  p_etapa_id    uuid DEFAULT NULL,
  p_observacao  text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_saldo_atual numeric;
  v_saldo_novo  numeric;
BEGIN
  -- Busca ou cria registro de saldo
  INSERT INTO public.estoque_obra (obra_id, material_id, saldo)
  VALUES (p_obra_id, p_material_id, 0)
  ON CONFLICT (obra_id, material_id) DO NOTHING;

  SELECT saldo INTO v_saldo_atual
  FROM public.estoque_obra
  WHERE obra_id = p_obra_id AND material_id = p_material_id;

  -- Calcula novo saldo
  IF p_tipo IN ('entrada', 'ajuste') THEN
    v_saldo_novo := v_saldo_atual + p_quantidade;
  ELSIF p_tipo = 'saida' THEN
    v_saldo_novo := v_saldo_atual - p_quantidade;
    IF v_saldo_novo < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída';
    END IF;
  ELSIF p_tipo = 'transferencia' THEN
    -- A transferência no contexto da obra atual funciona como uma saída
    v_saldo_novo := v_saldo_atual - p_quantidade;
    IF v_saldo_novo < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para saída';
    END IF;
  ELSE
    v_saldo_novo := v_saldo_atual;
  END IF;

  -- Atualiza saldo
  UPDATE public.estoque_obra SET saldo = v_saldo_novo, updated_at = now()
  WHERE obra_id = p_obra_id AND material_id = p_material_id;

  -- Registra movimentação
  INSERT INTO public.movimentacoes_estoque
    (obra_id, material_id, tipo, quantidade, saldo_apos, pedido_id, etapa_id, responsavel, observacao)
  VALUES
    (p_obra_id, p_material_id, p_tipo, p_quantidade, v_saldo_novo,
     p_pedido_id, p_etapa_id, auth.uid(), p_observacao);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.movimentar_estoque(uuid, uuid, text, numeric, uuid, uuid, text) TO authenticated;
