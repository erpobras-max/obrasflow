-- Alterar constraints das tabelas de referência para aceitar novas fontes
ALTER TABLE public.referencia_insumos DROP CONSTRAINT IF EXISTS referencia_insumos_fonte_check;
ALTER TABLE public.referencia_insumos ADD CONSTRAINT referencia_insumos_fonte_check CHECK (fonte IN ('sinapi', 'sicro', 'setop', 'sudecap'));

ALTER TABLE public.referencia_composicoes DROP CONSTRAINT IF EXISTS referencia_composicoes_fonte_check;
ALTER TABLE public.referencia_composicoes ADD CONSTRAINT referencia_composicoes_fonte_check CHECK (fonte IN ('sinapi', 'sicro', 'setop', 'sudecap'));
