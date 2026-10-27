-- OneSignal omnichannel: controlar e-mail, SMS e push separadamente por OS/dia.

ALTER TABLE public.notificacoes_historico
  DROP CONSTRAINT IF EXISTS notificacoes_historico_tipo_check,
  DROP CONSTRAINT IF EXISTS notificacoes_historico_status_check;

ALTER TABLE public.notificacoes_historico
  ADD CONSTRAINT notificacoes_historico_tipo_check CHECK (tipo IN ('email', 'sms', 'push', 'sino')),
  ADD CONSTRAINT notificacoes_historico_status_check CHECK (status IN ('pendente', 'sucesso', 'erro'));

CREATE OR REPLACE FUNCTION public.processar_prazos_ordens_servico()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora_atual TIME := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::time;
  v_os RECORD;
  v_diff_dias INTEGER;
  v_tipo_aviso TEXT;
  v_email_destino TEXT;
  v_enviar_email BOOLEAN;
  v_enviar_sms BOOLEAN;
  v_enviar_push BOOLEAN;
  v_lista_avisos JSONB := '[]'::jsonb;
  v_sinos_criados INTEGER := 0;
  v_total_verificadas INTEGER := 0;
BEGIN
  FOR v_os IN
    SELECT
      os.id,
      os.numero,
      os.titulo,
      os.descricao,
      os.data_previsao,
      os.responsavel_nome,
      NULLIF(TRIM(os.responsavel_telefone), '') AS responsavel_telefone,
      NULLIF(TRIM(os.email_notificacao), '') AS email_notificacao,
      COALESCE(os.horario_lembrete, '08:00'::time) AS horario_lembrete,
      o.nome AS obra_nome,
      NULLIF(TRIM(p.email), '') AS responsavel_email,
      p.user_id AS responsavel_user_id
    FROM public.ordens_servico os
    LEFT JOIN public.obras o ON o.id = os.obra_id
    LEFT JOIN public.perfis_usuarios p ON p.id = os.responsavel_id
    WHERE os.status NOT IN ('concluida', 'cancelada')
      AND os.data_previsao IS NOT NULL
  LOOP
    v_total_verificadas := v_total_verificadas + 1;
    v_diff_dias := v_os.data_previsao - v_hoje;
    v_tipo_aviso := CASE
      WHEN v_diff_dias < 0 THEN 'atrasada'
      WHEN v_diff_dias = 0 THEN 'vence_hoje'
      WHEN v_diff_dias = 1 THEN 'vence_amanha'
      WHEN v_diff_dias <= 2 THEN 'vence_breve'
      ELSE NULL
    END;

    IF v_tipo_aviso IS NULL OR v_hora_atual < v_os.horario_lembrete THEN
      CONTINUE;
    END IF;

    v_email_destino := COALESCE(v_os.email_notificacao, v_os.responsavel_email);
    v_enviar_email := v_email_destino IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes_historico
      WHERE referencia_tipo = 'ordens_servico' AND referencia_id = v_os.id
        AND tipo = 'email' AND data_envio = v_hoje AND status IN ('pendente', 'sucesso')
    );
    v_enviar_sms := v_os.responsavel_telefone IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes_historico
      WHERE referencia_tipo = 'ordens_servico' AND referencia_id = v_os.id
        AND tipo = 'sms' AND data_envio = v_hoje AND status IN ('pendente', 'sucesso')
    );
    v_enviar_push := v_os.responsavel_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes_historico
      WHERE referencia_tipo = 'ordens_servico' AND referencia_id = v_os.id
        AND tipo = 'push' AND data_envio = v_hoje AND status IN ('pendente', 'sucesso')
    );

    IF v_os.responsavel_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.notificacoes_historico
      WHERE referencia_tipo = 'ordens_servico' AND referencia_id = v_os.id
        AND tipo = 'sino' AND data_envio = v_hoje AND status = 'sucesso'
    ) THEN
      INSERT INTO public.notificacoes_usuario (user_id, titulo, mensagem, lida)
      VALUES (
        v_os.responsavel_user_id,
        'Alerta de OS: ' || v_os.numero,
        CASE
          WHEN v_tipo_aviso = 'atrasada' THEN '⚠️ A OS ' || v_os.numero || ' está atrasada.'
          WHEN v_tipo_aviso = 'vence_hoje' THEN '⏰ A OS ' || v_os.numero || ' vence hoje.'
          ELSE 'A OS ' || v_os.numero || ' vence em breve.'
        END,
        false
      );
      INSERT INTO public.notificacoes_historico (tipo, referencia_tipo, referencia_id, destinatario, data_envio, status)
      VALUES ('sino', 'ordens_servico', v_os.id, v_os.responsavel_user_id::text, v_hoje, 'sucesso')
      ON CONFLICT (referencia_tipo, referencia_id, tipo, data_envio) DO NOTHING;
      v_sinos_criados := v_sinos_criados + 1;
    END IF;

    IF v_enviar_email THEN
      INSERT INTO public.notificacoes_historico (tipo, referencia_tipo, referencia_id, destinatario, data_envio, status)
      VALUES ('email', 'ordens_servico', v_os.id, v_email_destino, v_hoje, 'pendente')
      ON CONFLICT (referencia_tipo, referencia_id, tipo, data_envio)
      DO UPDATE SET destinatario = EXCLUDED.destinatario, status = 'pendente', detalhes = NULL;
    END IF;
    IF v_enviar_sms THEN
      INSERT INTO public.notificacoes_historico (tipo, referencia_tipo, referencia_id, destinatario, data_envio, status)
      VALUES ('sms', 'ordens_servico', v_os.id, v_os.responsavel_telefone, v_hoje, 'pendente')
      ON CONFLICT (referencia_tipo, referencia_id, tipo, data_envio)
      DO UPDATE SET destinatario = EXCLUDED.destinatario, status = 'pendente', detalhes = NULL;
    END IF;
    IF v_enviar_push THEN
      INSERT INTO public.notificacoes_historico (tipo, referencia_tipo, referencia_id, destinatario, data_envio, status)
      VALUES ('push', 'ordens_servico', v_os.id, v_os.responsavel_user_id::text, v_hoje, 'pendente')
      ON CONFLICT (referencia_tipo, referencia_id, tipo, data_envio)
      DO UPDATE SET destinatario = EXCLUDED.destinatario, status = 'pendente', detalhes = NULL;
    END IF;

    IF v_enviar_email OR v_enviar_sms OR v_enviar_push THEN
      v_lista_avisos := v_lista_avisos || jsonb_build_object(
        'osId', v_os.id,
        'numero', v_os.numero,
        'titulo', v_os.titulo,
        'descricao', v_os.descricao,
        'obraNome', v_os.obra_nome,
        'dataPrevisao', v_os.data_previsao::text,
        'tipoAviso', v_tipo_aviso,
        'email', v_email_destino,
        'telefone', v_os.responsavel_telefone,
        'responsavelNome', COALESCE(v_os.responsavel_nome, 'Responsável'),
        'responsavelUserId', v_os.responsavel_user_id,
        'enviarEmail', v_enviar_email,
        'enviarSms', v_enviar_sms,
        'enviarPush', v_enviar_push
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'totalVerificadas', v_total_verificadas,
    'sinosCriados', v_sinos_criados,
    'horaProcessamento', v_hora_atual::text,
    'emailsParaEnvio', v_lista_avisos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.processar_prazos_ordens_servico() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_prazos_ordens_servico() TO service_role;
