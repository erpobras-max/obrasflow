-- Exclusão administrativa de solicitações e cotações de compra.
-- Pedidos já gerados preservam a rastreabilidade e impedem a exclusão.

CREATE OR REPLACE FUNCTION public.admin_excluir_cotacao_compra(p_cotacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir cotações';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cotacoes_compra WHERE id = p_cotacao_id) THEN
    RAISE EXCEPTION 'Cotação não encontrada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cotacoes_pedidos WHERE cotacao_id = p_cotacao_id) THEN
    RAISE EXCEPTION 'Esta cotação já gerou pedido(s) e não pode ser excluída';
  END IF;

  DELETE FROM public.cotacoes_compra WHERE id = p_cotacao_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_excluir_solicitacao_compra(p_solicitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir solicitações';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.solicitacoes_compra WHERE id = p_solicitacao_id) THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cotacoes_pedidos p
    JOIN public.cotacoes_compra c ON c.id = p.cotacao_id
    WHERE c.solicitacao_id = p_solicitacao_id
  ) THEN
    RAISE EXCEPTION 'Esta solicitação já gerou pedido(s) e não pode ser excluída';
  END IF;

  DELETE FROM public.cotacoes_compra WHERE solicitacao_id = p_solicitacao_id;
  DELETE FROM public.solicitacoes_compra WHERE id = p_solicitacao_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_excluir_cotacao_compra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_excluir_cotacao_compra(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_excluir_solicitacao_compra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_excluir_solicitacao_compra(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
