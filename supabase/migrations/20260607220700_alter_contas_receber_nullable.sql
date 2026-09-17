-- Alter public.contas_receber columns to allow null values, letting receipts be linked to other sources.
ALTER TABLE public.contas_receber ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE public.contas_receber ALTER COLUMN cliente_id DROP NOT NULL;
