-- Migration para suporte a parcelamento automático e apropriação por etapa de obra no financeiro
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS etapa_id uuid,
  ADD COLUMN IF NOT EXISTS etapa_nome text,
  ADD COLUMN IF NOT EXISTS parcelamento_id uuid,
  ADD COLUMN IF NOT EXISTS parcela_atual integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS etapa_id uuid,
  ADD COLUMN IF NOT EXISTS etapa_nome text,
  ADD COLUMN IF NOT EXISTS parcelamento_id uuid,
  ADD COLUMN IF NOT EXISTS parcela_atual integer,
  ADD COLUMN IF NOT EXISTS total_parcelas integer;

CREATE INDEX IF NOT EXISTS idx_cp_parcelamento ON public.contas_pagar(parcelamento_id) WHERE parcelamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cr_parcelamento ON public.contas_receber(parcelamento_id) WHERE parcelamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp_etapa ON public.contas_pagar(obra_id, etapa_id) WHERE etapa_id IS NOT NULL;

COMMENT ON COLUMN public.contas_pagar.etapa_id IS 'Etapa do orçamento ou cronograma da obra para apropriação de custos diretos.';
COMMENT ON COLUMN public.contas_pagar.etapa_nome IS 'Descrição da etapa da obra no momento do lançamento.';
COMMENT ON COLUMN public.contas_pagar.parcelamento_id IS 'Identificador do grupo de parcelas geradas em conjunto.';
COMMENT ON COLUMN public.contas_pagar.parcela_atual IS 'Número sequencial da parcela (ex: 1, 2, 3...).';
COMMENT ON COLUMN public.contas_pagar.total_parcelas IS 'Total de parcelas contratadas (ex: 12).';

