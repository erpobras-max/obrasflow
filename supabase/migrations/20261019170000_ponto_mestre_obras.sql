-- Adicionar suporte para registro de ponto por Mestre de Obras com GPS e vinculo a Obra
-- 1. Adicionar colunas obra_id e registrado_por em registros_ponto se nao existirem

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registros_ponto_obra ON public.registros_ponto(obra_id);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_data ON public.registros_ponto(data);

-- 2. Atualizar registrar_ponto_funcionario para aceitar obra_id opcional
CREATE OR REPLACE FUNCTION public.registrar_ponto_funcionario(
  p_tipo text,
  p_latitude numeric DEFAULT NULL,
  p_longitude numeric DEFAULT NULL,
  p_precisao numeric DEFAULT NULL,
  p_dispositivo jsonb DEFAULT '{}'::jsonb,
  p_obra_id uuid DEFAULT NULL
)
RETURNS public.registros_ponto
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_funcionario_id uuid;
  v_obra_padrao uuid;
  v_obra_final uuid;
  v_registro public.registros_ponto;
  v_agora timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_hora time;
  v_local jsonb;
BEGIN
  IF p_tipo <> ALL(ARRAY['entrada','saida_almoco','retorno_almoco','saida']) THEN
    RAISE EXCEPTION 'Tipo de marcação inválido.';
  END IF;

  SELECT f.id, f.obra_id INTO v_funcionario_id, v_obra_padrao
  FROM public.funcionarios f
  WHERE f.user_id = auth.uid() AND f.status = 'ativo'
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário ativo não encontrado para este usuário.';
  END IF;

  v_obra_final := COALESCE(p_obra_id, v_obra_padrao);

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
      entrada_localizacao, dispositivo, ultima_marcacao_em, obra_id, registrado_por
    ) VALUES (
      v_funcionario_id, v_agora::date, v_hora, 'normal', 'mobile', auth.uid(),
      v_local, COALESCE(p_dispositivo, '{}'::jsonb), now(), v_obra_final, auth.uid()
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
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = COALESCE(v_obra_final, obra_id)
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSIF p_tipo = 'retorno_almoco' THEN
      IF v_registro.hora_saida_almoco IS NULL THEN RAISE EXCEPTION 'Registre a saída para almoço antes do retorno.'; END IF;
      IF v_registro.hora_retorno_almoco IS NOT NULL THEN RAISE EXCEPTION 'O retorno do almoço já foi registrado.'; END IF;
      UPDATE public.registros_ponto SET
        hora_retorno_almoco = v_hora, retorno_almoco_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = COALESCE(v_obra_final, obra_id)
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSE
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A saída de hoje já foi registrada.'; END IF;
      IF v_registro.hora_saida_almoco IS NOT NULL AND v_registro.hora_retorno_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre o retorno do almoço antes da saída.';
      END IF;
      UPDATE public.registros_ponto SET
        hora_saida = v_hora, saida_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = COALESCE(v_obra_final, obra_id)
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    END IF;
  END IF;

  RETURN v_registro;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_ponto_funcionario(text,numeric,numeric,numeric,jsonb,uuid) TO authenticated;

-- 3. Criar RPC registrar_ponto_equipe para Mestre de Obras / Administradores
CREATE OR REPLACE FUNCTION public.registrar_ponto_equipe(
  p_funcionario_id uuid,
  p_tipo text,
  p_obra_id uuid,
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
  v_mestre_id uuid;
  v_cargo_mestre text;
  v_registro public.registros_ponto;
  v_agora timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_hora time;
  v_local jsonb;
  v_is_admin boolean;
BEGIN
  IF p_tipo <> ALL(ARRAY['entrada','saida_almoco','retorno_almoco','saida']) THEN
    RAISE EXCEPTION 'Tipo de marcação inválido.';
  END IF;

  IF p_obra_id IS NULL THEN
    RAISE EXCEPTION 'Informe a obra em que a equipe está trabalhando.';
  END IF;

  -- Checar se o usuário atual é admin/diretor/rh ou funcionário com cargo de Mestre de Obras
  v_is_admin := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'rh');

  IF NOT v_is_admin THEN
    SELECT f.id, lower(f.cargo) INTO v_mestre_id, v_cargo_mestre
    FROM public.funcionarios f
    WHERE f.user_id = auth.uid() AND f.status = 'ativo'
    LIMIT 1;

    IF v_mestre_id IS NULL OR (v_cargo_mestre NOT LIKE '%mestre%' AND v_cargo_mestre NOT LIKE '%encarregado%') THEN
      RAISE EXCEPTION 'Apenas o Mestre de Obras ou administração podem registrar ponto da equipe.';
    END IF;
  END IF;

  -- Checar se o funcionário alvo está ativo
  IF NOT EXISTS (SELECT 1 FROM public.funcionarios WHERE id = p_funcionario_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'Colaborador não encontrado ou não está ativo.';
  END IF;

  v_hora := v_agora::time;
  v_local := CASE
    WHEN p_latitude IS NULL OR p_longitude IS NULL THEN NULL
    ELSE jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'precisao', p_precisao,
      'capturado_em', now(),
      'registrado_por_mestre', true
    )
  END;

  SELECT r.* INTO v_registro
  FROM public.registros_ponto r
  WHERE r.funcionario_id = p_funcionario_id AND r.data = v_agora::date
  FOR UPDATE;

  IF p_tipo = 'entrada' THEN
    IF v_registro.id IS NOT NULL THEN
      RAISE EXCEPTION 'A entrada de hoje deste colaborador já foi registrada.';
    END IF;
    INSERT INTO public.registros_ponto (
      funcionario_id, data, hora_entrada, tipo_dia, fonte, created_by,
      entrada_localizacao, dispositivo, ultima_marcacao_em, obra_id, registrado_por
    ) VALUES (
      p_funcionario_id, v_agora::date, v_hora, 'normal', 'mestre_obras', auth.uid(),
      v_local, COALESCE(p_dispositivo, '{}'::jsonb), now(), p_obra_id, auth.uid()
    ) RETURNING * INTO v_registro;
  ELSE
    IF v_registro.id IS NULL OR v_registro.hora_entrada IS NULL THEN
      RAISE EXCEPTION 'Registre a entrada do colaborador antes desta marcação.';
    END IF;

    IF p_tipo = 'saida_almoco' THEN
      IF v_registro.hora_saida_almoco IS NOT NULL THEN RAISE EXCEPTION 'A saída para almoço deste colaborador já foi registrada.'; END IF;
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A jornada de hoje deste colaborador já foi encerrada.'; END IF;
      UPDATE public.registros_ponto SET
        hora_saida_almoco = v_hora, saida_almoco_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = p_obra_id, registrado_por = auth.uid()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSIF p_tipo = 'retorno_almoco' THEN
      IF v_registro.hora_saida_almoco IS NULL THEN RAISE EXCEPTION 'Registre a saída para almoço antes do retorno.'; END IF;
      IF v_registro.hora_retorno_almoco IS NOT NULL THEN RAISE EXCEPTION 'O retorno do almoço deste colaborador já foi registrado.'; END IF;
      UPDATE public.registros_ponto SET
        hora_retorno_almoco = v_hora, retorno_almoco_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = p_obra_id, registrado_por = auth.uid()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSE
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A saída de hoje deste colaborador já foi registrada.'; END IF;
      IF v_registro.hora_saida_almoco IS NOT NULL AND v_registro.hora_retorno_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre o retorno do almoço antes da saída.';
      END IF;
      UPDATE public.registros_ponto SET
        hora_saida = v_hora, saida_localizacao = v_local,
        dispositivo = COALESCE(p_dispositivo, dispositivo), ultima_marcacao_em = now(),
        obra_id = p_obra_id, registrado_por = auth.uid()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    END IF;
  END IF;

  RETURN v_registro;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_ponto_equipe(uuid,text,uuid,numeric,numeric,numeric,jsonb) TO authenticated;
