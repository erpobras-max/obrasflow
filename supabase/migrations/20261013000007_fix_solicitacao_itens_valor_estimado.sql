-- Corrige instalações em que a tela passou a usar valor_estimado antes da
-- coluna existir no banco remoto. Idempotente para permitir reaplicação segura.
ALTER TABLE public.solicitacao_itens
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.solicitacao_itens.valor_estimado IS
  'Valor unitário estimado do item, em reais, informado na solicitação de compra.';

NOTIFY pgrst, 'reload schema';
