
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS valor_recebido bigint;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_pago bigint;
