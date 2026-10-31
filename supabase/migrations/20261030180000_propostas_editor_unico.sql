-- Issue #200 — editor comercial único, revisões persistentes e exclusão segura.

ALTER TABLE public.proposta_revisoes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS enviada_at timestamptz;

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS variante_comercial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicada_de_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_proposta_revisoes_updated_at ON public.proposta_revisoes;
CREATE TRIGGER trg_proposta_revisoes_updated_at
BEFORE UPDATE ON public.proposta_revisoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sanitizar_fotografia_proposta(p_valor jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_resultado jsonb;
BEGIN
  IF p_valor IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  v_tipo := jsonb_typeof(p_valor);
  IF v_tipo = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(chave, public.sanitizar_fotografia_proposta(valor)), '{}'::jsonb)
      INTO v_resultado
      FROM jsonb_each(p_valor) AS item(chave, valor)
     WHERE chave !~* '^(custo|bdi|insumos?|composi|coeficiente|margem|precoManual)';
    RETURN v_resultado;
  ELSIF v_tipo = 'array' THEN
    SELECT COALESCE(jsonb_agg(public.sanitizar_fotografia_proposta(valor)), '[]'::jsonb)
      INTO v_resultado
      FROM jsonb_array_elements(p_valor) AS item(valor);
    RETURN v_resultado;
  END IF;

  RETURN p_valor;
END;
$$;

CREATE OR REPLACE FUNCTION public.pode_editar_proposta_editor(p_usuario uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(p_usuario, 'admin')
    OR public.has_role(p_usuario, 'diretor')
    OR public.has_role(p_usuario, 'financeiro')
    OR public.has_role(p_usuario, 'financeiro_civil');
$$;

CREATE OR REPLACE FUNCTION public.construir_fotografia_comercial(
  p_orcamento_revisao_id uuid,
  p_configuracao jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem jsonb;
  v_config jsonb := COALESCE(p_configuracao, '{}'::jsonb);
  v_etapa jsonb;
  v_atividade jsonb;
  v_insumo jsonb;
  v_etapas jsonb := '[]'::jsonb;
  v_atividades jsonb;
  v_total_geral numeric := 0;
  v_total_etapa numeric;
  v_custo_unitario numeric;
  v_preco_unitario numeric;
  v_preco_total numeric;
  v_quantidade numeric;
  v_bdi numeric;
  v_bdi_geral numeric;
  v_descricao text;
BEGIN
  SELECT fotografia INTO v_origem
    FROM public.orcamento_revisoes
   WHERE id = p_orcamento_revisao_id;
  IF v_origem IS NULL THEN RAISE EXCEPTION 'Revisão de orçamento não encontrada'; END IF;

  v_bdi_geral := COALESCE(NULLIF(v_origem->'orcamento'->>'bdi_geral', '')::numeric, 0);
  FOR v_etapa IN SELECT value FROM jsonb_array_elements(COALESCE(v_origem->'etapas', '[]'::jsonb)) LOOP
    IF COALESCE(v_config->'etapasOcultas', '[]'::jsonb) ? COALESCE(v_etapa->>'id', '')
       OR COALESCE(v_config->'etapasOcultas', '[]'::jsonb) ? COALESCE(v_etapa->>'codigo', '') THEN
      CONTINUE;
    END IF;

    v_atividades := '[]'::jsonb;
    v_total_etapa := 0;
    FOR v_atividade IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_origem->'atividades', '[]'::jsonb))
       WHERE value->>'etapa_id' = v_etapa->>'id'
       ORDER BY COALESCE(NULLIF(value->>'ordem', '')::integer, 0)
    LOOP
      v_custo_unitario := 0;
      FOR v_insumo IN
        SELECT value FROM jsonb_array_elements(COALESCE(v_origem->'insumos', '[]'::jsonb))
         WHERE value->>'atividade_id' = v_atividade->>'id'
      LOOP
        v_custo_unitario := v_custo_unitario + round(
          COALESCE(NULLIF(v_insumo->>'coeficiente', '')::numeric, 0)
          * COALESCE(NULLIF(v_insumo->>'preco_unitario_centavos', '')::numeric, 0)
        );
      END LOOP;
      v_quantidade := COALESCE(NULLIF(v_atividade->>'quantidade', '')::numeric, 0);
      v_bdi := COALESCE(NULLIF(v_atividade->>'bdi_percentual', '')::numeric, v_bdi_geral);
      v_preco_unitario := round(v_custo_unitario * (1 + v_bdi / 100));
      v_preco_total := round(v_preco_unitario * v_quantidade);
      v_total_etapa := v_total_etapa + v_preco_total;

      IF COALESCE(v_config->>'mostrarApenasEtapa', 'false')::boolean
         OR COALESCE(v_config->'atividadesOcultas', '[]'::jsonb) ? COALESCE(v_atividade->>'id', '')
         OR COALESCE(v_config->'atividadesOcultas', '[]'::jsonb) ? COALESCE(v_atividade->>'codigo', '') THEN
        CONTINUE;
      END IF;
      v_descricao := COALESCE(
        (v_config->'descricoesComerciais')->>(v_atividade->>'id'),
        (v_config->'descricoesComerciais')->>(v_atividade->>'codigo'),
        v_atividade->>'descricao',
        'Serviço'
      );
      v_atividades := v_atividades || jsonb_build_array(jsonb_build_object(
        'id', v_atividade->>'id',
        'codigo', v_atividade->>'codigo',
        'descricao', v_descricao,
        'unidade', COALESCE(v_atividade->>'unidade', 'un'),
        'quantidade', v_quantidade,
        'precoUnitarioCentavos', v_preco_unitario,
        'precoTotalCentavos', v_preco_total
      ));
    END LOOP;

    v_total_geral := v_total_geral + v_total_etapa;
    v_etapas := v_etapas || jsonb_build_array(jsonb_build_object(
      'id', v_etapa->>'id',
      'codigo', v_etapa->>'codigo',
      'nome', COALESCE(v_etapa->>'nome', 'Etapa'),
      'valorTotalCentavos', v_total_etapa,
      'atividades', v_atividades
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'orcamentoRevisaoId', p_orcamento_revisao_id,
    'etapas', v_etapas,
    'totalPrecoCentavos', v_total_geral
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_origens_proposta_editor(
  p_obra_id uuid DEFAULT NULL,
  p_revisao_id uuid DEFAULT NULL,
  p_incluir_fotografia boolean DEFAULT false
)
RETURNS TABLE(
  obra_id uuid,
  obra_numero text,
  obra_nome text,
  cliente_id uuid,
  orcamento_id uuid,
  orcamento_created_at timestamptz,
  revisao_id uuid,
  revisao_numero integer,
  revisao_created_at timestamptz,
  fotografia jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
BEGIN
  IF v_usuario IS NULL OR NOT (
    public.pode_editar_proposta_editor(v_usuario)
    OR public.has_role(v_usuario, 'engenharia')
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente para consultar origens comerciais';
  END IF;

  RETURN QUERY
  SELECT
    obra.id,
    obra.numero,
    obra.nome,
    obra.cliente_id,
    orc.id,
    orc.created_at,
    revisao.id,
    revisao.numero,
    revisao.created_at,
    CASE
      WHEN COALESCE(p_incluir_fotografia, false)
        THEN public.construir_fotografia_comercial(revisao.id, '{}'::jsonb)
      ELSE NULL::jsonb
    END
  FROM public.orcamento_revisoes revisao
  JOIN public.orcamentos orc ON orc.id = revisao.orcamento_id
  JOIN public.obras obra ON obra.id = orc.obra_id
  WHERE (p_obra_id IS NULL OR obra.id = p_obra_id)
    AND (p_revisao_id IS NULL OR revisao.id = p_revisao_id)
  ORDER BY obra.nome, orc.created_at DESC, revisao.numero DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_proposta_de_revisao(
  p_orcamento_revisao_id uuid,
  p_configuracao jsonb,
  p_fotografia jsonb,
  p_duplicar boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_proposta_id uuid;
  v_cliente_id uuid;
  v_obra_nome text;
  v_titulo text;
  v_valor numeric(14,2);
  v_fotografia jsonb;
  v_duplicada_de_id uuid;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para criar proposta';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_orcamento_revisao_id::text, 200));

  SELECT o.cliente_id, o.nome
    INTO v_cliente_id, v_obra_nome
    FROM public.orcamento_revisoes r
    JOIN public.orcamentos orc ON orc.id = r.orcamento_id
    JOIN public.obras o ON o.id = orc.obra_id
   WHERE r.id = p_orcamento_revisao_id;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Revisão de orçamento não encontrada ou sem obra/cliente';
  END IF;

  IF NOT COALESCE(p_duplicar, false) THEN
    SELECT p.id
      INTO v_proposta_id
      FROM public.propostas p
     WHERE p.orcamento_revisao_id = p_orcamento_revisao_id
       AND NOT p.variante_comercial
     ORDER BY p.created_at
     LIMIT 1;
    IF v_proposta_id IS NOT NULL THEN
      RETURN v_proposta_id;
    END IF;
  ELSE
    SELECT p.id INTO v_duplicada_de_id
      FROM public.propostas p
     WHERE p.orcamento_revisao_id = p_orcamento_revisao_id
       AND NOT p.variante_comercial
     ORDER BY p.created_at
     LIMIT 1;
  END IF;

  v_titulo := NULLIF(BTRIM(COALESCE(p_configuracao, '{}'::jsonb)->>'tituloProposta'), '');
  v_titulo := COALESCE(v_titulo, 'Proposta Comercial - ' || v_obra_nome);
  v_fotografia := public.construir_fotografia_comercial(p_orcamento_revisao_id, p_configuracao);
  v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;

  INSERT INTO public.propostas(
    numero, cliente_id, titulo, valor_total, status, created_by,
    orcamento_revisao_id, variante_comercial, duplicada_de_id
  ) VALUES (
    '', v_cliente_id, v_titulo, v_valor, 'rascunho', v_usuario,
    p_orcamento_revisao_id, COALESCE(p_duplicar, false), v_duplicada_de_id
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO public.proposta_revisoes(
    proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
  ) VALUES (
    v_proposta_id, p_orcamento_revisao_id, 1, 'rascunho',
    COALESCE(p_configuracao, '{}'::jsonb),
    v_fotografia
  );

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
  v_valor numeric(14,2);
  v_fotografia jsonb;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para salvar proposta';
  END IF;

  SELECT * INTO v_proposta FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_proposta.status = 'aceita' THEN RAISE EXCEPTION 'Proposta aceita está congelada'; END IF;

  SELECT * INTO v_revisao
    FROM public.proposta_revisoes
   WHERE proposta_id = p_proposta_id
   ORDER BY numero DESC
   LIMIT 1
   FOR UPDATE;

  v_fotografia := public.construir_fotografia_comercial(v_proposta.orcamento_revisao_id, p_configuracao);
  v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;

  IF NOT FOUND THEN
    IF v_proposta.orcamento_revisao_id IS NULL THEN
      RAISE EXCEPTION 'Proposta sem revisão de orçamento vinculada';
    END IF;
    INSERT INTO public.proposta_revisoes(
      proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
    ) VALUES (
      p_proposta_id, v_proposta.orcamento_revisao_id, 1, 'rascunho',
      COALESCE(p_configuracao, '{}'::jsonb),
      v_fotografia
    ) RETURNING id INTO v_revisao_id;
  ELSIF v_revisao.status = 'rascunho' THEN
    UPDATE public.proposta_revisoes
       SET configuracao = COALESCE(p_configuracao, '{}'::jsonb),
           fotografia = v_fotografia
     WHERE id = v_revisao.id
     RETURNING id INTO v_revisao_id;
  ELSIF v_revisao.status IN ('rejeitada', 'expirada') THEN
    v_proximo_numero := v_revisao.numero + 1;
    INSERT INTO public.proposta_revisoes(
      proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
    ) VALUES (
      p_proposta_id, v_proposta.orcamento_revisao_id, v_proximo_numero, 'rascunho',
      COALESCE(p_configuracao, '{}'::jsonb),
      v_fotografia
    ) RETURNING id INTO v_revisao_id;
  ELSE
    RAISE EXCEPTION 'A revisão % está %; rejeite ou expire antes de criar novo rascunho', v_revisao.numero, v_revisao.status;
  END IF;

  UPDATE public.propostas
     SET status = 'rascunho', valor_total = v_valor
   WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicar_proposta_editor(
  p_proposta_origem_id uuid,
  p_orcamento_revisao_id uuid,
  p_configuracao jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_cliente_origem uuid;
  v_revisao_origem uuid;
  v_cliente_revisao uuid;
  v_proposta_id uuid;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para duplicar proposta';
  END IF;
  SELECT cliente_id, orcamento_revisao_id INTO v_cliente_origem, v_revisao_origem
    FROM public.propostas
   WHERE id = p_proposta_origem_id;
  IF v_cliente_origem IS NULL THEN RAISE EXCEPTION 'Proposta de origem não encontrada'; END IF;
  IF v_revisao_origem IS NULL OR v_revisao_origem <> p_orcamento_revisao_id THEN
    RAISE EXCEPTION 'A variação deve usar a mesma revisão técnica da proposta de origem';
  END IF;

  SELECT obra.cliente_id INTO v_cliente_revisao
    FROM public.orcamento_revisoes revisao
    JOIN public.orcamentos orcamento ON orcamento.id = revisao.orcamento_id
    JOIN public.obras obra ON obra.id = orcamento.obra_id
   WHERE revisao.id = p_orcamento_revisao_id;
  IF v_cliente_revisao IS NULL OR v_cliente_revisao <> v_cliente_origem THEN
    RAISE EXCEPTION 'A revisão selecionada não pertence ao cliente da proposta de origem';
  END IF;

  v_proposta_id := public.criar_proposta_de_revisao(
    p_orcamento_revisao_id,
    p_configuracao,
    '{}'::jsonb,
    true
  );
  UPDATE public.propostas
     SET duplicada_de_id = p_proposta_origem_id
   WHERE id = v_proposta_id;
  RETURN v_proposta_id;
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
  v_valor numeric(14,2);
  v_fotografia jsonb;
  v_orcamento_revisao_id uuid;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para publicar proposta';
  END IF;

  PERFORM 1 FROM public.propostas WHERE id = p_proposta_id AND status = 'rascunho' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente proposta em rascunho pode ser publicada'; END IF;

  SELECT orcamento_revisao_id INTO v_orcamento_revisao_id
    FROM public.propostas WHERE id = p_proposta_id;
  v_fotografia := public.construir_fotografia_comercial(v_orcamento_revisao_id, p_configuracao);

  UPDATE public.proposta_revisoes
     SET status = 'enviada',
         configuracao = COALESCE(p_configuracao, '{}'::jsonb),
         fotografia = v_fotografia,
         enviada_at = now()
   WHERE id = (
     SELECT id FROM public.proposta_revisoes
      WHERE proposta_id = p_proposta_id AND status = 'rascunho'
      ORDER BY numero DESC LIMIT 1
      FOR UPDATE
   )
   RETURNING id INTO v_revisao_id;
  IF v_revisao_id IS NULL THEN RAISE EXCEPTION 'Revisão em rascunho não encontrada'; END IF;

  v_valor := COALESCE(NULLIF(v_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
  UPDATE public.propostas
     SET status = 'enviada', valor_total = v_valor, data_envio = CURRENT_DATE
   WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.excluir_proposta_rascunho(p_proposta_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_status public.status_proposta;
BEGIN
  IF v_usuario IS NULL OR NOT (
    public.has_role(v_usuario, 'admin') OR public.has_role(v_usuario, 'diretor')
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente para excluir proposta';
  END IF;

  SELECT status INTO v_status FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_status <> 'rascunho' THEN
    RAISE EXCEPTION 'Somente proposta em rascunho pode ser excluída definitivamente';
  END IF;

  DELETE FROM public.propostas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível confirmar a exclusão da proposta'; END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.vincular_proposta_legada_revisao(
  p_proposta_id uuid,
  p_orcamento_revisao_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_cliente_proposta uuid;
  v_cliente_revisao uuid;
  v_obra_proposta uuid;
  v_obra_revisao uuid;
  v_status public.status_proposta;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para vincular proposta legada';
  END IF;
  SELECT cliente_id, status INTO v_cliente_proposta, v_status
    FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_status <> 'rascunho' THEN RAISE EXCEPTION 'Somente rascunho legado pode receber uma revisão de origem'; END IF;
  IF EXISTS (SELECT 1 FROM public.proposta_revisoes WHERE proposta_id = p_proposta_id) THEN
    RAISE EXCEPTION 'A proposta já possui histórico comercial';
  END IF;
  SELECT id INTO v_obra_proposta
    FROM public.obras
   WHERE proposta_id = p_proposta_id;
  IF v_obra_proposta IS NULL THEN
    RAISE EXCEPTION 'A proposta legada precisa estar vinculada explicitamente a uma obra';
  END IF;
  SELECT obra.cliente_id, obra.id INTO v_cliente_revisao, v_obra_revisao
    FROM public.orcamento_revisoes revisao
    JOIN public.orcamentos orcamento ON orcamento.id = revisao.orcamento_id
    JOIN public.obras obra ON obra.id = orcamento.obra_id
   WHERE revisao.id = p_orcamento_revisao_id;
  IF v_cliente_revisao IS NULL OR v_cliente_revisao <> v_cliente_proposta THEN
    RAISE EXCEPTION 'A revisão selecionada não pertence ao cliente da proposta';
  END IF;
  IF v_obra_revisao <> v_obra_proposta THEN
    RAISE EXCEPTION 'A revisão selecionada não pertence à obra vinculada à proposta';
  END IF;
  UPDATE public.propostas
     SET orcamento_revisao_id = p_orcamento_revisao_id
   WHERE id = p_proposta_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.alterar_status_proposta_editor(
  p_proposta_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_status_atual public.status_proposta;
  v_revisao_id uuid;
  v_orcamento_revisao_id uuid;
  v_fotografia jsonb;
  v_obra_id uuid;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para alterar status da proposta';
  END IF;
  IF p_status NOT IN ('aceita', 'rejeitada', 'expirada') THEN
    RAISE EXCEPTION 'Transição de status inválida: %', p_status;
  END IF;

  SELECT status INTO v_status_atual
    FROM public.propostas
   WHERE id = p_proposta_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_status_atual <> 'enviada' THEN
    RAISE EXCEPTION 'Somente proposta enviada pode ser aceita, rejeitada ou expirada';
  END IF;

  UPDATE public.proposta_revisoes
     SET status = p_status
   WHERE id = (
     SELECT id FROM public.proposta_revisoes
      WHERE proposta_id = p_proposta_id AND status = 'enviada'
      ORDER BY numero DESC LIMIT 1
      FOR UPDATE
   )
   RETURNING id, orcamento_revisao_id, fotografia
        INTO v_revisao_id, v_orcamento_revisao_id, v_fotografia;
  IF v_revisao_id IS NULL THEN RAISE EXCEPTION 'Revisão enviada não encontrada'; END IF;

  IF p_status = 'aceita' AND v_orcamento_revisao_id IS NOT NULL THEN
    SELECT obra.id INTO v_obra_id
      FROM public.orcamento_revisoes revisao
      JOIN public.orcamentos orcamento ON orcamento.id = revisao.orcamento_id
      JOIN public.obras obra ON obra.id = orcamento.obra_id
     WHERE revisao.id = v_orcamento_revisao_id
     FOR UPDATE OF obra;
    IF v_obra_id IS NULL THEN
      RAISE EXCEPTION 'Obra de origem da proposta não encontrada';
    END IF;

    -- Vincula antes da mudança de status. Assim, o trigger legado de aceite
    -- encontra a obra original e não cria uma segunda obra para a proposta.
    UPDATE public.obras
       SET proposta_id = p_proposta_id
     WHERE id = v_obra_id;
    UPDATE public.obras_cronogramas
       SET proposta_id = p_proposta_id
     WHERE obra_id = v_obra_id;

    -- O cronograma e as medições legadas consomem propostas_itens. Materializa
    -- a fotografia comercial congelada sem reintroduzir custos/insumos.
    DELETE FROM public.propostas_itens WHERE proposta_id = p_proposta_id;
    INSERT INTO public.propostas_itens(
      proposta_id, descricao, quantidade, valor_unitario, ordem, unidade,
      etapa_codigo, etapa_nome, item_codigo, item_nome
    )
    WITH etapas AS (
      SELECT etapa, etapa_ordem
        FROM jsonb_array_elements(COALESCE(v_fotografia->'etapas', '[]'::jsonb))
             WITH ORDINALITY AS e(etapa, etapa_ordem)
    ), linhas AS (
      SELECT
        etapa,
        atividade,
        etapa_ordem,
        atividade_ordem
      FROM etapas
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(etapa->'atividades', '[]'::jsonb))
           WITH ORDINALITY AS a(atividade, atividade_ordem)
      UNION ALL
      SELECT etapa, NULL::jsonb, etapa_ordem, 1::bigint
        FROM etapas
       WHERE jsonb_array_length(COALESCE(etapa->'atividades', '[]'::jsonb)) = 0
    )
    SELECT
      p_proposta_id,
      COALESCE(NULLIF(atividade->>'descricao', ''), NULLIF(etapa->>'nome', ''), 'Serviço'),
      COALESCE(NULLIF(NULLIF(atividade->>'quantidade', '')::numeric, 0), 1),
      COALESCE(
        NULLIF(atividade->>'precoUnitarioCentavos', '')::numeric,
        NULLIF(etapa->>'valorTotalCentavos', '')::numeric,
        0
      ) / 100,
      ((etapa_ordem - 1) * 10000 + atividade_ordem)::integer,
      COALESCE(NULLIF(atividade->>'unidade', ''), 'un'),
      COALESCE(NULLIF(etapa->>'codigo', ''), etapa_ordem::text),
      COALESCE(NULLIF(etapa->>'nome', ''), 'Etapa'),
      NULLIF(atividade->>'codigo', ''),
      COALESCE(NULLIF(atividade->>'descricao', ''), NULLIF(etapa->>'nome', ''), 'Serviço')
    FROM linhas;
  END IF;

  UPDATE public.propostas
     SET status = p_status::public.status_proposta
   WHERE id = p_proposta_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.materializar_origem_analitica_proposta(
  p_proposta_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_status public.status_proposta;
  v_orcamento_id uuid;
  v_revisao_id uuid;
  v_chave text := 'proposta-legada-' || p_proposta_id::text;
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para migrar proposta legada';
  END IF;
  SELECT status INTO v_status FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada'; END IF;
  IF v_status <> 'rascunho' THEN RAISE EXCEPTION 'Somente rascunho legado pode ser migrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.proposta_revisoes WHERE proposta_id = p_proposta_id) THEN
    RAISE EXCEPTION 'A proposta já possui histórico comercial';
  END IF;

  SELECT orcamento.id INTO v_orcamento_id
    FROM public.obras obra
    JOIN public.orcamentos orcamento ON orcamento.obra_id = obra.id
   WHERE obra.proposta_id = p_proposta_id
   ORDER BY orcamento.created_at DESC
   LIMIT 1;
  IF v_orcamento_id IS NULL THEN
    RAISE EXCEPTION 'A proposta não possui obra com orçamento analítico vinculado';
  END IF;

  SELECT id INTO v_revisao_id
    FROM public.orcamento_revisoes
   WHERE orcamento_id = v_orcamento_id AND chave_idempotencia = v_chave;
  IF v_revisao_id IS NULL THEN
    INSERT INTO public.orcamento_revisoes(
      orcamento_id, numero, chave_idempotencia, fotografia, created_by
    )
    SELECT
      orcamento.id,
      COALESCE((SELECT max(numero) + 1 FROM public.orcamento_revisoes WHERE orcamento_id = orcamento.id), 1),
      v_chave,
      jsonb_build_object(
        'orcamento', to_jsonb(orcamento),
        'etapas', COALESCE((SELECT jsonb_agg(to_jsonb(etapa) ORDER BY etapa.ordem) FROM public.orcamento_etapas etapa WHERE etapa.orcamento_id = orcamento.id), '[]'::jsonb),
        'atividades', COALESCE((SELECT jsonb_agg(to_jsonb(atividade) ORDER BY atividade.ordem) FROM public.orcamento_atividades atividade JOIN public.orcamento_etapas etapa ON etapa.id = atividade.etapa_id WHERE etapa.orcamento_id = orcamento.id), '[]'::jsonb),
        'insumos', COALESCE((SELECT jsonb_agg(to_jsonb(insumo) ORDER BY insumo.ordem) FROM public.orcamento_atividade_insumos insumo JOIN public.orcamento_atividades atividade ON atividade.id = insumo.atividade_id JOIN public.orcamento_etapas etapa ON etapa.id = atividade.etapa_id WHERE etapa.orcamento_id = orcamento.id), '[]'::jsonb),
        'memoriais', COALESCE((SELECT jsonb_agg(to_jsonb(memorial) ORDER BY memorial.ordem) FROM public.orcamento_memoriais memorial JOIN public.orcamento_atividades atividade ON atividade.id = memorial.atividade_id JOIN public.orcamento_etapas etapa ON etapa.id = atividade.etapa_id WHERE etapa.orcamento_id = orcamento.id), '[]'::jsonb)
      ),
      v_usuario
    FROM public.orcamentos orcamento
    WHERE orcamento.id = v_orcamento_id
    RETURNING id INTO v_revisao_id;
  END IF;

  UPDATE public.propostas
     SET orcamento_revisao_id = v_revisao_id
   WHERE id = p_proposta_id;
  RETURN v_revisao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sanitizar_fotografia_proposta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.construir_fotografia_comercial(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.listar_origens_proposta_editor(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pode_editar_proposta_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_rascunho_proposta(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.duplicar_proposta_editor(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publicar_rascunho_proposta(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_proposta_rascunho(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vincular_proposta_legada_revisao(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.alterar_status_proposta_editor(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.materializar_origem_analitica_proposta(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_origens_proposta_editor(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_rascunho_proposta(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicar_proposta_editor(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_rascunho_proposta(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_proposta_rascunho(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_proposta_legada_revisao(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alterar_status_proposta_editor(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.materializar_origem_analitica_proposta(uuid) TO authenticated;

-- O ciclo de vida comercial só pode ser alterado pelas RPCs acima. Leituras
-- continuam disponíveis aos perfis operacionais autorizados.
REVOKE INSERT, UPDATE, DELETE ON public.propostas FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.proposta_revisoes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.propostas_itens FROM authenticated;
GRANT SELECT ON public.propostas, public.proposta_revisoes, public.propostas_itens TO authenticated;

DROP POLICY IF EXISTS proposta_editor_financeiro_civil_select ON public.propostas;
CREATE POLICY proposta_editor_financeiro_civil_select ON public.propostas
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'financeiro_civil'));
DROP POLICY IF EXISTS proposta_itens_editor_financeiro_civil_select ON public.propostas_itens;
CREATE POLICY proposta_itens_editor_financeiro_civil_select ON public.propostas_itens
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'financeiro_civil'));
DROP POLICY IF EXISTS obras_editor_financeiro_civil_select ON public.obras;
CREATE POLICY obras_editor_financeiro_civil_select ON public.obras
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'financeiro_civil'));
DROP POLICY IF EXISTS clientes_editor_financeiro_civil_select ON public.clientes;
CREATE POLICY clientes_editor_financeiro_civil_select ON public.clientes
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'financeiro_civil'));

ALTER TABLE public.proposta_revisoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analitico_gestao ON public.proposta_revisoes;
DROP POLICY IF EXISTS proposta_revisoes_editor_leitura ON public.proposta_revisoes;
CREATE POLICY proposta_revisoes_editor_leitura ON public.proposta_revisoes
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'diretor')
  OR public.has_role(auth.uid(), 'financeiro')
  OR public.has_role(auth.uid(), 'financeiro_civil')
  OR public.has_role(auth.uid(), 'engenharia')
);

DROP POLICY IF EXISTS analitico_revisoes_leitura ON public.orcamento_revisoes;
CREATE POLICY analitico_revisoes_leitura ON public.orcamento_revisoes
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'diretor')
  OR public.has_role(auth.uid(), 'engenharia')
);

-- Rollback manual, somente se nenhuma revisão nova precisar ser preservada:
-- DROP FUNCTION IF EXISTS public.excluir_proposta_rascunho(uuid);
-- DROP FUNCTION IF EXISTS public.vincular_proposta_legada_revisao(uuid,uuid);
-- DROP FUNCTION IF EXISTS public.alterar_status_proposta_editor(uuid,text);
-- DROP FUNCTION IF EXISTS public.materializar_origem_analitica_proposta(uuid);
-- DROP FUNCTION IF EXISTS public.publicar_rascunho_proposta(uuid,jsonb,jsonb);
-- DROP FUNCTION IF EXISTS public.salvar_rascunho_proposta(uuid,jsonb,jsonb);
-- DROP FUNCTION IF EXISTS public.duplicar_proposta_editor(uuid,uuid,jsonb);
-- DROP FUNCTION IF EXISTS public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean);
-- DROP FUNCTION IF EXISTS public.pode_editar_proposta_editor(uuid);
-- DROP FUNCTION IF EXISTS public.listar_origens_proposta_editor(uuid,uuid,boolean);
-- DROP FUNCTION IF EXISTS public.construir_fotografia_comercial(uuid,jsonb);
-- DROP FUNCTION IF EXISTS public.sanitizar_fotografia_proposta(jsonb);
-- DROP TRIGGER IF EXISTS trg_proposta_revisoes_updated_at ON public.proposta_revisoes;
-- ALTER TABLE public.proposta_revisoes DROP COLUMN IF EXISTS enviada_at, DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE public.propostas DROP COLUMN IF EXISTS duplicada_de_id, DROP COLUMN IF EXISTS variante_comercial;
