-- O acesso por CPF ao ponto usa uma sessão curta do servidor, sem auth.users.
-- A RPC é exclusiva do servidor (service_role); o cliente nunca escolhe o funcionário.

ALTER TABLE public.solicitacoes_ajuste_ponto
  ALTER COLUMN solicitado_por DROP NOT NULL;

ALTER TABLE public.solicitacoes_ajuste_ponto
  ADD COLUMN IF NOT EXISTS solicitado_via_cpf boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.registrar_ponto_por_cpf(
  p_funcionario_id uuid,
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
  v_dispositivo jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF p_tipo <> ALL(ARRAY['entrada', 'saida_almoco', 'retorno_almoco', 'saida']) THEN
    RAISE EXCEPTION 'Tipo de marcação inválido.';
  END IF;

  -- O bloqueio da ficha serializa duas marcações simultâneas, inclusive a primeira do dia.
  SELECT f.id INTO v_funcionario_id
  FROM public.funcionarios f
  WHERE f.id = p_funcionario_id AND f.status = 'ativo'
  FOR UPDATE;
  IF v_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário ativo não encontrado.';
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
  v_dispositivo := COALESCE(p_dispositivo, '{}'::jsonb) || jsonb_build_object('acesso', 'cpf');

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
      v_funcionario_id, v_agora::date, v_hora, 'normal', 'mobile', NULL,
      v_local, v_dispositivo, now()
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
        dispositivo = v_dispositivo, ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSIF p_tipo = 'retorno_almoco' THEN
      IF v_registro.hora_saida_almoco IS NULL THEN RAISE EXCEPTION 'Registre a saída para almoço antes do retorno.'; END IF;
      IF v_registro.hora_retorno_almoco IS NOT NULL THEN RAISE EXCEPTION 'O retorno do almoço já foi registrado.'; END IF;
      UPDATE public.registros_ponto SET
        hora_retorno_almoco = v_hora, retorno_almoco_localizacao = v_local,
        dispositivo = v_dispositivo, ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    ELSE
      IF v_registro.hora_saida IS NOT NULL THEN RAISE EXCEPTION 'A saída de hoje já foi registrada.'; END IF;
      IF v_registro.hora_saida_almoco IS NOT NULL AND v_registro.hora_retorno_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre o retorno do almoço antes da saída.';
      END IF;
      UPDATE public.registros_ponto SET
        hora_saida = v_hora, saida_localizacao = v_local,
        dispositivo = v_dispositivo, ultima_marcacao_em = now()
      WHERE id = v_registro.id RETURNING * INTO v_registro;
    END IF;
  END IF;

  RETURN v_registro;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_ponto_por_cpf(uuid,text,numeric,numeric,numeric,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_por_cpf(uuid,text,numeric,numeric,numeric,jsonb)
  TO service_role;

NOTIFY pgrst, 'reload schema';

