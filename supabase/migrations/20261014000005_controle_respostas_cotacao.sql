-- Permite pausar e reabrir respostas públicas sem invalidar os links já enviados.
ALTER TABLE public.cotacoes_compra
  ADD COLUMN IF NOT EXISTS respostas_habilitadas boolean NOT NULL DEFAULT true;

-- O fornecedor continua podendo consultar o pedido, mas recebe a indicação de que
-- o envio está suspenso. A validação definitiva também ocorre nas RPCs de escrita.
CREATE OR REPLACE FUNCTION public.obter_cotacao_publica(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'convite', jsonb_build_object('id', cf.id, 'token', cf.token, 'status', cf.status, 'respondido_em', cf.respondido_em, 'motivo_recusa', cf.motivo_recusa),
    'fornecedor', jsonb_build_object('id', f.id, 'razao_social', f.razao_social),
    'cotacao', jsonb_build_object('id', c.id, 'numero', c.numero, 'prazo_resposta', c.prazo_resposta, 'observacoes', c.observacoes, 'obra_id', c.obra_id, 'respostas_habilitadas', c.respostas_habilitadas),
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade, 'ordem', i.ordem) ORDER BY i.ordem) FROM cotacoes_itens i WHERE i.cotacao_id = c.id), '[]'::jsonb),
    'proposta', (SELECT to_jsonb(p) - 'id' FROM cotacoes_propostas p WHERE p.cotacao_fornecedor_id = cf.id),
    'respostas', COALESCE((SELECT jsonb_agg(to_jsonb(r) - 'id') FROM cotacoes_respostas r WHERE r.cotacao_fornecedor_id = cf.id), '[]'::jsonb)
  ) INTO v
  FROM cotacoes_fornecedores cf
  JOIN cotacoes_compra c ON c.id = cf.cotacao_id
  JOIN fornecedores f ON f.id = cf.fornecedor_id
  WHERE cf.token = p_token;
  IF v IS NULL THEN RETURN jsonb_build_object('error', 'Link inválido ou inexistente.'); END IF;
  UPDATE cotacoes_fornecedores
  SET status = 'visualizado', visualizado_em = now()
  WHERE token = p_token AND status = 'enviado';
  RETURN v;
END;
$$;

-- Rejeita novas propostas se a cotação foi suspensa depois do envio do link.
CREATE OR REPLACE FUNCTION public.responder_cotacao_publica(p_token uuid, p_respostas jsonb, p_proposta jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cf cotacoes_fornecedores%ROWTYPE; c cotacoes_compra%ROWTYPE; nome text; item jsonb;
BEGIN
  SELECT * INTO cf FROM cotacoes_fornecedores WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de cotação inválido'; END IF;
  SELECT * INTO c FROM cotacoes_compra WHERE id = cf.cotacao_id FOR UPDATE;
  IF NOT c.respostas_habilitadas THEN RAISE EXCEPTION 'Esta cotação está desativada para novas respostas'; END IF;
  IF c.prazo_resposta < current_date THEN RAISE EXCEPTION 'O prazo desta cotação já terminou'; END IF;
  IF cf.status IN ('respondido', 'recusado') THEN RAISE EXCEPTION 'Esta cotação já foi encerrada'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_respostas, '[]'::jsonb)) LOOP
    INSERT INTO cotacoes_respostas(cotacao_fornecedor_id, cotacao_item_id, valor_unitario, quantidade_ofertada, disponivel, observacao_item)
    VALUES (cf.id, (item->>'cotacao_item_id')::uuid, COALESCE((item->>'valor_unitario')::bigint, 0), NULLIF(item->>'quantidade_ofertada', '')::numeric, COALESCE((item->>'disponivel')::boolean, true), item->>'observacao_item')
    ON CONFLICT (cotacao_fornecedor_id, cotacao_item_id) DO UPDATE
    SET valor_unitario = excluded.valor_unitario, quantidade_ofertada = excluded.quantidade_ofertada,
        disponivel = excluded.disponivel, observacao_item = excluded.observacao_item, updated_at = now();
  END LOOP;
  INSERT INTO cotacoes_propostas(cotacao_fornecedor_id, frete, prazo_entrega_dias, condicao_pagamento, validade_proposta, observacoes)
  VALUES (cf.id, COALESCE((p_proposta->>'frete')::bigint, 0), NULLIF(p_proposta->>'prazo_entrega_dias', '')::integer,
          p_proposta->>'condicao_pagamento', NULLIF(p_proposta->>'validade_proposta', '')::date, p_proposta->>'observacoes')
  ON CONFLICT (cotacao_fornecedor_id) DO UPDATE
  SET frete = excluded.frete, prazo_entrega_dias = excluded.prazo_entrega_dias,
      condicao_pagamento = excluded.condicao_pagamento, validade_proposta = excluded.validade_proposta,
      observacoes = excluded.observacoes, updated_at = now();
  UPDATE cotacoes_fornecedores SET status = 'respondido', respondido_em = now() WHERE id = cf.id;
  SELECT razao_social INTO nome FROM fornecedores WHERE id = cf.fornecedor_id;
  INSERT INTO cotacoes_historico(cotacao_id, acao, descricao, dados)
  VALUES (cf.cotacao_id, 'proposta_recebida', 'Resposta recebida de ' || nome, jsonb_build_object('fornecedor_id', cf.fornecedor_id));
  INSERT INTO notificacoes_usuario(user_id, alerta_id)
  SELECT pu.user_id, 'cotacao-resposta-' || cf.id FROM perfis_usuarios pu
  WHERE pu.perfil IN ('admin', 'compras') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- A recusa é uma resposta do fornecedor e também respeita a suspensão.
CREATE OR REPLACE FUNCTION public.recusar_cotacao_publica(p_token uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cf cotacoes_fornecedores%ROWTYPE; habilitada boolean;
BEGIN
  SELECT * INTO cf FROM cotacoes_fornecedores WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de cotação inválido'; END IF;
  SELECT respostas_habilitadas INTO habilitada FROM cotacoes_compra WHERE id = cf.cotacao_id;
  IF NOT habilitada THEN RAISE EXCEPTION 'Esta cotação está desativada para novas respostas'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
  UPDATE cotacoes_fornecedores SET status = 'recusado', recusado_em = now(), motivo_recusa = trim(p_motivo) WHERE id = cf.id;
  INSERT INTO cotacoes_historico(cotacao_id, acao, descricao) VALUES (cf.cotacao_id, 'proposta_recusada', trim(p_motivo));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Impede anexos públicos novos durante a suspensão, evitando uploads órfãos.
CREATE OR REPLACE FUNCTION public.registrar_anexo_cotacao_publica(p_token uuid, p_nome text, p_path text, p_tamanho bigint, p_mime text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT cf.id INTO v_id
  FROM cotacoes_fornecedores cf
  JOIN cotacoes_compra c ON c.id = cf.cotacao_id
  WHERE cf.token = p_token AND cf.status NOT IN ('recusado', 'expirado') AND c.respostas_habilitadas;
  IF v_id IS NULL OR p_path NOT LIKE 'cotacao/%' THEN RAISE EXCEPTION 'Anexo não autorizado: a cotação pode estar desativada'; END IF;
  INSERT INTO cotacoes_anexos(cotacao_fornecedor_id, nome, bucket_path, tamanho_bytes, mime_type)
  VALUES (v_id, p_nome, p_path, p_tamanho, p_mime);
  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

