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
    OR public.has_role(p_usuario, 'financeiro_civil')
    OR public.has_role(p_usuario, 'financeiro_imobiliaria');
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
       AND p.status = 'rascunho'
       AND NOT p.variante_comercial
     ORDER BY p.created_at
     LIMIT 1;
    IF v_proposta_id IS NOT NULL THEN
      RETURN v_proposta_id;
    END IF;
  END IF;

  v_titulo := NULLIF(BTRIM(COALESCE(p_configuracao, '{}'::jsonb)->>'tituloProposta'), '');
  v_titulo := COALESCE(v_titulo, 'Proposta Comercial - ' || v_obra_nome);
  v_valor := COALESCE(NULLIF(p_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;

  INSERT INTO public.propostas(
    numero, cliente_id, titulo, valor_total, status, created_by,
    orcamento_revisao_id, variante_comercial
  ) VALUES (
    '', v_cliente_id, v_titulo, v_valor, 'rascunho', v_usuario,
    p_orcamento_revisao_id, COALESCE(p_duplicar, false)
  ) RETURNING id INTO v_proposta_id;

  INSERT INTO public.proposta_revisoes(
    proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
  ) VALUES (
    v_proposta_id, p_orcamento_revisao_id, 1, 'rascunho',
    COALESCE(p_configuracao, '{}'::jsonb),
    public.sanitizar_fotografia_proposta(COALESCE(p_fotografia, '{}'::jsonb))
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

  v_valor := COALESCE(NULLIF(p_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;

  IF NOT FOUND THEN
    IF v_proposta.orcamento_revisao_id IS NULL THEN
      RAISE EXCEPTION 'Proposta sem revisão de orçamento vinculada';
    END IF;
    INSERT INTO public.proposta_revisoes(
      proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
    ) VALUES (
      p_proposta_id, v_proposta.orcamento_revisao_id, 1, 'rascunho',
      COALESCE(p_configuracao, '{}'::jsonb),
      public.sanitizar_fotografia_proposta(COALESCE(p_fotografia, '{}'::jsonb))
    ) RETURNING id INTO v_revisao_id;
  ELSIF v_revisao.status = 'rascunho' THEN
    UPDATE public.proposta_revisoes
       SET configuracao = COALESCE(p_configuracao, '{}'::jsonb),
           fotografia = public.sanitizar_fotografia_proposta(COALESCE(p_fotografia, '{}'::jsonb))
     WHERE id = v_revisao.id
     RETURNING id INTO v_revisao_id;
  ELSIF v_revisao.status IN ('rejeitada', 'expirada') THEN
    v_proximo_numero := v_revisao.numero + 1;
    INSERT INTO public.proposta_revisoes(
      proposta_id, orcamento_revisao_id, numero, status, configuracao, fotografia
    ) VALUES (
      p_proposta_id, v_proposta.orcamento_revisao_id, v_proximo_numero, 'rascunho',
      COALESCE(p_configuracao, '{}'::jsonb),
      public.sanitizar_fotografia_proposta(COALESCE(p_fotografia, '{}'::jsonb))
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
BEGIN
  IF v_usuario IS NULL OR NOT public.pode_editar_proposta_editor(v_usuario) THEN
    RAISE EXCEPTION 'Permissão insuficiente para publicar proposta';
  END IF;

  PERFORM 1 FROM public.propostas WHERE id = p_proposta_id AND status = 'rascunho' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Somente proposta em rascunho pode ser publicada'; END IF;

  UPDATE public.proposta_revisoes
     SET status = 'enviada',
         configuracao = COALESCE(p_configuracao, '{}'::jsonb),
         fotografia = public.sanitizar_fotografia_proposta(COALESCE(p_fotografia, '{}'::jsonb)),
         enviada_at = now()
   WHERE id = (
     SELECT id FROM public.proposta_revisoes
      WHERE proposta_id = p_proposta_id AND status = 'rascunho'
      ORDER BY numero DESC LIMIT 1
      FOR UPDATE
   )
   RETURNING id INTO v_revisao_id;
  IF v_revisao_id IS NULL THEN RAISE EXCEPTION 'Revisão em rascunho não encontrada'; END IF;

  v_valor := COALESCE(NULLIF(p_fotografia->>'totalPrecoCentavos', '')::numeric, 0) / 100;
  UPDATE public.propostas SET status = 'enviada', valor_total = v_valor WHERE id = p_proposta_id;
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

REVOKE ALL ON FUNCTION public.sanitizar_fotografia_proposta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pode_editar_proposta_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.salvar_rascunho_proposta(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publicar_rascunho_proposta(uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.excluir_proposta_rascunho(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_rascunho_proposta(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publicar_rascunho_proposta(uuid,jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_proposta_rascunho(uuid) TO authenticated;

-- Rollback manual, somente se nenhuma revisão nova precisar ser preservada:
-- DROP FUNCTION IF EXISTS public.excluir_proposta_rascunho(uuid);
-- DROP FUNCTION IF EXISTS public.publicar_rascunho_proposta(uuid,jsonb,jsonb);
-- DROP FUNCTION IF EXISTS public.salvar_rascunho_proposta(uuid,jsonb,jsonb);
-- DROP FUNCTION IF EXISTS public.criar_proposta_de_revisao(uuid,jsonb,jsonb,boolean);
-- DROP FUNCTION IF EXISTS public.pode_editar_proposta_editor(uuid);
-- DROP FUNCTION IF EXISTS public.sanitizar_fotografia_proposta(jsonb);
-- DROP TRIGGER IF EXISTS trg_proposta_revisoes_updated_at ON public.proposta_revisoes;
-- ALTER TABLE public.proposta_revisoes DROP COLUMN IF EXISTS enviada_at, DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE public.propostas DROP COLUMN IF EXISTS duplicada_de_id, DROP COLUMN IF EXISTS variante_comercial;
