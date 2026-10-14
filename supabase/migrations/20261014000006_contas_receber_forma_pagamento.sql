-- Garante forma de pagamento em contas a receber já existentes.
-- A coluna era definida apenas no CREATE TABLE IF NOT EXISTS, que não
-- altera uma tabela criada por migrations anteriores.
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS forma_pagamento text;

NOTIFY pgrst, 'reload schema';
