-- Classifica fornecedores e prestadores terceirizados sem duplicar cadastros.
-- Terceirizados podem ser vinculados a despesas e obras pela mesma chave de fornecedor.
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS classificacao text NOT NULL DEFAULT 'fornecedor'
    CHECK (classificacao IN ('fornecedor', 'terceirizado')),
  ADD COLUMN IF NOT EXISTS especialidade text;

CREATE INDEX IF NOT EXISTS fornecedores_classificacao_idx
  ON public.fornecedores (classificacao);

NOTIFY pgrst, 'reload schema';

