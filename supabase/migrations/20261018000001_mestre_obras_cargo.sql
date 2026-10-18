-- ============================================================================
-- Criação do cargo de Mestre de Obras
--
-- O mestre de obras:
-- 1. Acessa a parte de funcionários (ponto)
-- 2. Pode bater seu próprio ponto
-- 3. Pode bater ponto dos pedreiros, ajudantes que estão na obra que ele está
-- 4. Precisa selecionar em qual obra está (lista das obras do sistema)
-- 5. Registra horários: entrada, saída para almoço, retorno do almoço, saída
-- 6. Pode registrar saída antecipada com justificativa
-- 7. As justificativas ficam visíveis para o administrativo/RH
--
-- O mestre NÃO tem acesso ao módulo RH (não pode aprovar ajustes, ver salários)
-- ============================================================================

-- 1. Adicionar novo papel ao enum AppRole
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typtype = 'e'
  ) THEN
    CREATE TYPE public.app_role AS ENUM (
      'admin', 'diretor', 'financeiro_civil', 'financeiro_imobiliaria',
      'compras', 'engenharia', 'almoxarifado', 'rh', 'cliente',
      'funcionario', 'imobiliaria', 'mestre_obras'
    );
  ELSE
    -- Verifica se 'mestre_obras' já existe no enum
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.app_role'::regtype
        AND enumlabel = 'mestre_obras'
    ) THEN
      ALTER TYPE public.app_role ADD VALUE 'mestre_obras';
    END IF;
  END IF;
END
$$;

-- 2. Adicionar nova role ao sistema de permissões (user_roles)
INSERT INTO public.app_roles (role, nome, descricao, ativo)
SELECT 'mestre_obras', 'Mestre de Obras', 'Responsável por registrar pontos dos funcionários da obra', true
WHERE NOT EXISTS (SELECT 1 FROM public.app_roles WHERE role = 'mestre_obras');

-- 3. Adicionar permissões do mestre_obras à tabela role_modules
-- O mestre_obras tem acesso a:
-- - ponto: para registrar seu próprio ponto e dos funcionários da obra
-- - obras: para listar as obras onde atua
-- - dashboard: para ver seu dashboard simplificado
INSERT INTO public.role_modules (role, module)
SELECT 'mestre_obras', module
FROM (VALUES
  ('dashboard'),
  ('obras'),
  ('ponto')
) AS modules(module)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_modules
  WHERE role = 'mestre_obras' AND module = modules.module
);

-- 4. Vincular obras ao mestre de obras (tabela de relação muitos-para-muitos)
CREATE TABLE IF NOT EXISTS public.obra_mestres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  -- cargo dentro da obra: 'encarregado', 'mestre', 'supervisor'
  cargo text NOT NULL DEFAULT 'mestre',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT obra_mestres_obra_funcionario_unique UNIQUE (obra_id, funcionario_id)
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_obra_mestres_funcionario
  ON public.obra_mestres(funcionario_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_obra_mestres_obra
  ON public.obra_mestres(obra_id) WHERE ativo = true;

-- RLS e GRANTs
ALTER TABLE public.obra_mestres ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_mestres TO authenticated;

-- Políticas RLS
DROP POLICY IF EXISTS "obra_mestres_select" ON public.obra_mestres;
CREATE POLICY "obra_mestres_select" ON public.obra_mestres
  FOR SELECT TO authenticated
  USING (
    -- Administradores, diretores, RH veem tudo
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
    -- Mestre de obras vê apenas suas próprias vinculações
    OR funcionario_id IN (SELECT id FROM public.funcionarios WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "obra_mestres_insert" ON public.obra_mestres;
CREATE POLICY "obra_mestres_insert" ON public.obra_mestres
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'rh')
  );

DROP POLICY IF EXISTS "obra_mestres_update" ON public.obra_mestres;
CREATE POLICY "obra_mestres_update" ON public.obra_mestres
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

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_obra_mestres_updated ON public.obra_mestres;
CREATE TRIGGER trg_obra_mestres_updated
  BEFORE UPDATE ON public.obra_mestres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RPC para o mestre de obras registrar ponto de outros funcionários
-- Esta função permite que um mestre registre ponto para funcionários das obras que supervisiona
CREATE OR REPLACE FUNCTION public.registrar_ponto_por_mestre(
  p_funcionario_id uuid,
  p_obra_id uuid,
  p_tipo text,
  p_justificativa_saida_antecipada text DEFAULT NULL,
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
  v_mestre_funcionario_id uuid;
  v_mestre_obra_count integer;
  v_funcionario_ativo boolean;
  v_registro public.registros_ponto;
  v_agora timestamp := clock_timestamp() AT TIME ZONE 'America/Sao_Paulo';
  v_hora time;
  v_local jsonb;
  v_dispositivo_final jsonb;
BEGIN
  -- 1. Verificar se o usuário autenticado é um mestre de obras ativo
  SELECT f.id INTO v_mestre_funcionario_id
  FROM public.funcionarios f
  WHERE f.user_id = auth.uid()
    AND f.status = 'ativo'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'mestre_obras'
    )
  LIMIT 1;

  IF v_mestre_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não é um mestre de obras ativo.' USING ERRCODE = '42501';
  END IF;

  -- 2. Verificar se o mestre está vinculado à obra informada
  SELECT COUNT(*) INTO v_mestre_obra_count
  FROM public.obra_mestres om
  WHERE om.funcionario_id = v_mestre_funcionario_id
    AND om.obra_id = p_obra_id
    AND om.ativo = true;

  IF v_mestre_obra_count = 0 THEN
    RAISE EXCEPTION 'Mestre não está vinculado a esta obra ou a vinculação não está ativa.' USING ERRCODE = 'P0004';
  END IF;

  -- 3. Verificar se o funcionário alvo está ativo
  SELECT (status = 'ativo') INTO v_funcionario_ativo
  FROM public.funcionarios
  WHERE id = p_funcionario_id;

  IF NOT v_funcionario_ativo THEN
    RAISE EXCEPTION 'Funcionário não está ativo.' USING ERRCODE = 'P0005';
  END IF;

  -- 4. Validação do tipo de marcação
  IF p_tipo <> ALL(ARRAY['entrada', 'saida_almoco', 'retorno_almoco', 'saida']) THEN
    RAISE EXCEPTION 'Tipo de marcação inválido. Use: entrada, saida_almoco, retorno_almoco ou saida.' USING ERRCODE = 'P0006';
  END IF;

  -- 5. Para saída antecipada, verificar justificativa
  IF p_tipo = 'saida' AND p_justificativa_saida_antecipada IS NOT NULL THEN
    IF char_length(trim(p_justificativa_saida_antecipada)) < 5 THEN
      RAISE EXCEPTION 'Justificativa para saída antecipada deve ter pelo menos 5 caracteres.' USING ERRCODE = 'P0007';
    END IF;
  END IF;

  -- 6. Preparar dados de localização e dispositivo
  v_hora := v_agora::time;
  v_local := CASE
    WHEN p_latitude IS NULL OR p_longitude IS NULL THEN NULL
    ELSE jsonb_build_object(
      'latitude', p_latitude,
      'longitude', p_longitude,
      'precisao', p_precisao,
      'capturado_em', now(),
      'registrado_por', 'mestre_obras'
    )
  END;

  v_dispositivo_final := COALESCE(p_dispositivo, '{}'::jsonb) || jsonb_build_object(
    'acesso', 'mestre_obras',
    'mestre_id', v_mestre_funcionario_id
  );

  -- 7. Encontrar ou criar registro do dia e processar a marcação
  -- Mesma lógica da função registrar_ponto_funcionario, mas com campos adicionais
  SELECT r.* INTO v_registro
  FROM public.registros_ponto r
  WHERE r.funcionario_id = p_funcionario_id
    AND r.data = v_agora::date
  FOR UPDATE;

  IF p_tipo = 'entrada' THEN
    IF v_registro.id IS NOT NULL THEN
      RAISE EXCEPTION 'A entrada de hoje já foi registrada para este funcionário.' USING ERRCODE = 'P0008';
    END IF;

    INSERT INTO public.registros_ponto (
      funcionario_id, data, hora_entrada, tipo_dia, fonte,
      entrada_localizacao, dispositivo, ultima_marcacao_em,
      obra_id, observacoes, created_by
    ) VALUES (
      p_funcionario_id, v_agora::date, v_hora, 'normal', 'mobile_mestre',
      v_local, v_dispositivo_final, now(),
      p_obra_id,
      CASE WHEN p_justificativa_saida_antecipada IS NOT NULL
        THEN 'Justificativa mestre: ' || p_justificativa_saida_antecipada
        ELSE NULL
      END,
      auth.uid()
    ) RETURNING * INTO v_registro;
  ELSE
    IF v_registro.id IS NULL OR v_registro.hora_entrada IS NULL THEN
      RAISE EXCEPTION 'Registre a entrada antes desta marcação.' USING ERRCODE = 'P0009';
    END IF;

    IF p_tipo = 'saida_almoco' THEN
      IF v_registro.hora_saida_almoco IS NOT NULL THEN
        RAISE EXCEPTION 'A saída para almoço já foi registrada.';
      END IF;
      IF v_registro.hora_saida IS NOT NULL THEN
        RAISE EXCEPTION 'A jornada de hoje já foi encerrada.';
      END IF;

      UPDATE public.registros_ponto SET
        hora_saida_almoco = v_hora,
        saida_almoco_localizacao = v_local,
        dispositivo = v_dispositivo_final,
        ultima_marcacao_em = now(),
        obra_id = COALESCE(obra_id, p_obra_id)
      WHERE id = v_registro.id
      RETURNING * INTO v_registro;
    ELSIF p_tipo = 'retorno_almoco' THEN
      IF v_registro.hora_saida_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre a saída para almoço antes do retorno.';
      END IF;
      IF v_registro.hora_retorno_almoco IS NOT NULL THEN
        RAISE EXCEPTION 'O retorno do almoço já foi registrado.';
      END IF;

      UPDATE public.registros_ponto SET
        hora_retorno_almoco = v_hora,
        retorno_almoco_localizacao = v_local,
        dispositivo = v_dispositivo_final,
        ultima_marcacao_em = now()
      WHERE id = v_registro.id
      RETURNING * INTO v_registro;
    ELSE -- saida
      IF v_registro.hora_saida IS NOT NULL THEN
        RAISE EXCEPTION 'A saída de hoje já foi registrada.';
      END IF;
      IF v_registro.hora_saida_almoco IS NOT NULL AND v_registro.hora_retorno_almoco IS NULL THEN
        RAISE EXCEPTION 'Registre o retorno do almoço antes da saída.';
      END IF;

      UPDATE public.registros_ponto SET
        hora_saida = v_hora,
        saida_localizacao = v_local,
        dispositivo = v_dispositivo_final,
        ultima_marcacao_em = now(),
        observacoes = COALESCE(
          observacoes || ' ',
          ''
        ) || CASE WHEN p_justificativa_saida_antecipada IS NOT NULL
          THEN 'Saída antecipada (mestre): ' || p_justificativa_saida_antecipada
          ELSE ''
        END
      WHERE id = v_registro.id
      RETURNING * INTO v_registro;
    END IF;
  END IF;

  -- 8. Criar solicitação de ajuste automática se houver justificativa de saída antecipada
  IF p_tipo = 'saida' AND p_justificativa_saida_antecipada IS NOT NULL THEN
    INSERT INTO public.solicitacoes_ajuste_ponto (
      funcionario_id,
      registro_ponto_id,
      data,
      hora_saida,
      motivo,
      status,
      solicitado_por
    ) VALUES (
      p_funcionario_id,
      v_registro.id,
      v_agora::date,
      v_hora,
      'Saída antecipada registrada pelo mestre: ' || p_justificativa_saida_antecipada,
      'pendente',
      auth.uid()
    );
  END IF;

  RETURN v_registro;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Permissões da RPC
REVOKE ALL ON FUNCTION public.registrar_ponto_por_mestre(
  uuid, uuid, text, text, numeric, numeric, numeric, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ponto_por_mestre(
  uuid, uuid, text, text, numeric, numeric, numeric, jsonb
) TO authenticated;

-- 6. View para listar funcionários que o mestre pode gerenciar
-- Mostra funcionários das obras onde o mestre está ativo
CREATE OR REPLACE VIEW public.vw_funcionarios_mestre AS
SELECT
  f.id,
  f.nome,
  f.cpf,
  f.matricula,
  f.status,
  o.id as obra_id,
  o.nome as obra_nome,
  om.cargo as cargo_na_obra,
  om.data_inicio,
  om.data_fim
FROM public.funcionarios f
JOIN public.obra_mestres om ON om.obra_id = f.obra_id
JOIN public.obras o ON o.id = om.obra_id
WHERE om.funcionario_id IN (
  SELECT id FROM public.funcionarios WHERE user_id = auth.uid()
)
AND om.ativo = true
AND f.status = 'ativo'
AND f.user_id IS NOT NULL; -- Somente funcionários com login (exclui terceiros)

-- RLS para a view
DROP POLICY IF EXISTS "vw_funcionarios_mestre_select" ON public.obras; -- Política de exemplo, a view usa RLS das tabelas base
COMMENT ON VIEW public.vw_funcionarios_mestre IS 'Lista de funcionários que um mestre de obras pode gerenciar (funcionários das suas obras).';

-- 7. Atualizar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Comentários de documentação
-- ============================================================================
COMMENT ON TABLE public.obra_mestres IS 'Vinculação de mestres/encarregados às obras que supervisionam.';
COMMENT ON COLUMN public.obra_mestres.cargo IS 'Cargo dentro da obra: encarregado, mestre, supervisor.';
COMMENT ON FUNCTION public.registrar_ponto_por_mestre(
  uuid, uuid, text, text, numeric, numeric, numeric, jsonb
) IS 'Permite que um mestre de obras registre ponto para funcionários das obras que supervisiona. Inclui suporte a justificativa para saída antecipada.';