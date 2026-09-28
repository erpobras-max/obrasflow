-- Registra separadamente o valor adicional de uma receita.
-- Os valores financeiros desta tabela são armazenados em centavos.
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS valor_aditivo BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.contas_receber
  DROP CONSTRAINT IF EXISTS contas_receber_valor_aditivo_nao_negativo;

ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_valor_aditivo_nao_negativo
  CHECK (valor_aditivo >= 0);
