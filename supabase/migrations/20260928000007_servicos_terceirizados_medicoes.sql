-- Fluxo de contratação e medição de serviços terceirizados por obra.
CREATE TABLE IF NOT EXISTS public.servicos_terceirizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  tipo_servico text NOT NULL,
  descricao text,
  quantidade numeric(14,3) NOT NULL CHECK (quantidade > 0),
  valor_unitario bigint NOT NULL CHECK (valor_unitario > 0),
  valor_total bigint NOT NULL CHECK (valor_total > 0),
  data_inicio date NOT NULL,
  data_fim date,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aprovado', 'concluido', 'cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS servicos_terceirizados_obra_idx ON public.servicos_terceirizados(obra_id, status);
CREATE INDEX IF NOT EXISTS servicos_terceirizados_fornecedor_idx ON public.servicos_terceirizados(fornecedor_id);

CREATE TABLE IF NOT EXISTS public.medicoes_terceirizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL REFERENCES public.servicos_terceirizados(id) ON DELETE CASCADE,
  quantidade_executada numeric(14,3) NOT NULL CHECK (quantidade_executada > 0),
  valor_unitario bigint NOT NULL CHECK (valor_unitario > 0),
  valor_total bigint NOT NULL CHECK (valor_total > 0),
  data_medicao date NOT NULL DEFAULT current_date,
  data_vencimento date NOT NULL,
  observacoes text,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'financeiro_gerado', 'reprovada')),
  conta_pagar_id uuid REFERENCES public.contas_pagar(id) ON DELETE SET NULL,
  aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medicoes_terceirizados_servico_idx ON public.medicoes_terceirizados(servico_id, status);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS medicao_terceirizado_id uuid REFERENCES public.medicoes_terceirizados(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contas_pagar_medicao_terceirizado_unique ON public.contas_pagar(medicao_terceirizado_id) WHERE medicao_terceirizado_id IS NOT NULL;

ALTER TABLE public.servicos_terceirizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes_terceirizados ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servicos_terceirizados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes_terceirizados TO authenticated;
GRANT ALL ON public.servicos_terceirizados, public.medicoes_terceirizados TO service_role;

DROP POLICY IF EXISTS servicos_terceirizados_select ON public.servicos_terceirizados;
CREATE POLICY servicos_terceirizados_select ON public.servicos_terceirizados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS servicos_terceirizados_write ON public.servicos_terceirizados;
CREATE POLICY servicos_terceirizados_write ON public.servicos_terceirizados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'financeiro'));
DROP POLICY IF EXISTS medicoes_terceirizados_select ON public.medicoes_terceirizados;
CREATE POLICY medicoes_terceirizados_select ON public.medicoes_terceirizados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS medicoes_terceirizados_write ON public.medicoes_terceirizados;
CREATE POLICY medicoes_terceirizados_write ON public.medicoes_terceirizados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'financeiro'));

CREATE OR REPLACE FUNCTION public.atualizar_valor_medicao_terceirizado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.valor_total := round(NEW.quantidade_executada * NEW.valor_unitario)::bigint;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_medicoes_terceirizados_valor ON public.medicoes_terceirizados;
CREATE TRIGGER trg_medicoes_terceirizados_valor BEFORE INSERT OR UPDATE OF quantidade_executada, valor_unitario ON public.medicoes_terceirizados
FOR EACH ROW EXECUTE FUNCTION public.atualizar_valor_medicao_terceirizado();

CREATE OR REPLACE FUNCTION public.aprovar_medicao_terceirizado(p_medicao_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_medicao public.medicoes_terceirizados;
  v_servico public.servicos_terceirizados;
  v_ja_medido numeric(14,3);
  v_conta_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'engenharia') OR public.has_role(auth.uid(), 'compras') OR public.has_role(auth.uid(), 'financeiro')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar medição de prestador';
  END IF;
  SELECT * INTO v_medicao FROM public.medicoes_terceirizados WHERE id = p_medicao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medição não encontrada'; END IF;
  IF v_medicao.status <> 'rascunho' THEN RAISE EXCEPTION 'Esta medição já foi processada'; END IF;
  SELECT * INTO v_servico FROM public.servicos_terceirizados WHERE id = v_medicao.servico_id FOR UPDATE;
  IF v_servico.status <> 'aprovado' THEN RAISE EXCEPTION 'O serviço precisa estar aprovado antes da medição'; END IF;
  SELECT coalesce(sum(quantidade_executada), 0) INTO v_ja_medido FROM public.medicoes_terceirizados WHERE servico_id = v_servico.id AND status = 'financeiro_gerado';
  IF v_ja_medido + v_medicao.quantidade_executada > v_servico.quantidade THEN RAISE EXCEPTION 'A quantidade medida supera a quantidade contratada'; END IF;
  INSERT INTO public.contas_pagar (origem, obra_id, fornecedor_id, descricao, valor_total, data_vencimento, status, medicao_terceirizado_id, created_by)
  VALUES ('erp', v_servico.obra_id, v_servico.fornecedor_id, concat('Medição de prestador — ', v_servico.tipo_servico), v_medicao.valor_total, v_medicao.data_vencimento, 'aberta', v_medicao.id, auth.uid())
  RETURNING id INTO v_conta_id;
  UPDATE public.medicoes_terceirizados SET status = 'financeiro_gerado', conta_pagar_id = v_conta_id, aprovado_por = auth.uid(), aprovado_em = now(), updated_at = now() WHERE id = p_medicao_id;
  IF v_ja_medido + v_medicao.quantidade_executada = v_servico.quantidade THEN UPDATE public.servicos_terceirizados SET status = 'concluido', updated_at = now() WHERE id = v_servico.id; END IF;
  RETURN v_conta_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.aprovar_medicao_terceirizado(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

