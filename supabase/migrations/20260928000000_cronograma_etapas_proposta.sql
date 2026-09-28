-- Meta de execução de CADA etapa. Preserva o antigo peso planejado, sem
-- reinterpretá-lo como avanço e sem limitar a soma entre etapas independentes.
ALTER TABLE public.obra_cronograma
  ADD COLUMN IF NOT EXISTS etapa_origem_key text,
  ADD COLUMN IF NOT EXISTS meta_percentual numeric(5,2) NOT NULL DEFAULT 100;
ALTER TABLE public.obra_cronograma ALTER COLUMN progresso TYPE numeric(5,2);
ALTER TABLE public.obra_cronograma DROP CONSTRAINT IF EXISTS cronograma_meta_execucao_check;
ALTER TABLE public.obra_cronograma ADD CONSTRAINT cronograma_meta_execucao_check
  CHECK (meta_percentual > 0 AND meta_percentual <= 100);
DROP TRIGGER IF EXISTS obra_cronograma_validar_percentual_planejado ON public.obra_cronograma;
CREATE UNIQUE INDEX IF NOT EXISTS cronograma_etapa_proposta_unica
  ON public.obra_cronograma (obra_id, etapa_origem_key)
  WHERE etapa_origem_key IS NOT NULL;

-- Somente triggers internos/administrador chamam esta função. Não é um RPC público.
CREATE OR REPLACE FUNCTION public.importar_etapas_cronograma(p_obra_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposta uuid;
  v_etapa record;
  v_legado uuid;
  v_ordem integer;
BEGIN
  SELECT proposta_id INTO v_proposta FROM public.obras WHERE id = p_obra_id FOR UPDATE;
  IF v_proposta IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.propostas WHERE id = v_proposta AND status = 'aceita') THEN RETURN; END IF;
  FOR v_etapa IN
    SELECT jsonb_build_array(NULLIF(trim(etapa_codigo), ''),
             COALESCE(NULLIF(trim(etapa_nome), ''), NULLIF(trim(item_nome), ''), descricao))::text AS chave,
           COALESCE(NULLIF(trim(etapa_nome), ''), NULLIF(trim(item_nome), ''), descricao) AS nome,
           min(ordem) AS ordem
      FROM public.propostas_itens WHERE proposta_id = v_proposta
     GROUP BY 1, 2 ORDER BY min(ordem), 1
  LOOP
    IF EXISTS (SELECT 1 FROM public.obra_cronograma WHERE obra_id = p_obra_id AND etapa_origem_key = v_etapa.chave) THEN CONTINUE; END IF;
    -- Reaproveita uma etapa manual de mesmo nome, preservando datas e realizado.
    SELECT id INTO v_legado FROM public.obra_cronograma
      WHERE obra_id = p_obra_id AND etapa_origem_key IS NULL AND lower(trim(nome)) = lower(v_etapa.nome)
      ORDER BY ordem, id LIMIT 1;
    IF v_legado IS NOT NULL THEN
      UPDATE public.obra_cronograma SET etapa_origem_key = v_etapa.chave WHERE id = v_legado;
    ELSE
      SELECT COALESCE(max(ordem), 0) + 1 INTO v_ordem FROM public.obra_cronograma WHERE obra_id = p_obra_id;
      INSERT INTO public.obra_cronograma (obra_id, nome, ordem, etapa_origem_key, meta_percentual, progresso, status)
        VALUES (p_obra_id, v_etapa.nome, v_ordem, v_etapa.chave, 100, 0, 'planejado');
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.importar_etapas_cronograma(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.criar_cronograma_da_obra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.obras_cronogramas (obra_id, proposta_id)
    VALUES (NEW.id, NEW.proposta_id) ON CONFLICT (obra_id) DO NOTHING;
  PERFORM public.importar_etapas_cronograma(NEW.id);
  RETURN NEW;
END;
$$;
-- Abrange criação da obra e vínculo posterior de uma proposta.
DROP TRIGGER IF EXISTS obras_criar_cronograma ON public.obras;
CREATE TRIGGER obras_criar_cronograma AFTER INSERT OR UPDATE OF proposta_id ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.criar_cronograma_da_obra();

-- O formulário pode salvar a proposta já aceita ANTES de inserir seus itens.
-- Também cobre reaceite de proposta e inclusão posterior de novos serviços.
CREATE OR REPLACE FUNCTION public.importar_cronograma_apos_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_proposta uuid;
BEGIN
  IF TG_TABLE_NAME = 'propostas' THEN v_proposta := NEW.id;
  ELSE v_proposta := NEW.proposta_id; END IF;
  FOR v_id IN SELECT id FROM public.obras WHERE proposta_id = v_proposta LOOP
    PERFORM public.importar_etapas_cronograma(v_id);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS propostas_importar_cronograma ON public.propostas;
CREATE TRIGGER propostas_importar_cronograma AFTER UPDATE OF status ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.importar_cronograma_apos_proposta();
DROP TRIGGER IF EXISTS propostas_itens_importar_cronograma ON public.propostas_itens;
CREATE TRIGGER propostas_itens_importar_cronograma AFTER INSERT OR UPDATE OF etapa_codigo, etapa_nome, item_nome, descricao ON public.propostas_itens
  FOR EACH ROW EXECUTE FUNCTION public.importar_cronograma_apos_proposta();

SELECT public.importar_etapas_cronograma(id)
  FROM public.obras
 WHERE proposta_id IS NOT NULL;

-- Somente leitura das etapas da obra pertencente ao cliente autenticado.
DROP POLICY IF EXISTS cronograma_cliente_proprio ON public.obra_cronograma;
CREATE POLICY cronograma_cliente_proprio ON public.obra_cronograma
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.obras o JOIN public.clientes c ON c.id = o.cliente_id
    WHERE o.id = obra_cronograma.obra_id AND c.auth_user_id = auth.uid() AND c.deleted_at IS NULL
  ));

NOTIFY pgrst, 'reload schema';
