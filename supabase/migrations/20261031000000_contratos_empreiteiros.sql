-- ====================================================================
-- MIGRATION: Contratos de Empreiteiros e Separação de Medições
-- Data: 2026-10-31
-- Compatível e aditiva: não remove nem altera tabelas existentes.
-- ====================================================================

-- 1. ENUMS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_contrato_empreiteiro') THEN
    CREATE TYPE public.tipo_contrato_empreiteiro AS ENUM ('preco_unitario', 'empreitada_global');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_contrato_empreiteiro') THEN
    CREATE TYPE public.status_contrato_empreiteiro AS ENUM ('rascunho', 'em_aprovacao', 'ativo', 'concluido', 'cancelado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_medicao_empreiteiro') THEN
    CREATE TYPE public.status_medicao_empreiteiro AS ENUM ('rascunho', 'em_aprovacao', 'aprovada', 'paga', 'reprovada', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_ajuste_medicao') THEN
    CREATE TYPE public.tipo_ajuste_medicao AS ENUM ('desconto', 'amortizacao_adiantamento', 'retencao_tecnica', 'tributo', 'outro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_aditivo_contrato') THEN
    CREATE TYPE public.tipo_aditivo_contrato AS ENUM ('quantidade', 'preco', 'prazo', 'escopo', 'misto');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_aditivo_contrato') THEN
    CREATE TYPE public.status_aditivo_contrato AS ENUM ('rascunho', 'em_aprovacao', 'aprovado', 'rejeitado', 'cancelado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_retencao_empreiteiro') THEN
    CREATE TYPE public.status_retencao_empreiteiro AS ENUM ('retida', 'liberada_parcial', 'liberada_total', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modo_entrada_medicao') THEN
    CREATE TYPE public.modo_entrada_medicao AS ENUM ('quantidade', 'percentual', 'valor');
  END IF;
END $$;

-- 2. SEQUÊNCIAS
CREATE SEQUENCE IF NOT EXISTS public.contratos_empreiteiros_num_seq START 1;

-- 3. CABEÇALHO DO CONTRATO DE EMPREITEIRO
CREATE TABLE IF NOT EXISTS public.contratos_empreiteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  tipo public.tipo_contrato_empreiteiro NOT NULL DEFAULT 'preco_unitario',
  objeto text NOT NULL,
  status public.status_contrato_empreiteiro NOT NULL DEFAULT 'rascunho',
  data_inicio date,
  data_fim_prevista date,
  retencao_padrao_percentual numeric(6,4) NOT NULL DEFAULT 0 CHECK (retencao_padrao_percentual >= 0 AND retencao_padrao_percentual <= 100),
  adiantamento_previsto_centavos bigint NOT NULL DEFAULT 0 CHECK (adiantamento_previsto_centavos >= 0),
  adiantamento_concedido_centavos bigint NOT NULL DEFAULT 0 CHECK (adiantamento_concedido_centavos >= 0),
  adiantamento_amortizado_centavos bigint NOT NULL DEFAULT 0 CHECK (adiantamento_amortizado_centavos >= 0),
  valor_total_original_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_total_original_centavos >= 0),
  valor_total_aditivos_centavos bigint NOT NULL DEFAULT 0,
  valor_total_atual_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_total_atual_centavos >= 0),
  origem_legada boolean NOT NULL DEFAULT false,
  observacoes text,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. CABEÇALHO DO BOLETIM DE MEDIÇÃO DE EMPREITEIRO
CREATE TABLE IF NOT EXISTS public.medicoes_empreiteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_empreiteiro_id uuid NOT NULL REFERENCES public.contratos_empreiteiros(id) ON DELETE RESTRICT,
  numero integer NOT NULL CHECK (numero > 0),
  periodo_inicio date,
  periodo_fim date,
  data_vencimento date,
  status public.status_medicao_empreiteiro NOT NULL DEFAULT 'rascunho',
  valor_bruto_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_bruto_centavos >= 0),
  valor_descontos_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_descontos_centavos >= 0),
  valor_amortizacao_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_amortizacao_centavos >= 0),
  valor_retencao_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_retencao_centavos >= 0),
  valor_tributos_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_tributos_centavos >= 0),
  valor_liquido_centavos bigint NOT NULL DEFAULT 0 CHECK (valor_liquido_centavos >= 0),
  conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  aprovado_por uuid,
  aprovado_em timestamptz,
  motivo_recusa text,
  observacoes text,
  origem_legada boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_empreiteiro_id, numero)
);

-- 5. AJUSTES DA MEDIÇÃO (DESCONTOS, RETENÇÕES, ADIANTAMENTOS, TRIBUTOS)
CREATE TABLE IF NOT EXISTS public.medicao_empreiteiro_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_empreiteiro_id uuid NOT NULL REFERENCES public.medicoes_empreiteiros(id) ON DELETE CASCADE,
  tipo public.tipo_ajuste_medicao NOT NULL,
  descricao text NOT NULL,
  base_calculo_centavos bigint,
  percentual numeric(6,4),
  valor_centavos bigint NOT NULL CHECK (valor_centavos >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. ADITIVOS CONTRATUAIS
CREATE TABLE IF NOT EXISTS public.contrato_empreiteiro_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_empreiteiro_id uuid NOT NULL REFERENCES public.contratos_empreiteiros(id) ON DELETE RESTRICT,
  numero integer NOT NULL CHECK (numero > 0),
  tipo public.tipo_aditivo_contrato NOT NULL,
  objeto text NOT NULL,
  status public.status_aditivo_contrato NOT NULL DEFAULT 'rascunho',
  valor_acrescimo_centavos bigint NOT NULL DEFAULT 0,
  dias_prazo integer NOT NULL DEFAULT 0,
  aprovado_por uuid,
  aprovado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_empreiteiro_id, numero)
);

-- 7. ANEXOS / EVIDÊNCIAS (FOTOS E DOCUMENTOS VIA R2)
CREATE TABLE IF NOT EXISTS public.medicao_empreiteiro_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_empreiteiro_id uuid NOT NULL REFERENCES public.medicoes_empreiteiros(id) ON DELETE CASCADE,
  item_servico_id uuid REFERENCES public.servicos_terceirizados(id) ON DELETE SET NULL,
  r2_key text NOT NULL,
  nome_arquivo text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  mime_type text NOT NULL,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. RETENÇÕES TÉCNICAS E LIBERAÇÕES
CREATE TABLE IF NOT EXISTS public.retencoes_empreiteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_empreiteiro_id uuid NOT NULL REFERENCES public.contratos_empreiteiros(id) ON DELETE RESTRICT,
  medicao_empreiteiro_id uuid NOT NULL REFERENCES public.medicoes_empreiteiros(id) ON DELETE RESTRICT,
  valor_retido_centavos bigint NOT NULL CHECK (valor_retido_centavos > 0),
  saldo_retido_centavos bigint NOT NULL CHECK (saldo_retido_centavos >= 0),
  status public.status_retencao_empreiteiro NOT NULL DEFAULT 'retida',
  liberado_em timestamptz,
  liberado_por uuid,
  conta_pagar_liberacao_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. LINKS PÚBLICOS E REVOGÁVEIS
CREATE TABLE IF NOT EXISTS public.medicao_empreiteiro_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_empreiteiro_id uuid NOT NULL REFERENCES public.medicoes_empreiteiros(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expira_em timestamptz NOT NULL,
  revogado boolean NOT NULL DEFAULT false,
  revogado_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. AUDITORIA CONTRATUAL
CREATE TABLE IF NOT EXISTS public.contrato_empreiteiro_auditoria (
  id bigserial PRIMARY KEY,
  contrato_empreiteiro_id uuid REFERENCES public.contratos_empreiteiros(id) ON DELETE CASCADE,
  medicao_empreiteiro_id uuid REFERENCES public.medicoes_empreiteiros(id) ON DELETE CASCADE,
  ator_id uuid,
  acao text NOT NULL,
  entidade text NOT NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. ALÇADAS DE APROVAÇÃO
CREATE TABLE IF NOT EXISTS public.medicao_empreiteiro_alcadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil public.app_role NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_por uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. EXTENSÕES COMPATÍVEIS NAS TABELAS EXISTENTES
ALTER TABLE public.servicos_terceirizados
  ADD COLUMN IF NOT EXISTS contrato_empreiteiro_id uuid REFERENCES public.contratos_empreiteiros(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS etapa text,
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS preco_unitario_centavos bigint,
  ADD COLUMN IF NOT EXISTS preco_total_centavos bigint;

ALTER TABLE public.medicoes_terceirizados
  ADD COLUMN IF NOT EXISTS medicao_empreiteiro_id uuid REFERENCES public.medicoes_empreiteiros(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS modo_entrada public.modo_entrada_medicao DEFAULT 'quantidade',
  ADD COLUMN IF NOT EXISTS percentual_atual numeric(8,4),
  ADD COLUMN IF NOT EXISTS valor_centavos bigint,
  ADD COLUMN IF NOT EXISTS quantidade_anterior numeric(14,6),
  ADD COLUMN IF NOT EXISTS quantidade_acumulada numeric(14,6),
  ADD COLUMN IF NOT EXISTS saldo_quantidade numeric(14,6);

ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS medicao_empreiteiro_id uuid REFERENCES public.medicoes_empreiteiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retencao_empreiteiro_id uuid REFERENCES public.retencoes_empreiteiros(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_medicao_unique
  ON public.contas_pagar (medicao_empreiteiro_id)
  WHERE medicao_empreiteiro_id IS NOT NULL;

-- 13. SEMEADURA DE ALÇADAS PADRÃO
INSERT INTO public.medicao_empreiteiro_alcadas (perfil, ativo)
VALUES ('admin', true), ('diretor', true)
ON CONFLICT (perfil) DO NOTHING;

-- 14. BACKFILL IDEMPOTENTE
DO $$
DECLARE
  rec_servico RECORD;
  rec_medicao RECORD;
  novo_contrato_id uuid;
  novo_medicao_id uuid;
  status_contrato_mapeado public.status_contrato_empreiteiro;
  status_medicao_mapeado public.status_medicao_empreiteiro;
  valor_tot_centavos bigint;
  valor_unit_centavos bigint;
  conta_paga_paga boolean;
  seq_num integer;
BEGIN
  -- A. Backfill de serviços terceirizados sem contrato vinculado
  FOR rec_servico IN
    SELECT * FROM public.servicos_terceirizados
    WHERE contrato_empreiteiro_id IS NULL
    ORDER BY created_at ASC
  LOOP
    CASE rec_servico.status
      WHEN 'aprovado' THEN status_contrato_mapeado := 'ativo';
      WHEN 'concluido' THEN status_contrato_mapeado := 'concluido';
      WHEN 'cancelado' THEN status_contrato_mapeado := 'cancelado';
      ELSE status_contrato_mapeado := 'rascunho';
    END CASE;

    valor_tot_centavos := ROUND(COALESCE(rec_servico.valor_total, 0) * 100);
    valor_unit_centavos := ROUND(COALESCE(rec_servico.valor_unitario, 0) * 100);

    INSERT INTO public.contratos_empreiteiros (
      numero,
      obra_id,
      fornecedor_id,
      tipo,
      objeto,
      status,
      valor_total_original_centavos,
      valor_total_atual_centavos,
      origem_legada,
      created_at
    ) VALUES (
      'CTR-LEG-' || UPPER(SUBSTRING(rec_servico.id::text, 1, 8)),
      rec_servico.obra_id,
      rec_servico.fornecedor_id,
      'preco_unitario',
      rec_servico.descricao,
      status_contrato_mapeado,
      valor_tot_centavos,
      valor_tot_centavos,
      true,
      rec_servico.created_at
    ) RETURNING id INTO novo_contrato_id;

    UPDATE public.servicos_terceirizados
    SET contrato_empreiteiro_id = novo_contrato_id,
        preco_unitario_centavos = valor_unit_centavos,
        preco_total_centavos = valor_tot_centavos,
        origem = 'legado'
    WHERE id = rec_servico.id;
  END LOOP;

  -- B. Backfill de medições terceirizados sem cabeçalho vinculado
  FOR rec_medicao IN
    SELECT m.*, s.contrato_empreiteiro_id, cp.status AS cp_status
    FROM public.medicoes_terceirizados m
    JOIN public.servicos_terceirizados s ON s.id = m.servico_id
    LEFT JOIN public.contas_pagar cp ON cp.id = m.conta_pagar_id
    WHERE m.medicao_empreiteiro_id IS NULL
    ORDER BY m.created_at ASC
  LOOP
    IF rec_medicao.status = 'reprovada' THEN
      status_medicao_mapeado := 'reprovada';
    ELSIF rec_medicao.status = 'financeiro_gerado' THEN
      IF rec_medicao.cp_status = 'pago' THEN
        status_medicao_mapeado := 'paga';
      ELSE
        status_medicao_mapeado := 'aprovada';
      END IF;
    ELSE
      status_medicao_mapeado := 'rascunho';
    END IF;

    valor_tot_centavos := ROUND(COALESCE(rec_medicao.valor_medicao, 0) * 100);

    INSERT INTO public.medicoes_empreiteiros (
      contrato_empreiteiro_id,
      numero,
      periodo_inicio,
      periodo_fim,
      status,
      valor_bruto_centavos,
      valor_liquido_centavos,
      conta_pagar_id,
      origem_legada,
      created_at
    ) VALUES (
      rec_medicao.contrato_empreiteiro_id,
      rec_medicao.numero_medicao,
      rec_medicao.periodo_inicio,
      rec_medicao.periodo_fim,
      status_medicao_mapeado,
      valor_tot_centavos,
      valor_tot_centavos,
      rec_medicao.conta_pagar_id,
      true,
      rec_medicao.created_at
    ) RETURNING id INTO novo_medicao_id;

    UPDATE public.medicoes_terceirizados
    SET medicao_empreiteiro_id = novo_medicao_id,
        valor_centavos = valor_tot_centavos,
        modo_entrada = 'quantidade'
    WHERE id = rec_medicao.id;

    IF rec_medicao.conta_pagar_id IS NOT NULL THEN
      UPDATE public.contas_pagar
      SET medicao_empreiteiro_id = novo_medicao_id
      WHERE id = rec_medicao.conta_pagar_id;
    END IF;
  END LOOP;
END $$;

-- 15. RPCS SEGURAS DE APROVAÇÃO, CANCELAMENTO E RETENÇÃO

-- A. Aprovação de Medição
CREATE OR REPLACE FUNCTION public.aprovar_medicao_empreiteiro(
  p_medicao_id uuid,
  p_data_vencimento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medicao RECORD;
  v_contrato RECORD;
  v_usuario_id uuid;
  v_perfil_permitido boolean;
  v_nova_conta_id uuid;
  v_vencimento date;
  v_retencao RECORD;
BEGIN
  v_usuario_id := auth.uid();

  -- 1. Verifica alçada do usuário
  SELECT EXISTS (
    SELECT 1 FROM public.medicao_empreiteiro_alcadas a
    WHERE a.ativo = true
      AND public.has_role(v_usuario_id, a.perfil)
  ) INTO v_perfil_permitido;

  IF NOT v_perfil_permitido THEN
    RAISE EXCEPTION 'Usuário não possui perfil autorizado na alçada de aprovação';
  END IF;

  -- 2. Bloqueia linha da medição
  SELECT * INTO v_medicao
  FROM public.medicoes_empreiteiros
  WHERE id = p_medicao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medição não encontrada';
  END IF;

  IF v_medicao.status IN ('aprovada', 'paga') THEN
    RETURN jsonb_build_object('sucesso', true, 'ja_aprovada', true, 'conta_pagar_id', v_medicao.conta_pagar_id);
  END IF;

  IF v_medicao.status NOT IN ('rascunho', 'em_aprovacao') THEN
    RAISE EXCEPTION 'Medição em status % não pode ser aprovada', v_medicao.status;
  END IF;

  -- 3. Bloqueia linha do contrato
  SELECT * INTO v_contrato
  FROM public.contratos_empreiteiros
  WHERE id = v_medicao.contrato_empreiteiro_id
  FOR UPDATE;

  IF v_contrato.status != 'ativo' THEN
    RAISE EXCEPTION 'Contrato não está ativo (status atual: %)', v_contrato.status;
  END IF;

  -- 4. Vencimento
  v_vencimento := COALESCE(p_data_vencimento, v_medicao.data_vencimento, CURRENT_DATE + INTERVAL '15 days');

  -- 5. Cria exatamente uma conta a pagar para o valor líquido (se > 0)
  IF v_medicao.valor_liquido_centavos > 0 THEN
    INSERT INTO public.contas_pagar (
      descricao,
      fornecedor_id,
      obra_id,
      valor,
      valor_pago,
      status,
      data_vencimento,
      medicao_empreiteiro_id
    ) VALUES (
      'Medição #' || v_medicao.numero || ' · Contrato ' || v_contrato.numero || ' · ' || v_contrato.objeto,
      v_contrato.fornecedor_id,
      v_contrato.obra_id,
      (v_medicao.valor_liquido_centavos::numeric / 100),
      0,
      'aberto',
      v_vencimento,
      v_medicao.id
    ) RETURNING id INTO v_nova_conta_id;
  END IF;

  -- 6. Registra retenção se houver
  IF v_medicao.valor_retencao_centavos > 0 THEN
    INSERT INTO public.retencoes_empreiteiros (
      contrato_empreiteiro_id,
      medicao_empreiteiro_id,
      valor_retido_centavos,
      saldo_retido_centavos,
      status
    ) VALUES (
      v_contrato.id,
      v_medicao.id,
      v_medicao.valor_retencao_centavos,
      v_medicao.valor_retencao_centavos,
      'retida'
    );
  END IF;

  -- 7. Atualiza amortização no contrato se houver
  IF v_medicao.valor_amortizacao_centavos > 0 THEN
    UPDATE public.contratos_empreiteiros
    SET adiantamento_amortizado_centavos = adiantamento_amortizado_centavos + v_medicao.valor_amortizacao_centavos
    WHERE id = v_contrato.id;
  END IF;

  -- 8. Atualiza status da medição
  UPDATE public.medicoes_empreiteiros
  SET status = 'aprovada',
      aprovado_por = v_usuario_id,
      aprovado_em = now(),
      data_vencimento = v_vencimento,
      conta_pagar_id = v_nova_conta_id,
      updated_at = now()
  WHERE id = v_medicao.id;

  -- 9. Auditoria
  INSERT INTO public.contrato_empreiteiro_auditoria (
    contrato_empreiteiro_id,
    medicao_empreiteiro_id,
    ator_id,
    acao,
    entidade,
    dados_anteriores,
    dados_novos
  ) VALUES (
    v_contrato.id,
    v_medicao.id,
    v_usuario_id,
    'APROVAR_MEDICAO',
    'medicoes_empreiteiros',
    to_jsonb(v_medicao),
    jsonb_build_object('status', 'aprovada', 'conta_pagar_id', v_nova_conta_id)
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'medicao_id', v_medicao.id,
    'status', 'aprovada',
    'conta_pagar_id', v_nova_conta_id
  );
END;
$$;

-- B. Cancelamento de Medição
CREATE OR REPLACE FUNCTION public.cancelar_medicao_empreiteiro(
  p_medicao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medicao RECORD;
  v_conta RECORD;
  v_usuario_id uuid;
BEGIN
  v_usuario_id := auth.uid();

  SELECT * INTO v_medicao
  FROM public.medicoes_empreiteiros
  WHERE id = p_medicao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medição não encontrada';
  END IF;

  IF v_medicao.status = 'cancelada' THEN
    RETURN jsonb_build_object('sucesso', true, 'ja_cancelada', true);
  END IF;

  -- Se possui conta pagar associada, verifica se já houve pagamento
  IF v_medicao.conta_pagar_id IS NOT NULL THEN
    SELECT * INTO v_conta
    FROM public.contas_pagar
    WHERE id = v_medicao.conta_pagar_id
    FOR UPDATE;

    IF v_conta.valor_pago > 0 OR v_conta.status = 'pago' THEN
      RAISE EXCEPTION 'Medição possui pagamento realizado na conta a pagar e não pode ser cancelada sem estorno';
    END IF;

    -- Cancela a conta a pagar em aberto
    UPDATE public.contas_pagar
    SET status = 'cancelado',
        updated_at = now()
    WHERE id = v_medicao.conta_pagar_id;
  END IF;

  -- Cancela retenções pendentes vinculadas
  UPDATE public.retencoes_empreiteiros
  SET status = 'cancelada',
      updated_at = now()
  WHERE medicao_empreiteiro_id = v_medicao.id;

  -- Reverte amortização no contrato se houver
  IF v_medicao.valor_amortizacao_centavos > 0 AND v_medicao.status IN ('aprovada', 'paga') THEN
    UPDATE public.contratos_empreiteiros
    SET adiantamento_amortizado_centavos = GREATEST(0, adiantamento_amortizado_centavos - v_medicao.valor_amortizacao_centavos)
    WHERE id = v_medicao.contrato_empreiteiro_id;
  END IF;

  UPDATE public.medicoes_empreiteiros
  SET status = 'cancelada',
      motivo_recusa = p_motivo,
      updated_at = now()
  WHERE id = v_medicao.id;

  INSERT INTO public.contrato_empreiteiro_auditoria (
    contrato_empreiteiro_id,
    medicao_empreiteiro_id,
    ator_id,
    acao,
    entidade,
    dados_anteriores,
    dados_novos
  ) VALUES (
    v_medicao.contrato_empreiteiro_id,
    v_medicao.id,
    v_usuario_id,
    'CANCELAR_MEDICAO',
    'medicoes_empreiteiros',
    to_jsonb(v_medicao),
    jsonb_build_object('status', 'cancelada', 'motivo', p_motivo)
  );

  RETURN jsonb_build_object('sucesso', true, 'medicao_id', v_medicao.id, 'status', 'cancelada');
END;
$$;

-- C. Liberação de Retenção
CREATE OR REPLACE FUNCTION public.liberar_retencao_empreiteiro(
  p_retencao_id uuid,
  p_valor_liberar_centavos bigint,
  p_data_vencimento date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retencao RECORD;
  v_contrato RECORD;
  v_usuario_id uuid;
  v_nova_conta_id uuid;
  v_novo_saldo bigint;
  v_status public.status_retencao_empreiteiro;
BEGIN
  v_usuario_id := auth.uid();

  IF NOT (
    public.has_role(v_usuario_id, 'admin')
    OR public.has_role(v_usuario_id, 'diretor')
    OR public.has_role(v_usuario_id, 'financeiro')
    OR public.has_role(v_usuario_id, 'financeiro_civil')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para liberar retenção';
  END IF;

  SELECT * INTO v_retencao
  FROM public.retencoes_empreiteiros
  WHERE id = p_retencao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Retenção não encontrada';
  END IF;

  IF p_valor_liberar_centavos <= 0 OR p_valor_liberar_centavos > v_retencao.saldo_retido_centavos THEN
    RAISE EXCEPTION 'Valor de liberação inválido ou superior ao saldo retido';
  END IF;

  SELECT * INTO v_contrato
  FROM public.contratos_empreiteiros
  WHERE id = v_retencao.contrato_empreiteiro_id;

  IF v_contrato.status != 'concluido' THEN
    RAISE EXCEPTION 'Retenções só podem ser liberadas após a conclusão do contrato';
  END IF;

  -- Cria conta a pagar da liberação
  INSERT INTO public.contas_pagar (
    descricao,
    fornecedor_id,
    obra_id,
    valor,
    valor_pago,
    status,
    data_vencimento,
    retencao_empreiteiro_id
  ) VALUES (
    'Liberação de Retenção · Contrato ' || v_contrato.numero,
    v_contrato.fornecedor_id,
    v_contrato.obra_id,
    (p_valor_liberar_centavos::numeric / 100),
    0,
    'aberto',
    COALESCE(p_data_vencimento, CURRENT_DATE + INTERVAL '10 days'),
    v_retencao.id
  ) RETURNING id INTO v_nova_conta_id;

  v_novo_saldo := v_retencao.saldo_retido_centavos - p_valor_liberar_centavos;
  IF v_novo_saldo = 0 THEN
    v_status := 'liberada_total';
  ELSE
    v_status := 'liberada_parcial';
  END IF;

  UPDATE public.retencoes_empreiteiros
  SET saldo_retido_centavos = v_novo_saldo,
      status = v_status,
      liberado_em = now(),
      liberado_por = v_usuario_id,
      conta_pagar_liberacao_id = v_nova_conta_id,
      updated_at = now()
  WHERE id = v_retencao.id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'retencao_id', v_retencao.id,
    'valor_liberado_centavos', p_valor_liberar_centavos,
    'saldo_remanescente_centavos', v_novo_saldo,
    'conta_pagar_id', v_nova_conta_id
  );
END;
$$;

-- 16. RLS E POLÍTICAS DE ACESSO
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contratos_empreiteiros',
    'medicoes_empreiteiros',
    'medicao_empreiteiro_ajustes',
    'contrato_empreiteiro_aditivos',
    'medicao_empreiteiro_anexos',
    'retencoes_empreiteiros',
    'medicao_empreiteiro_links',
    'contrato_empreiteiro_auditoria',
    'medicao_empreiteiro_alcadas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_acesso ON public.%I', t, t);
    EXECUTE format('
      CREATE POLICY %I_acesso ON public.%I
      FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), ''admin'')
        OR public.has_role(auth.uid(), ''diretor'')
        OR public.has_role(auth.uid(), ''engenharia'')
        OR public.has_role(auth.uid(), ''compras'')
        OR public.has_role(auth.uid(), ''financeiro'')
        OR public.has_role(auth.uid(), ''financeiro_civil'')
      )
      WITH CHECK (
        public.has_role(auth.uid(), ''admin'')
        OR public.has_role(auth.uid(), ''diretor'')
        OR public.has_role(auth.uid(), ''engenharia'')
        OR public.has_role(auth.uid(), ''compras'')
        OR public.has_role(auth.uid(), ''financeiro'')
        OR public.has_role(auth.uid(), ''financeiro_civil'')
      )', t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.aprovar_medicao_empreiteiro(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_medicao_empreiteiro(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.liberar_retencao_empreiteiro(uuid, bigint, date) TO authenticated, service_role;

-- 17. DOCUMENTAÇÃO DE ROLLBACK
-- Em caso de necessidade de reversão segura:
-- DROP FUNCTION IF EXISTS public.liberar_retencao_empreiteiro(uuid, bigint, date);
-- DROP FUNCTION IF EXISTS public.cancelar_medicao_empreiteiro(uuid, text);
-- DROP FUNCTION IF EXISTS public.aprovar_medicao_empreiteiro(uuid, date);
-- DROP TABLE IF EXISTS public.contrato_empreiteiro_auditoria, public.medicao_empreiteiro_links,
--   public.retencoes_empreiteiros, public.medicao_empreiteiro_anexos, public.contrato_empreiteiro_aditivos,
--   public.medicao_empreiteiro_ajustes, public.medicoes_empreiteiros, public.contratos_empreiteiros,
--   public.medicao_empreiteiro_alcadas CASCADE;
