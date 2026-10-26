-- Migration: Função RPC com SECURITY DEFINER para processamento seguro de prazos e alertas
-- Data: 2026-10-26

-- Garantir permissões nas tabelas
GRANT SELECT, INSERT, UPDATE ON public.ordens_servico TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notificacoes_historico TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notificacoes_usuario TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.processar_prazos_ordens_servico()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := CURRENT_DATE;
  v_os RECORD;
  v_diff_dias INTEGER;
  v_tipo_aviso TEXT;
  v_ja_enviado BOOLEAN;
  v_lista_emails JSONB := '[]'::jsonb;
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
      os.responsavel_id,
      os.responsavel_nome,
      os.responsavel_telefone,
      o.nome AS obra_nome,
      p.email AS responsavel_email
    FROM public.ordens_servico os
    LEFT JOIN public.obras o ON o.id = os.obra_id
    LEFT JOIN public.perfis_usuarios p ON p.id = os.responsavel_id
    WHERE os.status NOT IN ('concluida', 'cancelada')
      AND os.data_previsao IS NOT NULL
  LOOP
    v_total_verificadas := v_total_verificadas + 1;
    v_diff_dias := (v_os.data_previsao - v_hoje);

    IF v_diff_dias < 0 THEN
      v_tipo_aviso := 'atrasada';
    ELSIF v_diff_dias = 0 THEN
      v_tipo_aviso := 'vence_hoje';
    ELSIF v_diff_dias = 1 THEN
      v_tipo_aviso := 'vence_amanha';
    ELSIF v_diff_dias <= 2 THEN
      v_tipo_aviso := 'vence_breve';
    ELSE
      v_tipo_aviso := NULL;
    END IF;

    IF v_tipo_aviso IS NOT NULL THEN
      -- Verificar se já foi enviado hoje para evitar duplicidade
      SELECT EXISTS (
        SELECT 1 FROM public.notificacoes_historico
        WHERE referencia_tipo = 'ordens_servico'
          AND referencia_id = v_os.id
          AND data_envio = v_hoje
      ) INTO v_ja_enviado;

      IF NOT v_ja_enviado THEN
        -- Registrar no sino do sistema
        IF v_os.responsavel_id IS NOT NULL THEN
          INSERT INTO public.notificacoes_usuario (user_id, titulo, mensagem, lida)
          VALUES (
            v_os.responsavel_id,
            'Alerta de OS: ' || v_os.numero,
            CASE 
              WHEN v_tipo_aviso = 'atrasada' THEN '⚠️ ATENÇÃO: A OS ' || v_os.numero || ' (' || v_os.titulo || ') está ATRASADA!'
              WHEN v_tipo_aviso = 'vence_hoje' THEN '⏰ A OS ' || v_os.numero || ' (' || v_os.titulo || ') vence HOJE!'
              ELSE 'A OS ' || v_os.numero || ' (' || v_os.titulo || ') vence em breve.'
            END,
            false
          );
          v_sinos_criados := v_sinos_criados + 1;
        END IF;

        -- Gravar histórico para não duplicar hoje
        INSERT INTO public.notificacoes_historico (
          tipo, referencia_tipo, referencia_id, destinatario, data_envio, status, detalhes
        ) VALUES (
          CASE WHEN v_os.responsavel_email IS NOT NULL THEN 'email' ELSE 'sino' END,
          'ordens_servico',
          v_os.id,
          COALESCE(v_os.responsavel_email, v_os.responsavel_nome, 'responsavel'),
          v_hoje,
          'sucesso',
          'Aviso ' || v_tipo_aviso || ' gerado'
        );

        -- Adicionar à lista de e-mails para envio se tiver e-mail
        IF v_os.responsavel_email IS NOT NULL THEN
          v_lista_emails := v_lista_emails || jsonb_build_object(
            'osId', v_os.id,
            'numero', v_os.numero,
            'titulo', v_os.titulo,
            'descricao', v_os.descricao,
            'obraNome', v_os.obra_nome,
            'dataPrevisao', v_os.data_previsao::text,
            'tipoAviso', v_tipo_aviso,
            'email', v_os.responsavel_email,
            'responsavelNome', v_os.responsavel_nome
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'totalVerificadas', v_total_verificadas,
    'sinosCriados', v_sinos_criados,
    'emailsParaEnvio', v_lista_emails
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_prazos_ordens_servico() TO authenticated, anon, service_role;
