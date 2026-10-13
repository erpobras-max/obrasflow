-- Permite personalizar as cláusulas de cada contrato civil sem alterar o modelo dos próximos contratos.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS clausulas JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_clausulas_array_check;

ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_clausulas_array_check
  CHECK (jsonb_typeof(clausulas) = 'array');

NOTIFY pgrst, 'reload schema';

