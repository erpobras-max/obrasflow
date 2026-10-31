-- Migration: 20261031150000_financeiro_transferencias_bancarias.sql
-- Fase 2 do Financeiro: Gestão de Transferências entre Contas Bancárias

CREATE TABLE IF NOT EXISTS public.transferencias_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_origem_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
  conta_destino_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  data_transferencia date NOT NULL DEFAULT current_date,
  descricao text,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT transferencias_contas_distintas CHECK (conta_origem_id <> conta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_origem ON public.transferencias_bancarias (conta_origem_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.transferencias_bancarias (conta_destino_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.transferencias_bancarias (data_transferencia DESC);

COMMENT ON TABLE public.transferencias_bancarias IS 'Registra transferências financeiras internas entre contas bancárias da empresa sem impacto em receitas/despesas operacionais ou DRE';

ALTER TABLE public.transferencias_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transf_bancarias_select" ON public.transferencias_bancarias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "transf_bancarias_insert" ON public.transferencias_bancarias
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "transf_bancarias_update" ON public.transferencias_bancarias
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "transf_bancarias_delete" ON public.transferencias_bancarias
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON public.transferencias_bancarias TO authenticated;
GRANT ALL ON public.transferencias_bancarias TO service_role;

