-- Armazena a logo institucional usada no painel e nos documentos.
alter table public.configuracoes_empresa
  add column if not exists logo_url text;

comment on column public.configuracoes_empresa.logo_url is
  'URL pública da logo institucional da empresa.';
