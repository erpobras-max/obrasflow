-- Normaliza a composição manual no servidor. Esta migration é aditiva porque a
-- migration original da proposta independente já pode ter sido aplicada.
CREATE OR REPLACE FUNCTION public.normalizar_fotografia_manual_proposta(p_fotografia jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_itens jsonb := CASE WHEN jsonb_typeof(COALESCE(p_fotografia->'itens', '[]'::jsonb)) = 'array' THEN COALESCE(p_fotografia->'itens', '[]'::jsonb) ELSE '[]'::jsonb END;
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(
    GREATEST(COALESCE(NULLIF(item->>'quantidade', '')::numeric, 0), 0) *
    GREATEST(COALESCE(
      NULLIF(item->>'valorUnitarioCentavos', '')::numeric,
      NULLIF(item->>'valor_unitario_centavos', '')::numeric,
      NULLIF(item->>'valor_unitario', '')::numeric * 100,
      0
    ), 0)
  ), 0)
  INTO v_total
  FROM jsonb_array_elements(v_itens) AS linha(item);

  RETURN jsonb_set(
    jsonb_set(COALESCE(p_fotografia, '{}'::jsonb), '{itens}', v_itens, true),
    '{totalPrecoCentavos}', to_jsonb(round(v_total)), true
  );
END;
$$;

-- As funções públicas são redefinidas abaixo para que instalações existentes
-- também passem a normalizar itens e recalcular o total da proposta.
CREATE OR REPLACE FUNCTION public.salvar_rascunho_proposta(p_proposta_id uuid, p_configuracao jsonb, p_fotografia jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_proposta public.propostas%ROWTYPE;
  v_revisao public.proposta_revisoes%ROWTYPE;
  v_revisao_id uuid;
  v_proximo_numero integer;
  v_fotografia jsonb;
  v_valor numeric(14,2);
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN RAISE EXCEPTION 'Permissão insuficiente para salvar proposta'; END IF;
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.status = 'aceita' THEN RAISE EXCEPTION 'Proposta aceita está congelada'; END IF;
  IF v_proposta.status = 'enviada' THEN RAISE EXCEPTION 'Proposta enviada não pode ser alterada'; END IF;
  SELECT * INTO v_revisao FROM public.proposta_revisoes WHERE proposta_id = p_proposta_id ORDER BY numero DESC LIMIT 1 FOR UPDATE;

  IF v_proposta.orcamento_revisao_id IS NULL THEN
    v_fotografia := public.normalizar_fotografia_manual_proposta(COALESCE(NULLIF(p_fotografia, '{}'::jsonb), COALESCE(v_revisao.fotografia, '{}'::jsonb)));
    v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, v_proposta.valor_total * 100) / 100;
    IF NOT FOUND THEN
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia) VALUES (p_proposta_id, NULL, 1, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia) RETURNING id INTO v_revisao_id;
    ELSIF v_revisao.status = 'rascunho' THEN
      UPDATE public.proposta_revisoes SET configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia WHERE id = v_revisao.id RETURNING id INTO v_revisao_id;
    ELSE
      v_proximo_numero := v_revisao.numero + 1;
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia) VALUES (p_proposta_id, NULL, v_proximo_numero, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia) RETURNING id INTO v_revisao_id;
    END IF;
  ELSE
    v_fotografia := public.construir_fotografia_comercial(v_proposta.orcamento_revisao_id, p_configuracao);
    v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
    IF NOT FOUND THEN
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia) VALUES (p_proposta_id, v_proposta.orcamento_revisao_id, 1, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia) RETURNING id INTO v_revisao_id;
    ELSIF v_revisao.status = 'rascunho' THEN
      UPDATE public.proposta_revisoes SET configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia WHERE id = v_revisao.id RETURNING id INTO v_revisao_id;
    ELSE
      v_proximo_numero := v_revisao.numero + 1;
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia) VALUES (p_proposta_id, v_proposta.orcamento_revisao_id, v_proximo_numero, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia) RETURNING id INTO v_revisao_id;
    END IF;
  END IF;
  UPDATE public.propostas SET status = 'rascunho', valor_total = v_valor, tipo_proposta = COALESCE(NULLIF(p_configuracao->>'tipoProposta', ''), tipo_proposta) WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_rascunho_proposta(p_proposta_id uuid, p_configuracao jsonb, p_fotografia jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario uuid := auth.uid(); v_revisao_id uuid; v_origem uuid; v_fotografia jsonb; v_valor numeric(14,2);
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN RAISE EXCEPTION 'Permissão insuficiente para publicar proposta'; END IF;
  SELECT orcamento_revisao_id INTO v_origem FROM public.propostas WHERE id = p_proposta_id AND status = 'rascunho' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente proposta em rascunho pode ser publicada'; END IF;
  IF v_origem IS NULL THEN
    SELECT id, fotografia INTO v_revisao_id, v_fotografia FROM public.proposta_revisoes WHERE proposta_id = p_proposta_id AND status = 'rascunho' ORDER BY numero DESC LIMIT 1 FOR UPDATE;
    v_fotografia := public.normalizar_fotografia_manual_proposta(COALESCE(NULLIF(p_fotografia, '{}'::jsonb), v_fotografia, '{}'::jsonb));
  ELSE
    v_fotografia := public.construir_fotografia_comercial(v_origem, p_configuracao);
    SELECT id INTO v_revisao_id FROM public.proposta_revisoes WHERE proposta_id = p_proposta_id AND status = 'rascunho' ORDER BY numero DESC LIMIT 1 FOR UPDATE;
  END IF;
  IF v_revisao_id IS NULL THEN RAISE EXCEPTION 'Revisão em rascunho não encontrada'; END IF;
  UPDATE public.proposta_revisoes SET status = 'enviada', configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia, enviada_at = now() WHERE id = v_revisao_id;
  v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
  UPDATE public.propostas SET status = 'enviada', valor_total = v_valor, tipo_proposta = COALESCE(NULLIF(p_configuracao->>'tipoProposta', ''), tipo_proposta), data_envio = current_date WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;
