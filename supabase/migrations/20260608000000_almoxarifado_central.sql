-- 1. Alter public.obras to add is_central and drop NOT NULL constraint on cliente_id
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS is_central boolean NOT NULL DEFAULT false;
ALTER TABLE public.obras ALTER COLUMN cliente_id DROP NOT NULL;

-- 2. Insert the Almoxarifado Central special obra
INSERT INTO public.obras (nome, numero, cliente_id, status, is_central)
VALUES ('Almoxarifado Central', 'CENTRAL', NULL, 'em_andamento', true)
ON CONFLICT (numero) DO UPDATE
SET is_central = EXCLUDED.is_central, cliente_id = EXCLUDED.cliente_id;

-- 3. Create public.transferir_estoque RPC function
CREATE OR REPLACE FUNCTION public.transferir_estoque(
  p_origem_obra_id  uuid,
  p_destino_obra_id uuid,
  p_material_id     uuid,
  p_quantidade      numeric,
  p_observacao      text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_saldo_origem numeric;
BEGIN
  -- 1. Verify/create stock records
  INSERT INTO public.estoque_obra (obra_id, material_id, saldo)
  VALUES (p_origem_obra_id, p_material_id, 0)
  ON CONFLICT (obra_id, material_id) DO NOTHING;

  INSERT INTO public.estoque_obra (obra_id, material_id, saldo)
  VALUES (p_destino_obra_id, p_material_id, 0)
  ON CONFLICT (obra_id, material_id) DO NOTHING;

  -- 2. Check source stock
  SELECT saldo INTO v_saldo_origem
  FROM public.estoque_obra
  WHERE obra_id = p_origem_obra_id AND material_id = p_material_id;

  IF v_saldo_origem < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no Almoxarifado de Origem (Saldo: %, Requerido: %)', v_saldo_origem, p_quantidade;
  END IF;

  -- 3. Subtract from source
  UPDATE public.estoque_obra
  SET saldo = saldo - p_quantidade, updated_at = now()
  WHERE obra_id = p_origem_obra_id AND material_id = p_material_id;

  -- 4. Add to destination
  UPDATE public.estoque_obra
  SET saldo = saldo + p_quantidade, updated_at = now()
  WHERE obra_id = p_destino_obra_id AND material_id = p_material_id;

  -- 5. Record source output log
  INSERT INTO public.movimentacoes_estoque
    (obra_id, material_id, tipo, quantidade, saldo_apos, responsavel, observacao)
  VALUES
    (p_origem_obra_id, p_material_id, 'transferencia', p_quantidade, v_saldo_origem - p_quantidade, auth.uid(), 
     COALESCE(p_observacao, 'Transferência de estoque enviada para obra destino'));

  -- 6. Record destination input log
  INSERT INTO public.movimentacoes_estoque
    (obra_id, material_id, tipo, quantidade, saldo_apos, responsavel, observacao)
  VALUES
    (p_destino_obra_id, p_material_id, 'transferencia', p_quantidade, 
     (SELECT saldo FROM public.estoque_obra WHERE obra_id = p_destino_obra_id AND material_id = p_material_id), 
     auth.uid(), COALESCE(p_observacao, 'Transferência de estoque recebida da origem'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferir_estoque(uuid, uuid, uuid, numeric, text) TO authenticated;
