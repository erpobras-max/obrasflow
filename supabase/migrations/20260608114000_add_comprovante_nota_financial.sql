-- Add document fields for Accounts Receivable (Contas a Receber)
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS nota_fiscal_url text;
ALTER TABLE public.contas_receber ADD COLUMN IF NOT EXISTS comprovante_url text;

-- Add document fields for Accounts Payable (Contas a Pagar)
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS nota_fiscal_url text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
