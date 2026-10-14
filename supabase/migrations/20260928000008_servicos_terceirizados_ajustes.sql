-- Ajustes do fluxo de serviços terceirizados: ordenação e aprovação financeira.
ALTER TABLE public.servicos_terceirizados
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS servicos_terceirizados_obra_ordem_idx
  ON public.servicos_terceirizados (obra_id, ordem, created_at);

-- Garante que a conta gerada pela aprovação tenha o vínculo com a medição.
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS medicao_terceirizado_id uuid
  REFERENCES public.medicoes_terceirizados(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_medicao_terceirizado_unique
  ON public.contas_pagar (medicao_terceirizado_id)
  WHERE medicao_terceirizado_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.aprovar_medicao_terceirizado(p_medicao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medicao public.medicoes_terceirizados;
  v_servico public.servicos_terceirizados;
  v_ja_medido numeric(14,3);
  v_conta_id uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR
    public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR
    public.has_role(auth.uid(), 'financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar medição de prestador';
  END IF;

  SELECT * INTO v_medicao FROM public.medicoes_terceirizados WHERE id = p_medicao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medição não encontrada'; END IF;
  IF v_medicao.status <> 'rascunho' THEN RAISE EXCEPTION 'Esta medição já foi processada'; END IF;

  SELECT * INTO v_servico FROM public.servicos_terceirizados WHERE id = v_medicao.servico_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serviço contratado não encontrado'; END IF;
  IF v_servico.status <> 'aprovado' THEN RAISE EXCEPTION 'O serviço precisa estar aprovado antes da medição'; END IF;

  SELECT coalesce(sum(quantidade_executada), 0) INTO v_ja_medido
  FROM public.medicoes_terceirizados
  WHERE servico_id = v_servico.id AND status = 'financeiro_gerado';

  IF v_ja_medido + v_medicao.quantidade_executada > v_servico.quantidade THEN
    RAISE EXCEPTION 'A quantidade medida supera a quantidade contratada';
  END IF;

  INSERT INTO public.contas_pagar (
    obra_id, fornecedor_id, descricao, valor_total, data_vencimento,
    status, medicao_terceirizado_id
  ) VALUES (
    v_servico.obra_id, v_servico.fornecedor_id,
    concat('Medição de prestador — ', v_servico.tipo_servico),
    v_medicao.valor_total, v_medicao.data_vencimento, 'aberta', v_medicao.id
  ) RETURNING id INTO v_conta_id;

  UPDATE public.medicoes_terceirizados
  SET status = 'financeiro_gerado', conta_pagar_id = v_conta_id,
      aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now()
  WHERE id = p_medicao_id;

  IF v_ja_medido + v_medicao.quantidade_executada = v_servico.quantidade THEN
    UPDATE public.servicos_terceirizados
    SET status = 'concluido', updated_at = now()
    WHERE id = v_servico.id;
  END IF;
  RETURN v_conta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_medicao_terceirizado(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

