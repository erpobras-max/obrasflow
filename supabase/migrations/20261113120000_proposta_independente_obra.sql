-- Issue #220 — proposta comercial independente da obra.

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS tipo_proposta text NOT NULL DEFAULT 'Obra';

ALTER TABLE public.proposta_revisoes
  ALTER COLUMN orcamento_revisao_id DROP NOT NULL;

ALTER TABLE public.proposta_revisoes
  ADD COLUMN IF NOT EXISTS enviada_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'propostas_tipo_proposta_check'
  ) THEN
    ALTER TABLE public.propostas
      ADD CONSTRAINT propostas_tipo_proposta_check
      CHECK (tipo_proposta IN ('Obra','Reforma','Projeto','Serviço','Regularização','Vistoria','Consultoria','Outro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS propostas_tipo_proposta_idx
  ON public.propostas(tipo_proposta);

-- O aceite antigo não pode criar obra para serviços. Esta função também é
-- idempotente para reprocessamentos e mantém o comportamento legado de Obra.
CREATE OR REPLACE FUNCTION public.criar_obra_da_proposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aceita'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'aceita')
     AND COALESCE(NEW.tipo_proposta, 'Obra') = 'Obra'
  THEN
    INSERT INTO public.obras (
      proposta_id, numero, nome, descricao, cliente_id,
      status, orcamento, progresso, valor_executado, observacoes, created_by
    )
    SELECT NEW.id, '', NEW.titulo, NEW.descricao, NEW.cliente_id,
      'planejamento', COALESCE(NEW.valor_total, 0), 0, 0, NEW.observacoes, NEW.created_by
    WHERE NOT EXISTS (
      SELECT 1 FROM public.obras o WHERE o.proposta_id = NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propostas_criar_obra_aceita ON public.propostas;
DROP TRIGGER IF EXISTS a_legado_criar_obra ON public.propostas;
CREATE TRIGGER propostas_criar_obra_aceita
AFTER INSERT OR UPDATE OF status ON public.propostas
FOR EACH ROW EXECUTE FUNCTION public.criar_obra_da_proposta();

CREATE OR REPLACE FUNCTION public.criar_proposta_manual(
  p_cliente_id uuid,
  p_titulo text,
  p_tipo_proposta text,
  p_descricao text,
  p_valor_total numeric,
  p_validade date,
  p_condicoes text,
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_proposta_id uuid;
  v_fotografia jsonb;
  v_tipo text := COALESCE(NULLIF(BTRIM(p_tipo_proposta), ''), 'Obra');
  v_valor numeric(14,2) := COALESCE(p_valor_total, 0);
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para criar proposta';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_tipo NOT IN ('Obra','Reforma','Projeto','Serviço','Regularização','Vistoria','Consultoria','Outro') THEN
    RAISE EXCEPTION 'Classificação de proposta inválida';
  END IF;
  IF NULLIF(BTRIM(p_titulo), '') IS NULL THEN
    RAISE EXCEPTION 'Título da proposta é obrigatório';
  END IF;
  IF v_valor < 0 THEN RAISE EXCEPTION 'Valor da proposta não pode ser negativo'; END IF;

  v_fotografia := jsonb_build_object(
    'manual', true,
    'tipoProposta', v_tipo,
    'itens', CASE WHEN jsonb_typeof(COALESCE(p_itens, '[]'::jsonb)) = 'array' THEN p_itens ELSE '[]'::jsonb END,
    'totalPrecoCentavos', round(v_valor * 100)
  );

  INSERT INTO public.propostas(
    numero, cliente_id, titulo, descricao, valor_total, status,
    validade, condicoes_pagamento, created_by, tipo_proposta
  ) VALUES (
    '', p_cliente_id, BTRIM(p_titulo), NULLIF(BTRIM(p_descricao), ''), v_valor, 'rascunho',
    p_validade, NULLIF(BTRIM(p_condicoes), ''), v_usuario, v_tipo
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO public.proposta_revisoes(
    proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
  ) VALUES (
    v_proposta_id, NULL, 1, 'rascunho',
    jsonb_build_object('tipoProposta', v_tipo, 'tituloProposta', BTRIM(p_titulo), 'manual', true),
    v_fotografia
  );

  INSERT INTO public.propostas_itens(proposta_id, descricao, quantidade, valor_unitario, ordem)
  SELECT v_proposta_id,
    NULLIF(BTRIM(item->>'descricao'), ''),
    GREATEST(COALESCE(NULLIF(item->>'quantidade', '')::numeric, 1), 0.001),
    GREATEST(COALESCE(NULLIF(item->>'valor_unitario', '')::numeric, 0), 0),
    COALESCE(ordem, 0)::integer
  FROM jsonb_array_elements(COALESCE(p_itens, '[]'::jsonb)) WITH ORDINALITY AS linhas(item, ordem)
  WHERE NULLIF(BTRIM(item->>'descricao'), '') IS NOT NULL;

  RETURN v_proposta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.salvar_rascunho_proposta(
  p_proposta_id uuid,
  p_configuracao jsonb,
  p_fotografia jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_proposta public.propostas%ROWTYPE;
  v_revisao public.proposta_revisoes%ROWTYPE;
  v_revisao_id uuid;
  v_proximo_numero integer;
  v_fotografia jsonb;
  v_valor numeric(14,2);
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para salvar proposta';
  END IF;
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.status = 'aceita' THEN RAISE EXCEPTION 'Proposta aceita está congelada'; END IF;
  IF v_proposta.status = 'enviada' THEN RAISE EXCEPTION 'Proposta enviada não pode ser alterada'; END IF;

  SELECT * INTO v_revisao
    FROM public.proposta_revisoes
   WHERE proposta_id = p_proposta_id
   ORDER BY numero DESC LIMIT 1 FOR UPDATE;

  IF v_proposta.orcamento_revisao_id IS NULL THEN
    v_fotografia := COALESCE(NULLIF(p_fotografia, '{}'::jsonb), COALESCE(v_revisao.fotografia, '{}'::jsonb));
    v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, v_proposta.valor_total * 100) / 100;
    IF NOT FOUND THEN
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia)
      VALUES (p_proposta_id, NULL, 1, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia)
      RETURNING id INTO v_revisao_id;
    ELSIF v_revisao.status = 'rascunho' THEN
      UPDATE public.proposta_revisoes SET configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia
       WHERE id = v_revisao.id RETURNING id INTO v_revisao_id;
    ELSE
      v_proximo_numero := v_revisao.numero + 1;
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia)
      VALUES (p_proposta_id, NULL, v_proximo_numero, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia)
      RETURNING id INTO v_revisao_id;
    END IF;
  ELSE
    v_fotografia := public.construir_fotografia_comercial(v_proposta.orcamento_revisao_id, p_configuracao);
    v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
    IF NOT FOUND THEN
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia)
      VALUES (p_proposta_id, v_proposta.orcamento_revisao_id, 1, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia)
      RETURNING id INTO v_revisao_id;
    ELSIF v_revisao.status = 'rascunho' THEN
      UPDATE public.proposta_revisoes SET configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia
       WHERE id = v_revisao.id RETURNING id INTO v_revisao_id;
    ELSE
      v_proximo_numero := v_revisao.numero + 1;
      INSERT INTO public.proposta_revisoes(proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia)
      VALUES (p_proposta_id, v_proposta.orcamento_revisao_id, v_proximo_numero, 'rascunho', COALESCE(p_configuracao, '{}'::jsonb), v_fotografia)
      RETURNING id INTO v_revisao_id;
    END IF;
  END IF;
  UPDATE public.propostas
     SET status = 'rascunho',
         valor_total = v_valor,
         tipo_proposta = COALESCE(NULLIF(p_configuracao->>'tipoProposta', ''), tipo_proposta)
   WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publicar_rascunho_proposta(
  p_proposta_id uuid,
  p_configuracao jsonb,
  p_fotografia jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_revisao_id uuid;
  v_origem uuid;
  v_fotografia jsonb;
  v_valor numeric(14,2);
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para publicar proposta';
  END IF;
  SELECT orcamento_revisao_id INTO v_origem FROM public.propostas WHERE id = p_proposta_id AND status = 'rascunho' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente proposta em rascunho pode ser publicada'; END IF;

  IF v_origem IS NULL THEN
    SELECT id, fotografia INTO v_revisao_id, v_fotografia
      FROM public.proposta_revisoes
     WHERE proposta_id = p_proposta_id AND status = 'rascunho'
     ORDER BY numero DESC LIMIT 1 FOR UPDATE;
    v_fotografia := COALESCE(NULLIF(p_fotografia, '{}'::jsonb), v_fotografia, '{}'::jsonb);
  ELSE
    v_fotografia := public.construir_fotografia_comercial(v_origem, p_configuracao);
    SELECT id INTO v_revisao_id FROM public.proposta_revisoes
     WHERE proposta_id = p_proposta_id AND status = 'rascunho'
     ORDER BY numero DESC LIMIT 1 FOR UPDATE;
  END IF;
  IF v_revisao_id IS NULL THEN RAISE EXCEPTION 'Revisão em rascunho não encontrada'; END IF;

  UPDATE public.proposta_revisoes
     SET status = 'enviada', configuracao = COALESCE(p_configuracao, configuracao), fotografia = v_fotografia, enviada_at = now()
   WHERE id = v_revisao_id;
  v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
  UPDATE public.propostas
     SET status = 'enviada',
         valor_total = v_valor,
         tipo_proposta = COALESCE(NULLIF(p_configuracao->>'tipoProposta', ''), tipo_proposta),
         data_envio = current_date
   WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_proposta_manual(uuid,text,text,text,numeric,date,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_proposta_manual(uuid,text,text,text,numeric,date,text,jsonb) TO authenticated;

-- Função de conversão explícita para uma proposta de serviço, sem alterar sua classificação.
CREATE OR REPLACE FUNCTION public.converter_proposta_em_obra(
  p_proposta_id uuid,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_proposta public.propostas%ROWTYPE;
  v_obra_id uuid;
  v_nome text;
  v_endereco text;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para converter proposta';
  END IF;
  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.status <> 'aceita' THEN RAISE EXCEPTION 'Somente proposta aprovada pode ser convertida'; END IF;
  SELECT id INTO v_obra_id FROM public.obras WHERE proposta_id = p_proposta_id LIMIT 1;
  IF v_obra_id IS NOT NULL THEN RETURN v_obra_id; END IF;
  v_nome := COALESCE(NULLIF(BTRIM(p_dados->>'nome'), ''), v_proposta.titulo);
  v_endereco := NULLIF(BTRIM(p_dados->>'endereco'), '');
  INSERT INTO public.obras(proposta_id, numero, nome, descricao, cliente_id, status, orcamento, progresso, valor_executado, observacoes, created_by)
  VALUES (p_proposta_id, '', v_nome, v_proposta.descricao, v_proposta.cliente_id,
          COALESCE(NULLIF(p_dados->>'status', ''), 'planejamento'), v_proposta.valor_total,
          0, 0, COALESCE(v_endereco || E'\n', '') || COALESCE(v_proposta.observacoes, ''), v_usuario)
  RETURNING id INTO v_obra_id;
  RETURN v_obra_id;
END;
$$;

REVOKE ALL ON FUNCTION public.converter_proposta_em_obra(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.converter_proposta_em_obra(uuid,jsonb) TO authenticated;

-- Wrapper idempotente para cliques duplicados e retries de rede. A RPC legada
-- continua responsável pela transição inicial e pela materialização do escopo.
CREATE OR REPLACE FUNCTION public.alterar_status_proposta_editor_idempotente(
  p_proposta_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.status_proposta;
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_editar_proposta_editor(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão insuficiente para alterar status da proposta';
  END IF;
  SELECT status INTO v_status FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_status = p_status::public.status_proposta THEN RETURN true; END IF;
  RETURN public.alterar_status_proposta_editor(p_proposta_id, p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_status_proposta_editor_idempotente(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_status_proposta_editor_idempotente(uuid,text) TO authenticated;

-- Rollback: restore the previous migration snapshot and remove this migration's
-- added column/RPC objects only after taking a database backup. The change is
-- additive and does not delete existing proposals or works.
