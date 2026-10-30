-- Issue #197 — orçamento analítico, revisões e catálogo SINAPI.
-- Migração estritamente aditiva. A reversão documentada está no final do arquivo.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS uf char(2),
  ADD COLUMN IF NOT EXISTS competencia text,
  ADD COLUMN IF NOT EXISTS regime text,
  ADD COLUMN IF NOT EXISTS bdi_geral numeric(8,4) NOT NULL DEFAULT 0 CHECK (bdi_geral >= 0 AND bdi_geral <= 1000),
  ADD COLUMN IF NOT EXISTS analitico_ativo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.orcamento_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.orcamento_etapas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  bdi_percentual numeric(8,4) CHECK (bdi_percentual IS NULL OR (bdi_percentual >= 0 AND bdi_percentual <= 1000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.orcamento_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.orcamento_etapas(id) ON DELETE CASCADE,
  codigo text,
  descricao text NOT NULL,
  unidade text NOT NULL,
  quantidade numeric(18,6) NOT NULL DEFAULT 1 CHECK (quantidade >= 0),
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  fonte text NOT NULL DEFAULT 'propria' CHECK (fonte IN ('sinapi','propria','legado')),
  codigo_referencia text,
  bdi_percentual numeric(8,4) CHECK (bdi_percentual IS NULL OR (bdi_percentual >= 0 AND bdi_percentual <= 1000)),
  legado_conferir boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orcamento_atividade_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.orcamento_atividades(id) ON DELETE CASCADE,
  parent_insumo_id uuid REFERENCES public.orcamento_atividade_insumos(id) ON DELETE CASCADE,
  referencia_insumo_id uuid REFERENCES public.referencia_insumos(id) ON DELETE SET NULL,
  referencia_composicao_id uuid REFERENCES public.referencia_composicoes(id) ON DELETE SET NULL,
  codigo text,
  descricao text NOT NULL,
  unidade text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('mao_de_obra','material','equipamento','outros')),
  coeficiente numeric(20,8) NOT NULL CHECK (coeficiente >= 0),
  preco_unitario_centavos bigint NOT NULL CHECK (preco_unitario_centavos >= 0),
  preco_manual boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  caminho_tecnico text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orcamento_memoriais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id uuid NOT NULL REFERENCES public.orcamento_atividades(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  formula text NOT NULL,
  resultado numeric(18,6) NOT NULL CHECK (resultado >= 0),
  ordem integer NOT NULL DEFAULT 0 CHECK (ordem >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orcamento_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE RESTRICT,
  numero integer NOT NULL CHECK (numero > 0),
  chave_idempotencia text NOT NULL,
  fotografia jsonb NOT NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orcamento_id, numero),
  UNIQUE (orcamento_id, chave_idempotencia)
);

CREATE TABLE IF NOT EXISTS public.orcamento_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL CHECK (acao IN ('INSERT','UPDATE','DELETE','PUBLICAR','DUPLICAR')),
  dados_anteriores jsonb,
  dados_novos jsonb,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proposta_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  orcamento_revisao_id uuid NOT NULL REFERENCES public.orcamento_revisoes(id) ON DELETE RESTRICT,
  numero integer NOT NULL CHECK (numero > 0),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aceita','rejeitada','expirada')),
  configuracao jsonb NOT NULL DEFAULT '{}',
  fotografia jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposta_id, numero)
);

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS orcamento_revisao_id uuid REFERENCES public.orcamento_revisoes(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.sinapi_competencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL,
  uf char(2) NOT NULL,
  regime text NOT NULL CHECK (regime IN ('desonerado','nao_desonerado')),
  status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging','validada','publicada','rejeitada')),
  hash_arquivo text NOT NULL,
  arquivo_r2_key text NOT NULL,
  publicada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competencia, uf, regime),
  UNIQUE (hash_arquivo, uf, regime)
);

CREATE TABLE IF NOT EXISTS public.sinapi_composicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid NOT NULL REFERENCES public.sinapi_competencias(id) ON DELETE CASCADE,
  composicao_codigo text NOT NULL,
  item_codigo text NOT NULL,
  item_tipo text NOT NULL CHECK (item_tipo IN ('insumo','composicao')),
  descricao text NOT NULL,
  unidade text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('mao_de_obra','material','equipamento','outros')),
  coeficiente numeric(20,8) NOT NULL CHECK (coeficiente >= 0),
  preco_unitario_centavos bigint NOT NULL CHECK (preco_unitario_centavos >= 0),
  UNIQUE (competencia_id, composicao_codigo, item_codigo, item_tipo)
);

CREATE TABLE IF NOT EXISTS public.sinapi_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id uuid REFERENCES public.sinapi_competencias(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('descoberta','baixando','processando','validando','concluida','falhou')),
  checkpoint jsonb NOT NULL DEFAULT '{}',
  detalhes jsonb NOT NULL DEFAULT '{}',
  erro_sanitizado text,
  iniciado_at timestamptz NOT NULL DEFAULT now(),
  finalizado_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orcamento_etapas_orcamento_ordem ON public.orcamento_etapas(orcamento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_orcamento_atividades_etapa_ordem ON public.orcamento_atividades(etapa_id, ordem);
CREATE INDEX IF NOT EXISTS idx_orcamento_insumos_atividade_ordem ON public.orcamento_atividade_insumos(atividade_id, ordem);
CREATE INDEX IF NOT EXISTS idx_orcamento_memoriais_atividade_ordem ON public.orcamento_memoriais(atividade_id, ordem);
CREATE INDEX IF NOT EXISTS idx_sinapi_itens_composicao ON public.sinapi_composicao_itens(competencia_id, composicao_codigo);

CREATE OR REPLACE FUNCTION public.validar_parent_etapa_orcamento()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_orcamento uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Uma etapa não pode ser pai dela mesma'; END IF;
  SELECT orcamento_id INTO parent_orcamento FROM public.orcamento_etapas WHERE id = NEW.parent_id;
  IF parent_orcamento IS NULL OR parent_orcamento <> NEW.orcamento_id THEN
    RAISE EXCEPTION 'A etapa pai deve pertencer ao mesmo orçamento';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validar_parent_etapa ON public.orcamento_etapas;
CREATE TRIGGER trg_validar_parent_etapa BEFORE INSERT OR UPDATE ON public.orcamento_etapas
FOR EACH ROW EXECUTE FUNCTION public.validar_parent_etapa_orcamento();

CREATE OR REPLACE FUNCTION public.bloquear_revisao_orcamento_aceita()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.proposta_revisoes pr WHERE pr.orcamento_revisao_id = OLD.id AND pr.status = 'aceita')
     OR EXISTS (SELECT 1 FROM public.propostas p WHERE p.orcamento_revisao_id = OLD.id AND p.status = 'aceita') THEN
    RAISE EXCEPTION 'Revisão vinculada a proposta aceita é imutável';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS trg_bloquear_revisao_aceita ON public.orcamento_revisoes;
CREATE TRIGGER trg_bloquear_revisao_aceita BEFORE UPDATE OR DELETE ON public.orcamento_revisoes
FOR EACH ROW EXECUTE FUNCTION public.bloquear_revisao_orcamento_aceita();

CREATE OR REPLACE FUNCTION public.publicar_revisao_orcamento(p_orcamento_id uuid, p_chave_idempotencia text)
RETURNS SETOF public.orcamento_revisoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE revisao public.orcamento_revisoes;
BEGIN
  IF trim(coalesce(p_chave_idempotencia, '')) = '' THEN RAISE EXCEPTION 'Chave idempotente obrigatória'; END IF;
  SELECT * INTO revisao FROM public.orcamento_revisoes
    WHERE orcamento_id = p_orcamento_id AND chave_idempotencia = p_chave_idempotencia;
  IF FOUND THEN RETURN NEXT revisao; RETURN; END IF;
  PERFORM 1 FROM public.orcamentos WHERE id = p_orcamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  INSERT INTO public.orcamento_revisoes(orcamento_id, numero, chave_idempotencia, fotografia, created_by)
  SELECT p_orcamento_id,
    coalesce((SELECT max(numero) + 1 FROM public.orcamento_revisoes WHERE orcamento_id = p_orcamento_id), 1),
    p_chave_idempotencia,
    jsonb_build_object(
      'orcamento', to_jsonb(o),
      'etapas', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.ordem) FROM public.orcamento_etapas e WHERE e.orcamento_id=o.id), '[]'::jsonb),
      'atividades', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.ordem) FROM public.orcamento_atividades a JOIN public.orcamento_etapas e ON e.id=a.etapa_id WHERE e.orcamento_id=o.id), '[]'::jsonb),
      'insumos', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem) FROM public.orcamento_atividade_insumos i JOIN public.orcamento_atividades a ON a.id=i.atividade_id JOIN public.orcamento_etapas e ON e.id=a.etapa_id WHERE e.orcamento_id=o.id), '[]'::jsonb),
      'memoriais', coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.ordem) FROM public.orcamento_memoriais m JOIN public.orcamento_atividades a ON a.id=m.atividade_id JOIN public.orcamento_etapas e ON e.id=a.etapa_id WHERE e.orcamento_id=o.id), '[]'::jsonb)
    ), auth.uid()
  FROM public.orcamentos o WHERE o.id = p_orcamento_id
  RETURNING * INTO revisao;
  INSERT INTO public.orcamento_auditoria(orcamento_id,entidade,entidade_id,acao,dados_novos,usuario_id)
    VALUES (p_orcamento_id,'orcamento_revisoes',revisao.id,'PUBLICAR',to_jsonb(revisao),auth.uid());
  RETURN NEXT revisao;
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO revisao FROM public.orcamento_revisoes WHERE orcamento_id=p_orcamento_id AND chave_idempotencia=p_chave_idempotencia;
  RETURN NEXT revisao;
END $$;

CREATE OR REPLACE FUNCTION public.duplicar_orcamento_analitico(p_orcamento_id uuid, p_nova_obra_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo_id uuid; etapa record; nova_etapa uuid; atividade record; nova_atividade uuid;
BEGIN
  INSERT INTO public.orcamentos(obra_id,total_estimado,nome,uf,competencia,regime,bdi_geral,analitico_ativo)
  SELECT p_nova_obra_id,total_estimado,coalesce(nome,'Orçamento') || ' (cópia)',uf,competencia,regime,bdi_geral,true
  FROM public.orcamentos WHERE id=p_orcamento_id RETURNING id INTO novo_id;
  IF novo_id IS NULL THEN RAISE EXCEPTION 'Orçamento não encontrado'; END IF;
  FOR etapa IN SELECT * FROM public.orcamento_etapas WHERE orcamento_id=p_orcamento_id AND parent_id IS NULL ORDER BY ordem LOOP
    INSERT INTO public.orcamento_etapas(orcamento_id,codigo,nome,ordem,bdi_percentual)
      VALUES(novo_id,etapa.codigo,etapa.nome,etapa.ordem,etapa.bdi_percentual) RETURNING id INTO nova_etapa;
    FOR atividade IN SELECT * FROM public.orcamento_atividades WHERE etapa_id=etapa.id ORDER BY ordem LOOP
      INSERT INTO public.orcamento_atividades(etapa_id,codigo,descricao,unidade,quantidade,ordem,fonte,codigo_referencia,bdi_percentual,legado_conferir)
        VALUES(nova_etapa,atividade.codigo,atividade.descricao,atividade.unidade,atividade.quantidade,atividade.ordem,atividade.fonte,atividade.codigo_referencia,atividade.bdi_percentual,atividade.legado_conferir)
        RETURNING id INTO nova_atividade;
      INSERT INTO public.orcamento_atividade_insumos(atividade_id,codigo,descricao,unidade,categoria,coeficiente,preco_unitario_centavos,preco_manual,ordem,caminho_tecnico)
        SELECT nova_atividade,codigo,descricao,unidade,categoria,coeficiente,preco_unitario_centavos,preco_manual,ordem,caminho_tecnico FROM public.orcamento_atividade_insumos WHERE atividade_id=atividade.id;
      INSERT INTO public.orcamento_memoriais(atividade_id,descricao,formula,resultado,ordem)
        SELECT nova_atividade,descricao,formula,resultado,ordem FROM public.orcamento_memoriais WHERE atividade_id=atividade.id;
    END LOOP;
  END LOOP;
  INSERT INTO public.orcamento_auditoria(orcamento_id,entidade,entidade_id,acao,dados_novos,usuario_id)
    VALUES(novo_id,'orcamentos',novo_id,'DUPLICAR',jsonb_build_object('origem',p_orcamento_id),auth.uid());
  RETURN novo_id;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['orcamento_etapas','orcamento_atividades','orcamento_atividade_insumos','orcamento_memoriais','orcamento_revisoes','orcamento_auditoria','proposta_revisoes','sinapi_competencias','sinapi_composicao_itens','sinapi_importacoes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS analitico_gestao ON public.%I', t);
    EXECUTE format('CREATE POLICY analitico_gestao ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''diretor'') OR public.has_role(auth.uid(), ''engenharia'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''diretor'') OR public.has_role(auth.uid(), ''engenharia''))', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.orcamento_auditoria_id_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publicar_revisao_orcamento(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicar_orcamento_analitico(uuid,uuid) TO authenticated, service_role;

-- Reversão (executar somente após confirmar que não há dados a preservar):
-- ALTER TABLE public.propostas DROP COLUMN IF EXISTS orcamento_revisao_id;
-- ALTER TABLE public.orcamentos DROP COLUMN IF EXISTS nome, DROP COLUMN IF EXISTS uf,
--   DROP COLUMN IF EXISTS competencia, DROP COLUMN IF EXISTS regime,
--   DROP COLUMN IF EXISTS bdi_geral, DROP COLUMN IF EXISTS analitico_ativo;
-- DROP FUNCTION public.duplicar_orcamento_analitico(uuid,uuid);
-- DROP FUNCTION public.publicar_revisao_orcamento(uuid,text);
-- DROP TABLE public.sinapi_importacoes, public.sinapi_composicao_itens, public.sinapi_competencias,
--   public.proposta_revisoes, public.orcamento_auditoria, public.orcamento_revisoes,
--   public.orcamento_memoriais, public.orcamento_atividade_insumos, public.orcamento_atividades,
--   public.orcamento_etapas CASCADE;

