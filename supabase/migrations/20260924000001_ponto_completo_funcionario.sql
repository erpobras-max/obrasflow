-- Ponto do funcionário: marcação segura, localização, auditoria e ajustes.

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS entrada_localizacao jsonb,
  ADD COLUMN IF NOT EXISTS saida_almoco_localizacao jsonb,
  ADD COLUMN IF NOT EXISTS retorno_almoco_localizacao jsonb,
  ADD COLUMN IF NOT EXISTS saida_localizacao jsonb,
  ADD COLUMN IF NOT EXISTS dispositivo jsonb,
  ADD COLUMN IF NOT EXISTS ultima_marcacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registros_ponto_sequencia_check'
  ) THEN
    ALTER TABLE public.registros_ponto
      ADD CONSTRAINT registros_ponto_sequencia_check CHECK (
        (hora_saida_almoco IS NULL OR (hora_entrada IS NOT NULL AND hora_saida_almoco >= hora_entrada))
        AND (hora_retorno_almoco IS NULL OR (hora_saida_almoco IS NOT NULL AND hora_retorno_almoco >= hora_saida_almoco))
        AND (hora_saida IS NULL OR (hora_entrada IS NOT NULL AND hora_saida >= COALESCE(hora_retorno_almoco, hora_entrada)))
      ) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calcular_registro_ponto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _minutos numeric;
BEGIN
  NEW.updated_at := now();
  IF NEW.hora_entrada IS NOT NULL AND NEW.hora_saida IS NOT NULL THEN
    _minutos := EXTRACT(EPOCH FROM (NEW.hora_saida - NEW.hora_entrada)) / 60;
    IF NEW.hora_saida_almoco IS NOT NULL AND NEW.hora_retorno_almoco IS NOT NULL THEN
      _minutos := _minutos - EXTRACT(EPOCH FROM (NEW.hora_retorno_almoco - NEW.hora_saida_almoco)) / 60;
    END IF;
    NEW.horas_trabalhadas := GREATEST(0, round((_minutos / 60)::numeric, 2));
  ELSE
    NEW.horas_trabalhadas := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_registro_ponto ON public.registros_ponto;
CREATE TRIGGER trg_calcular_registro_ponto
  BEFORE INSERT OR UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.calcular_registro_ponto();

CREATE TABLE IF NOT EXISTS public.registros_ponto_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_ponto_id uuid NOT NULL REFERENCES public.registros_ponto(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('criacao','alteracao')),
  dados_anteriores jsonb,
  dados_novos jsonb NOT NULL,
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_auditoria_registro
  ON public.registros_ponto_auditoria(registro_ponto_id, criado_em DESC);

ALTER TABLE public.registros_ponto_auditoria ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.registros_ponto_auditoria TO authenticated;
GRANT ALL ON public.registros_ponto_auditoria TO service_role;

DROP POLICY IF EXISTS "ponto_auditoria_select" ON public.registros_ponto_auditoria;
CREATE POLICY "ponto_auditoria_select" ON public.registros_ponto_auditoria
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
    OR funcionario_id IN (SELECT id FROM public.funcionarios WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.auditar_registro_ponto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.registros_ponto_auditoria (
    registro_ponto_id, funcionario_id, acao, dados_anteriores, dados_novos, alterado_por
  ) VALUES (
    NEW.id,
    NEW.funcionario_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'criacao' ELSE 'alteracao' END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    auth.uid()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_registro_ponto ON public.registros_ponto;
CREATE TRIGGER trg_auditar_registro_ponto
  AFTER INSERT OR UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.auditar_registro_ponto();

CREATE TABLE IF NOT EXISTS public.solicitacoes_ajuste_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  registro_ponto_id uuid REFERENCES public.registros_ponto(id) ON DELETE SET NULL,
  data date NOT NULL,
  hora_entrada time,
  hora_saida_almoco time,
  hora_retorno_almoco time,
  hora_saida time,
  motivo text NOT NULL CHECK (char_length(trim(motivo)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  resposta text,
  solicitado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  analisado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  analisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_ponto_func_data
  ON public.solicitacoes_ajuste_ponto(funcionario_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_ajustes_ponto_status
  ON public.solicitacoes_ajuste_ponto(status, created_at DESC);

ALTER TABLE public.solicitacoes_ajuste_ponto ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_ajuste_ponto TO authenticated;
GRANT ALL ON public.solicitacoes_ajuste_ponto TO service_role;

DROP POLICY IF EXISTS "ajustes_ponto_select" ON public.solicitacoes_ajuste_ponto;
CREATE POLICY "ajustes_ponto_select" ON public.solicitacoes_ajuste_ponto
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
    OR funcionario_id IN (SELECT id FROM public.funcionarios WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ajustes_ponto_insert" ON public.solicitacoes_ajuste_ponto;
CREATE POLICY "ajustes_ponto_insert" ON public.solicitacoes_ajuste_ponto
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pendente'
    AND solicitado_por = auth.uid()
    AND funcionario_id IN (SELECT id FROM public.funcionarios WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ajustes_ponto_admin_update" ON public.solicitacoes_ajuste_ponto;
CREATE POLICY "ajustes_ponto_admin_update" ON public.solicitacoes_ajuste_ponto
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  );

-- Funcionários usam somente a função segura para inserir/alterar marcações.
DROP POLICY IF EXISTS "rh_ponto_funcionario_insert" ON public.registros_ponto;
DROP POLICY IF EXISTS "rh_ponto_funcionario_update" ON public.registros_ponto;

CREATE OR REPLACE FUNCTION public.registrar_ponto_funcionario(
  p_tipo text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_precisao numeric DEFAULT NULL,
  p_dispositivo jsonb DEFAULT '{}'::jsonb
)
RETURNS public.registros_ponto
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcionario_id uuid;
  v_registro public.registros_ponto;
  v_agora timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_hora time;
  v_local jsonb;
BEGIN
  IF p_tipo <> ALL(ARRAY['entrada','saida_almoco','retorno_almoco','saida']) THEN
    RAISE EXCEPTION 'Tipo de marcação inválido.';
  END IF;

  SELECT f.id INTO v_funcionario_id
  FROM public.funcionarios f
  WHERE f.user_id = auth.uid() AND f.status = 'ativo'
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário ativo não encontrado para este usuário.';
  END IF;

  v_hora := v_agora::time;
  v_local := CASE
    WHEN p_latitude IS NULL OR p_longitude IS NULL THEN NULL
    ELSE jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'precisao', p_precisao,
      'capturado_em', now()
    )
  END;

  SELECT r.* INTO v_registro
  FROM public.registros_ponto r
  WHERE r.funcionario_id = v_funcionario_id AND r.data = v_agora::date
  FOR UPDATE;

  IF p_tipo = 'entrada' THEN
    IF v_registro.id IS NOT NULL THEN
      RAISE EXCEPTION 'A entrada de hoje já foi registrada.';
    END IF;
    INSERT INTO public.registros_ponto (
      funcionario_id, data, hora_entrada, tipo_dia, fonte, created_by,
      entrada_localizacao, dispositivo, ultima_marcacao_em
    ) VALUES (
      v_funcionario_id, v_agora::date, v_hora, 'normal', 'mobile', auth.uid(),
      v_local, COALESCE(p_dispositivo, '{}'::jsonb), now()
    ) RETURNING * INTO v_registro;
  ELSE
    IF v_registro.id IS NULL OR v_registro.hora_entrada IS NULL THEN
      RAISE EXCEPTION 'Registre a entrada antes desta marcação.';
    END IF;

    IF p_tipo = 'saida_almoco' THEN
      IF v_registro.hora_saida_almoco IS NOT NULL THEN RAISE EXCEPTION 'A saída para almoço já foi registrada.'; END IF;
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A jornada de hoje já foi encerrada.'; END IF;
      UPDATE public.registros_ponto SET
        hora_saida_almoco = v_hora, saida_almoco_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSIF p_tipo = 'retorno_almoco' THEN
      IF v_registro.hora_saida_almoco IS NULL THEN RAISE EXCEPTION 'Registre a saída para almoço antes do retorno.'; END IF;
      IF v_registro.hora_retorno_almoco IS NOT NULL THEN RAISE EXCEPTION 'O retorno do almoço já foi registrado.'; END IF;
      UPDATE public.registros_ponto SET
        hora_retorno_almoco = v_hora, retorno_almoco_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSE
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A saída de hoje já foi registrada.'; END IF;
      IF v_registro.hora_saida_almoco IS NOT NULL AND v_registro.hora_retorno_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre o retorno do almoço antes da saída.';
      END IF;
      UPDATE public.registros_ponto SET
        hora_saida = v_hora, saida_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    END IF;
  END IF;

  RETURN v_registro;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_ponto_funcionario(text,numeric,numeric,numeric,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.revisar_solicitacao_ajuste_ponto(
  p_solicitacao_id uuid,
  p_status text,
  p_resposta text DEFAULT NULL
)
RETURNS public.solicitacoes_ajuste_ponto
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sol public.solicitacoes_ajuste_ponto;
  _registro_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF p_status NOT IN ('aprovado','rejeitado') THEN
    RAISE EXCEPTION 'Situação de revisão inválida.';
  END IF;

  SELECT * INTO _sol FROM public.solicitacoes_ajuste_ponto
  WHERE id = p_solicitacao_id FOR UPDATE;
  IF _sol.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF _sol.status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação já foi analisada.'; END IF;

  IF p_status = 'aprovado' THEN
    INSERT INTO public.registros_ponto (
      funcionario_id, data, hora_entrada, hora_saida_almoco,
      hora_retorno_almoco, hora_saida, tipo_dia, fonte, observacoes, created_by
    ) VALUES (
      _sol.funcionario_id, _sol.data, _sol.hora_entrada, _sol.hora_saida_almoco,
      _sol.hora_retorno_almoco, _sol.hora_saida, 'normal', 'manual',
      'Ajuste aprovado pelo RH: ' || _sol.motivo, auth.uid()
    )
    ON CONFLICT (funcionario_id, data) DO UPDATE SET
      hora_entrada = EXCLUDED.hora_entrada,
      hora_saida_almoco = EXCLUDED.hora_saida_almoco,
      hora_retorno_almoco = EXCLUDED.hora_retorno_almoco,
      hora_saida = EXCLUDED.hora_saida,
      observacoes = EXCLUDED.observacoes
    RETURNING id INTO _registro_id;
  END IF;

  UPDATE public.solicitacoes_ajuste_ponto SET
    status = p_status,
    resposta = NULLIF(trim(p_resposta), ''),
    registro_ponto_id = COALESCE(_registro_id, registro_ponto_id),
    analisado_por = auth.uid(),
    analisado_em = now(),
    updated_at = now()
  WHERE id = _sol.id
  RETURNING * INTO _sol;

  RETURN _sol;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisar_solicitacao_ajuste_ponto(uuid,text,text) TO authenticated;

-- A obra vinculada pode ser exibida no comprovante do próprio funcionário.
DROP POLICY IF EXISTS "funcionario_obra_select" ON public.obras;
CREATE POLICY "funcionario_obra_select" ON public.obras
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT obra_id FROM public.funcionarios WHERE user_id = auth.uid())
  );
