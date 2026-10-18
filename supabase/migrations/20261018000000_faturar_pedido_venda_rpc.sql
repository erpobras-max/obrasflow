-- ============================================================================
-- RPC explícita para faturar pedido de venda, substituindo o padrão frágil
-- de disparar triggers via update "dummy" da coluna updated_at.
--
-- A função:
-- 1. Valida que o pedido existe e não está atendido
-- 2. Valida que o usuário tem permissão (admin, diretor, financeiro)
-- 3. Para cada item, chama registrar_movimentacao_produto (tipo 'saida')
-- 4. Insere contas_receber com vencimento 30 dias
-- 5. Atualiza situacao = 'atendido' e atualiza observacoes
-- 6. Retorna JSON com sucesso e resumo
--
-- Ao usar esta RPC, os códigos frontend (importacoes.functions.ts e
-- vendas.pedidos.tsx) devem substituir os updates dummy por chamadas a ela.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.faturar_pedido_venda(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido record;
  v_item record;
  v_cliente_nome text;
  v_itens_processados integer := 0;
  v_valor_total_centavos bigint;
BEGIN
  -- Verificação de autenticação e autorização
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin')
     AND NOT public.has_role(auth.uid(), 'diretor')
     AND NOT public.has_role(auth.uid(), 'financeiro_civil') THEN
    RAISE EXCEPTION 'Apenas administradores, diretores e financeiro civil podem faturar pedidos de venda.'
      USING ERRCODE = '42501';
  END IF;

  -- Travar o pedido para evitar concorrência
  SELECT pv.id, pv.numero, pv.cliente_id, pv.deposito_id,
         pv.situacao, pv.valor_total,
         c.nome as cliente_nome
    INTO v_pedido
    FROM public.pedidos_venda pv
    JOIN public.clientes c ON c.id = pv.cliente_id
   WHERE pv.id = p_pedido_id
     FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.' USING ERRCODE = 'P0001';
  END IF;

  IF v_pedido.situacao = 'atendido' THEN
    RAISE EXCEPTION 'Pedido já faturado (situação: atendido).' USING ERRCODE = 'P0002';
  END IF;

  IF v_pedido.situacao = 'cancelado' THEN
    RAISE EXCEPTION 'Pedido cancelado não pode ser faturado.' USING ERRCODE = 'P0003';
  END IF;

  -- Converter valor_total para centavos (financeiro armazena bigint)
  v_valor_total_centavos := ROUND(v_pedido.valor_total * 100)::bigint;

  -- Processar cada item do pedido (baixa de estoque)
  FOR v_item IN
    SELECT produto_id, quantidade, valor_unitario
      FROM public.pedidos_venda_itens
     WHERE pedido_venda_id = p_pedido_id
  LOOP
    PERFORM public.registrar_movimentacao_produto(
      v_item.produto_id,
      v_pedido.deposito_id,
      'saida',
      v_item.quantidade,
      0, -- custo_unitario zero (saída não afeta custo médio)
      NULL, -- deposito_destino_id
      'Faturamento de pedido #' || v_pedido.numero
    );
    v_itens_processados := v_itens_processados + 1;
  END LOOP;

  -- Registrar conta a receber (vencimento em 30 dias)
  INSERT INTO public.contas_receber (
    cliente_id,
    pedido_venda_id,
    descricao,
    valor_total,
    data_vencimento,
    status,
    forma_pagamento,
    observacoes
  ) VALUES (
    v_pedido.cliente_id,
    v_pedido.id,
    'Faturamento de Pedido de Venda #' || v_pedido.numero || ' — ' || v_pedido.cliente_nome,
    v_valor_total_centavos,
    (CURRENT_DATE + INTERVAL '30 days')::date,
    'aberta',
    NULL,
    'Faturamento via RPC explícita – ' || CURRENT_TIMESTAMP::text
  );

  -- Marcar pedido como atendido
  UPDATE public.pedidos_venda
     SET situacao = 'atendido',
         observacoes = COALESCE(observacoes || ' ', '') || 'Faturado em ' || CURRENT_TIMESTAMP::text,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = p_pedido_id;

  -- Registrar log de auditoria (opcional, mas útil)
  INSERT INTO public.importacoes_log (
    arquivo, tipo, total_linhas, sucesso, erros, usuario_id, data
  ) VALUES (
    'RPC faturar_pedido_venda', 'faturamento_pedido', 1, 1, 0, auth.uid(), CURRENT_TIMESTAMP
  );

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero', v_pedido.numero,
    'itens_processados', v_itens_processados,
    'valor_total_centavos', v_valor_total_centavos,
    'mensagem', 'Pedido faturado com sucesso. Conta a receber gerada.'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, garantir rollback da transação (ROLLBACK implícito)
    RAISE;
END;
$$;

-- Garantir permissões: authenticated pode executar, mas a função valida perfil internamente
REVOKE ALL ON FUNCTION public.faturar_pedido_venda(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.faturar_pedido_venda(uuid) TO authenticated;

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Comentários de documentação
-- ============================================================================
COMMENT ON FUNCTION public.faturar_pedido_venda(uuid) IS
'Fatura um pedido de venda: baixa estoque, gera conta a receber e marca como atendido.
Substitui o padrão antigo de disparar triggers via update dummy de updated_at.
Permissões: admin, diretor, financeiro_civil.';