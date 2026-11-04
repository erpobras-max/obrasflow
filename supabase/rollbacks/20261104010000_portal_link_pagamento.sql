ALTER TABLE public.contas_receber
  DROP CONSTRAINT IF EXISTS contas_receber_link_pagamento_http_check;
ALTER TABLE public.contas_receber
  DROP COLUMN IF EXISTS link_pagamento;
