-- Portal do cliente: decisões por obra e consulta comercial sanitizada.
-- Migração aditiva: não altera nem replica o orçamento analítico interno.

CREATE TABLE IF NOT EXISTS public.portal_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('aditivo', 'escolha', 'documento', 'mensagem')),
  titulo text NOT NULL CHECK (length(trim(titulo)) BETWEEN 3 AND 180),
  descricao text NOT NULL CHECK (length(trim(descricao)) BETWEEN 3 AND 4000),
  prazo_em date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondida', 'cancelada', 'expirada')),
  resposta text,
  respondido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  respondido_em timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (respondido_em IS NULL AND respondido_por IS NULL AND resposta IS NULL)
    OR (respondido_em IS NOT NULL AND respondido_por IS NOT NULL AND resposta IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS portal_solicitacoes_obra_status_idx
  ON public.portal_solicitacoes (obra_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_portal_solicitacoes_updated_at ON public.portal_solicitacoes;
CREATE TRIGGER trg_portal_solicitacoes_updated_at
  BEFORE UPDATE ON public.portal_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.portal_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_solicitacoes_cliente_select ON public.portal_solicitacoes;
CREATE POLICY portal_solicitacoes_cliente_select ON public.portal_solicitacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.obras obra
      JOIN public.clientes cliente ON cliente.id = obra.cliente_id
      WHERE obra.id = portal_solicitacoes.obra_id
        AND cliente.auth_user_id = auth.uid()
        AND cliente.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS portal_solicitacoes_equipe_gestao ON public.portal_solicitacoes;
CREATE POLICY portal_solicitacoes_equipe_gestao ON public.portal_solicitacoes
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'engenharia')
  );

CREATE OR REPLACE FUNCTION public.consultar_proposta_portal(p_obra_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object(
      'propostaId', proposta.id,
      'numero', proposta.numero,
      'titulo', proposta.titulo,
      'status', proposta.status,
      'revisaoNumero', revisao.numero,
      'enviadaEm', revisao.enviada_at,
      'fotografia', public.sanitizar_fotografia_proposta(revisao.fotografia)
    )
    FROM public.obras obra
    JOIN public.clientes cliente ON cliente.id = obra.cliente_id
    JOIN public.propostas proposta ON proposta.id = obra.proposta_id
    JOIN LATERAL (
      SELECT pr.*
      FROM public.proposta_revisoes pr
      WHERE pr.proposta_id = proposta.id
        AND pr.status = 'aceita'
      ORDER BY pr.numero DESC
      LIMIT 1
    ) revisao ON true
    WHERE obra.id = p_obra_id
      AND cliente.auth_user_id = auth.uid()
      AND cliente.deleted_at IS NULL
      AND proposta.status = 'aceita'
  ), '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.responder_solicitacao_portal(
  p_solicitacao_id uuid,
  p_resposta text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao public.portal_solicitacoes%ROWTYPE;
  v_resposta text := trim(coalesce(p_resposta, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  IF length(v_resposta) < 2 OR length(v_resposta) > 2000 THEN
    RAISE EXCEPTION 'A resposta deve ter entre 2 e 2000 caracteres';
  END IF;

  SELECT solicitacao.* INTO v_solicitacao
  FROM public.portal_solicitacoes solicitacao
  JOIN public.obras obra ON obra.id = solicitacao.obra_id
  JOIN public.clientes cliente ON cliente.id = obra.cliente_id
  WHERE solicitacao.id = p_solicitacao_id
    AND cliente.auth_user_id = auth.uid()
    AND cliente.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada para este cliente';
  END IF;

  IF v_solicitacao.respondido_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta solicitação já foi respondida';
  END IF;

  IF v_solicitacao.status <> 'pendente' OR (v_solicitacao.prazo_em IS NOT NULL AND v_solicitacao.prazo_em < current_date) THEN
    RAISE EXCEPTION 'Esta solicitação não está disponível para resposta';
  END IF;

  UPDATE public.portal_solicitacoes
  SET resposta = v_resposta,
      respondido_por = auth.uid(),
      respondido_em = now(),
      status = 'respondida'
  WHERE id = p_solicitacao_id
    AND respondido_em IS NULL;

  RETURN jsonb_build_object('ok', true, 'id', p_solicitacao_id, 'status', 'respondida');
END;
$$;

REVOKE ALL ON FUNCTION public.consultar_proposta_portal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.responder_solicitacao_portal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_proposta_portal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_solicitacao_portal(uuid, text) TO authenticated;
GRANT SELECT ON public.portal_solicitacoes TO authenticated;

NOTIFY pgrst, 'reload schema';
