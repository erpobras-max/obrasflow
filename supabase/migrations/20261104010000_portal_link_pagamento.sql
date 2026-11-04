-- Link opcional de pagamento publicado pela equipe financeira.
ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS link_pagamento text;

ALTER TABLE public.contas_receber
  DROP CONSTRAINT IF EXISTS contas_receber_link_pagamento_http_check;
ALTER TABLE public.contas_receber
  ADD CONSTRAINT contas_receber_link_pagamento_http_check
  CHECK (link_pagamento IS NULL OR link_pagamento ~* '^https://');
