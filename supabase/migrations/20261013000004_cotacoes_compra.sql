-- Módulo de cotações de compra: convites, respostas, comparação, pedidos e recebimentos.

DO $$ BEGIN
  CREATE TYPE public.cotacao_status AS ENUM ('rascunho','aberta','em_comparacao','aprovada','cancelada','vencida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.cotacao_fornecedor_status AS ENUM ('enviado','visualizado','respondido','recusado','expirado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.pedido_cotacao_status AS ENUM ('rascunho','aguardando_aprovacao','aprovado','enviado_fornecedor','parcialmente_recebido','recebido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cotacoes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero serial UNIQUE,
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_compra(id) ON DELETE RESTRICT,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  status public.cotacao_status NOT NULL DEFAULT 'rascunho', prazo_resposta date NOT NULL,
  criado_por uuid NOT NULL REFERENCES auth.users(id), aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz, observacoes text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status public.cotacao_fornecedor_status NOT NULL DEFAULT 'enviado', enviado_em timestamptz DEFAULT now(),
  visualizado_em timestamptz, respondido_em timestamptz, recusado_em timestamptz, motivo_recusa text,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(cotacao_id, fornecedor_id)
);
CREATE TABLE IF NOT EXISTS public.cotacoes_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  solicitacao_item_id uuid REFERENCES public.solicitacao_itens(id) ON DELETE SET NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL, descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL CHECK (quantidade > 0), unidade text NOT NULL DEFAULT 'un', ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_fornecedor_id uuid NOT NULL REFERENCES public.cotacoes_fornecedores(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.cotacoes_itens(id) ON DELETE CASCADE, valor_unitario bigint NOT NULL DEFAULT 0,
  quantidade_ofertada numeric(10,3), disponivel boolean NOT NULL DEFAULT true, observacao_item text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cotacao_fornecedor_id, cotacao_item_id)
);
CREATE TABLE IF NOT EXISTS public.cotacoes_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_fornecedor_id uuid NOT NULL REFERENCES public.cotacoes_fornecedores(id) ON DELETE CASCADE UNIQUE,
  frete bigint NOT NULL DEFAULT 0, prazo_entrega_dias integer, condicao_pagamento text, validade_proposta date,
  observacoes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_fornecedor_id uuid NOT NULL REFERENCES public.cotacoes_fornecedores(id) ON DELETE CASCADE,
  nome text NOT NULL, bucket_path text NOT NULL, tamanho_bytes bigint, mime_type text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_selecao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.cotacoes_itens(id) ON DELETE CASCADE,
  cotacao_fornecedor_id uuid NOT NULL REFERENCES public.cotacoes_fornecedores(id) ON DELETE RESTRICT,
  selecionado_por uuid NOT NULL REFERENCES auth.users(id), selecionado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cotacao_id, cotacao_item_id)
);
CREATE TABLE IF NOT EXISTS public.cotacoes_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero serial UNIQUE, cotacao_id uuid NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE RESTRICT,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT, obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  status public.pedido_cotacao_status NOT NULL DEFAULT 'aguardando_aprovacao', valor_total bigint NOT NULL DEFAULT 0, frete bigint NOT NULL DEFAULT 0,
  condicao_pagamento text, data_entrega_prev date, aprovado_por uuid REFERENCES auth.users(id), aprovado_em timestamptz,
  observacoes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_pedidos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES public.cotacoes_pedidos(id) ON DELETE CASCADE,
  cotacao_item_id uuid NOT NULL REFERENCES public.cotacoes_itens(id) ON DELETE RESTRICT, descricao text NOT NULL,
  quantidade numeric(10,3) NOT NULL, unidade text NOT NULL, valor_unitario bigint NOT NULL DEFAULT 0, qtd_recebida numeric(10,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pedido_id uuid NOT NULL REFERENCES public.cotacoes_pedidos(id) ON DELETE RESTRICT,
  recebido_por uuid NOT NULL REFERENCES auth.users(id), data_recebimento date NOT NULL DEFAULT current_date, observacoes text,
  gerou_conta_pagar boolean NOT NULL DEFAULT false, conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_recebimentos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recebimento_id uuid NOT NULL REFERENCES public.cotacoes_recebimentos(id) ON DELETE CASCADE,
  pedido_item_id uuid NOT NULL REFERENCES public.cotacoes_pedidos_itens(id) ON DELETE RESTRICT, quantidade_recebida numeric(10,3) NOT NULL CHECK (quantidade_recebida > 0), observacao text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cotacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.cotacoes_compra(id) ON DELETE CASCADE,
  pedido_id uuid REFERENCES public.cotacoes_pedidos(id) ON DELETE SET NULL, usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL, descricao text, dados jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS cotacao_pedido_id uuid REFERENCES public.cotacoes_pedidos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_cotacao_pedido_unique ON public.contas_pagar(cotacao_pedido_id) WHERE cotacao_pedido_id IS NOT NULL;
INSERT INTO storage.buckets(id, name, public) VALUES ('cotacoes-anexos', 'cotacoes-anexos', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS cotacoes_anexos_public_insert ON storage.objects;
CREATE POLICY cotacoes_anexos_public_insert ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'cotacoes-anexos' AND name LIKE 'cotacao/%');
DROP POLICY IF EXISTS cotacoes_anexos_auth_read ON storage.objects;
CREATE POLICY cotacoes_anexos_auth_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'cotacoes-anexos');
CREATE INDEX IF NOT EXISTS cotacoes_compra_solicitacao_idx ON public.cotacoes_compra(solicitacao_id);
CREATE INDEX IF NOT EXISTS cotacoes_compra_status_idx ON public.cotacoes_compra(status);
CREATE INDEX IF NOT EXISTS cotacoes_fornecedores_cotacao_idx ON public.cotacoes_fornecedores(cotacao_id);
CREATE INDEX IF NOT EXISTS cotacoes_fornecedores_token_idx ON public.cotacoes_fornecedores(token);
CREATE INDEX IF NOT EXISTS cotacoes_itens_cotacao_idx ON public.cotacoes_itens(cotacao_id);
CREATE INDEX IF NOT EXISTS cotacoes_pedidos_status_idx ON public.cotacoes_pedidos(status);

DO $$ BEGIN
  CREATE TRIGGER trg_cotacoes_compra_updated BEFORE UPDATE ON public.cotacoes_compra FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_cotacoes_pedidos_updated BEFORE UPDATE ON public.cotacoes_pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_cotacoes_respostas_updated BEFORE UPDATE ON public.cotacoes_respostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_cotacoes_propostas_updated BEFORE UPDATE ON public.cotacoes_propostas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE public.cotacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_selecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_pedidos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_recebimentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes_historico ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['cotacoes_compra','cotacoes_fornecedores','cotacoes_itens','cotacoes_respostas','cotacoes_propostas','cotacoes_anexos','cotacoes_selecao','cotacoes_pedidos','cotacoes_pedidos_itens','cotacoes_recebimentos','cotacoes_recebimentos_itens','cotacoes_historico'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'cotacoes_interno_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', 'cotacoes_interno_' || t, t);
  END LOOP;
END $$;

-- Retorna apenas os dados necessários pelo fornecedor, sem expor tabelas por SELECT anônimo.
CREATE OR REPLACE FUNCTION public.obter_cotacao_publica(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'convite', jsonb_build_object('id', cf.id, 'token', cf.token, 'status', cf.status, 'respondido_em', cf.respondido_em, 'motivo_recusa', cf.motivo_recusa),
    'fornecedor', jsonb_build_object('id', f.id, 'razao_social', f.razao_social),
    'cotacao', jsonb_build_object('id', c.id, 'numero', c.numero, 'prazo_resposta', c.prazo_resposta, 'observacoes', c.observacoes, 'obra_id', c.obra_id),
    'itens', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'descricao', i.descricao, 'quantidade', i.quantidade, 'unidade', i.unidade, 'ordem', i.ordem) ORDER BY i.ordem) FROM cotacoes_itens i WHERE i.cotacao_id = c.id), '[]'::jsonb),
    'proposta', (SELECT to_jsonb(p) - 'id' FROM cotacoes_propostas p WHERE p.cotacao_fornecedor_id = cf.id),
    'respostas', COALESCE((SELECT jsonb_agg(to_jsonb(r) - 'id') FROM cotacoes_respostas r WHERE r.cotacao_fornecedor_id = cf.id), '[]'::jsonb)
  ) INTO v
  FROM cotacoes_fornecedores cf JOIN cotacoes_compra c ON c.id = cf.cotacao_id JOIN fornecedores f ON f.id = cf.fornecedor_id
  WHERE cf.token = p_token;
  IF v IS NULL THEN RETURN jsonb_build_object('error', 'Link inválido ou inexistente.'); END IF;
  UPDATE cotacoes_fornecedores SET status = 'visualizado', visualizado_em = now() WHERE token = p_token AND status = 'enviado';
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.responder_cotacao_publica(p_token uuid, p_respostas jsonb, p_proposta jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cf cotacoes_fornecedores%ROWTYPE; c cotacoes_compra%ROWTYPE; nome text; item jsonb;
BEGIN
  SELECT * INTO cf FROM cotacoes_fornecedores WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de cotação inválido'; END IF;
  SELECT * INTO c FROM cotacoes_compra WHERE id = cf.cotacao_id;
  IF c.prazo_resposta < current_date THEN RAISE EXCEPTION 'O prazo desta cotação já terminou'; END IF;
  IF cf.status IN ('respondido','recusado') THEN RAISE EXCEPTION 'Esta cotação já foi encerrada'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_respostas, '[]'::jsonb)) LOOP
    INSERT INTO cotacoes_respostas(cotacao_fornecedor_id, cotacao_item_id, valor_unitario, quantidade_ofertada, disponivel, observacao_item)
    VALUES (cf.id, (item->>'cotacao_item_id')::uuid, COALESCE((item->>'valor_unitario')::bigint, 0), NULLIF(item->>'quantidade_ofertada','')::numeric, COALESCE((item->>'disponivel')::boolean, true), item->>'observacao_item')
    ON CONFLICT (cotacao_fornecedor_id, cotacao_item_id) DO UPDATE SET valor_unitario=excluded.valor_unitario, quantidade_ofertada=excluded.quantidade_ofertada, disponivel=excluded.disponivel, observacao_item=excluded.observacao_item, updated_at=now();
  END LOOP;
  INSERT INTO cotacoes_propostas(cotacao_fornecedor_id, frete, prazo_entrega_dias, condicao_pagamento, validade_proposta, observacoes)
  VALUES (cf.id, COALESCE((p_proposta->>'frete')::bigint,0), NULLIF(p_proposta->>'prazo_entrega_dias','')::integer, p_proposta->>'condicao_pagamento', NULLIF(p_proposta->>'validade_proposta','')::date, p_proposta->>'observacoes')
  ON CONFLICT (cotacao_fornecedor_id) DO UPDATE SET frete=excluded.frete, prazo_entrega_dias=excluded.prazo_entrega_dias, condicao_pagamento=excluded.condicao_pagamento, validade_proposta=excluded.validade_proposta, observacoes=excluded.observacoes, updated_at=now();
  UPDATE cotacoes_fornecedores SET status='respondido', respondido_em=now() WHERE id=cf.id;
  SELECT razao_social INTO nome FROM fornecedores WHERE id=cf.fornecedor_id;
  INSERT INTO cotacoes_historico(cotacao_id, acao, descricao, dados) VALUES (cf.cotacao_id, 'proposta_recebida', 'Resposta recebida de '||nome, jsonb_build_object('fornecedor_id', cf.fornecedor_id));
  INSERT INTO notificacoes_usuario(user_id, alerta_id) SELECT pu.user_id, 'cotacao-resposta-'||cf.id FROM perfis_usuarios pu WHERE pu.perfil IN ('admin','compras') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.recusar_cotacao_publica(p_token uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cf cotacoes_fornecedores%ROWTYPE;
BEGIN
  SELECT * INTO cf FROM cotacoes_fornecedores WHERE token=p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Link de cotação inválido'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
  UPDATE cotacoes_fornecedores SET status='recusado', recusado_em=now(), motivo_recusa=trim(p_motivo) WHERE id=cf.id;
  INSERT INTO cotacoes_historico(cotacao_id, acao, descricao) VALUES (cf.cotacao_id, 'proposta_recusada', trim(p_motivo));
  RETURN jsonb_build_object('success', true);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_anexo_cotacao_publica(p_token uuid, p_nome text, p_path text, p_tamanho bigint, p_mime text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM cotacoes_fornecedores WHERE token=p_token AND status NOT IN ('recusado','expirado');
  IF v_id IS NULL OR p_path NOT LIKE 'cotacao/%' THEN RAISE EXCEPTION 'Anexo não autorizado'; END IF;
  INSERT INTO cotacoes_anexos(cotacao_fornecedor_id,nome,bucket_path,tamanho_bytes,mime_type) VALUES(v_id,p_nome,p_path,p_tamanho,p_mime);
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.confirmar_selecao_cotacao(p_cotacao_id uuid, p_selecoes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; sel record; ped uuid; forn uuid; subtotal bigint; frete bigint; vtotal bigint; c cotacoes_compra%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
  SELECT * INTO c FROM cotacoes_compra WHERE id=p_cotacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotação não encontrada'; END IF;
  DELETE FROM cotacoes_selecao WHERE cotacao_id=p_cotacao_id;
  FOR s IN SELECT * FROM jsonb_array_elements(p_selecoes) LOOP
    INSERT INTO cotacoes_selecao(cotacao_id,cotacao_item_id,cotacao_fornecedor_id,selecionado_por) VALUES(p_cotacao_id,(s->>'cotacao_item_id')::uuid,(s->>'cotacao_fornecedor_id')::uuid,auth.uid());
  END LOOP;
  FOR forn IN SELECT DISTINCT cotacao_fornecedor_id FROM cotacoes_selecao WHERE cotacao_id=p_cotacao_id LOOP
    SELECT COALESCE(sum(r.valor_unitario * i.quantidade),0), COALESCE(p.frete,0) INTO subtotal, frete
    FROM cotacoes_selecao cs JOIN cotacoes_itens i ON i.id=cs.cotacao_item_id JOIN cotacoes_respostas r ON r.cotacao_item_id=i.id AND r.cotacao_fornecedor_id=cs.cotacao_fornecedor_id LEFT JOIN cotacoes_propostas p ON p.cotacao_fornecedor_id=forn WHERE cs.cotacao_id=p_cotacao_id AND cs.cotacao_fornecedor_id=forn;
    INSERT INTO cotacoes_pedidos(cotacao_id,fornecedor_id,obra_id,status,valor_total,frete,condicao_pagamento,data_entrega_prev) SELECT p_cotacao_id,cf.fornecedor_id,c.obra_id,'aguardando_aprovacao',subtotal+frete,frete,p.condicao_pagamento,current_date+COALESCE(p.prazo_entrega_dias,30) FROM cotacoes_fornecedores cf LEFT JOIN cotacoes_propostas p ON p.cotacao_fornecedor_id=cf.id WHERE cf.id=forn RETURNING id INTO ped;
    INSERT INTO cotacoes_pedidos_itens(pedido_id,cotacao_item_id,descricao,quantidade,unidade,valor_unitario) SELECT ped,i.id,i.descricao,i.quantidade,i.unidade,r.valor_unitario FROM cotacoes_selecao cs JOIN cotacoes_itens i ON i.id=cs.cotacao_item_id JOIN cotacoes_respostas r ON r.cotacao_item_id=i.id AND r.cotacao_fornecedor_id=cs.cotacao_fornecedor_id WHERE cs.cotacao_id=p_cotacao_id AND cs.cotacao_fornecedor_id=forn;
    INSERT INTO cotacoes_historico(cotacao_id,pedido_id,usuario_id,acao,descricao) VALUES(p_cotacao_id,ped,auth.uid(),'pedido_gerado','Pedido de compra gerado após seleção');
  END LOOP;
  UPDATE cotacoes_compra SET status='aprovada', aprovado_por=auth.uid(), aprovado_em=now() WHERE id=p_cotacao_id;
  RETURN jsonb_build_object('success',true,'cotacao_id',p_cotacao_id);
END $$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_cotacao(p_pedido_id uuid, p_itens jsonb, p_observacoes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ped cotacoes_pedidos%ROWTYPE; rec uuid; x jsonb; pi record; recebido numeric; total bigint; conta uuid; todos boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
  SELECT * INTO ped FROM cotacoes_pedidos WHERE id=p_pedido_id FOR UPDATE;
  IF NOT FOUND OR ped.status NOT IN ('aprovado','parcialmente_recebido') THEN RAISE EXCEPTION 'Pedido não está disponível para recebimento'; END IF;
  INSERT INTO cotacoes_recebimentos(pedido_id,recebido_por,observacoes) VALUES(p_pedido_id,auth.uid(),p_observacoes) RETURNING id INTO rec;
  total := 0;
  FOR x IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    recebido := COALESCE((x->>'quantidade_recebida')::numeric,0); IF recebido <= 0 THEN CONTINUE; END IF;
    SELECT * INTO pi FROM cotacoes_pedidos_itens WHERE id=(x->>'pedido_item_id')::uuid AND pedido_id=p_pedido_id FOR UPDATE;
    IF recebido > pi.quantidade-pi.qtd_recebida THEN RAISE EXCEPTION 'Quantidade recebida maior que o saldo do item'; END IF;
    INSERT INTO cotacoes_recebimentos_itens(recebimento_id,pedido_item_id,quantidade_recebida,observacao) VALUES(rec,pi.id,recebido,x->>'observacao');
    UPDATE cotacoes_pedidos_itens SET qtd_recebida=qtd_recebida+recebido WHERE id=pi.id;
    total := total + round(pi.valor_unitario*recebido);
  END LOOP;
  SELECT NOT EXISTS(SELECT 1 FROM cotacoes_pedidos_itens WHERE pedido_id=p_pedido_id AND qtd_recebida<quantidade) INTO todos;
  UPDATE cotacoes_pedidos SET status=CASE WHEN todos THEN 'recebido' ELSE 'parcialmente_recebido' END WHERE id=p_pedido_id;
  INSERT INTO public.contas_pagar(obra_id,fornecedor_id,descricao,valor_total,data_vencimento,status,observacoes,cotacao_pedido_id,origem) VALUES(ped.obra_id,ped.fornecedor_id,'Pedido de compra #'||ped.numero,total,COALESCE(ped.data_entrega_prev,current_date+30),'aberta',p_observacoes,ped.id,'erp') RETURNING id INTO conta;
  UPDATE cotacoes_recebimentos SET gerou_conta_pagar=true,conta_pagar_id=conta WHERE id=rec;
  INSERT INTO cotacoes_historico(cotacao_id,pedido_id,usuario_id,acao,descricao) VALUES(ped.cotacao_id,ped.id,auth.uid(),'recebimento_registrado','Recebimento registrado e conta enviada ao Financeiro');
  RETURN jsonb_build_object('success',true,'conta_pagar_id',conta);
END $$;

CREATE OR REPLACE FUNCTION public.criar_cotacao_compra(p_solicitacao_id uuid, p_prazo date, p_observacoes text, p_fornecedores uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s solicitacoes_compra%ROWTYPE; c uuid; item record; f uuid; ordem integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória'; END IF;
  SELECT * INTO s FROM solicitacoes_compra WHERE id=p_solicitacao_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'aprovada' THEN RAISE EXCEPTION 'A solicitação precisa estar aprovada'; END IF;
  IF p_prazo < current_date + 1 THEN RAISE EXCEPTION 'O prazo deve ser a partir de amanhã'; END IF;
  IF COALESCE(array_length(p_fornecedores,1),0) < 1 THEN RAISE EXCEPTION 'Selecione pelo menos um fornecedor'; END IF;
  INSERT INTO cotacoes_compra(solicitacao_id,obra_id,status,prazo_resposta,criado_por,observacoes) VALUES(p_solicitacao_id,s.obra_id,'aberta',p_prazo,auth.uid(),p_observacoes) RETURNING id INTO c;
  FOR item IN SELECT * FROM solicitacao_itens WHERE solicitacao_id=p_solicitacao_id ORDER BY created_at LOOP
    INSERT INTO cotacoes_itens(cotacao_id,solicitacao_item_id,produto_id,descricao,quantidade,unidade,ordem) VALUES(c,item.id,item.produto_id,COALESCE(NULLIF(item.descricao_livre,''),(SELECT nome FROM produtos WHERE id=item.produto_id),'Item sem descrição'),item.quantidade,item.unidade,ordem);
    ordem := ordem + 1;
  END LOOP;
  FOREACH f IN ARRAY p_fornecedores LOOP
    INSERT INTO cotacoes_fornecedores(cotacao_id,fornecedor_id) VALUES(c,f);
  END LOOP;
  INSERT INTO cotacoes_historico(cotacao_id,usuario_id,acao,descricao) VALUES(c,auth.uid(),'cotacao_criada','Cotação enviada a '||array_length(p_fornecedores,1)||' fornecedor(es)');
  RETURN c;
END $$;

GRANT EXECUTE ON FUNCTION public.obter_cotacao_publica(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.responder_cotacao_publica(uuid,jsonb,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_cotacao_publica(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_anexo_cotacao_publica(uuid,text,text,bigint,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_selecao_cotacao(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_cotacao(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_cotacao_compra(uuid,date,text,uuid[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
