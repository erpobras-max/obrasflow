-- Rastreabilidade das referências SINAPI/SICRO usadas em orçamentos e medições.
-- As tabelas de referência já existem no módulo de Orçamentos.

alter table public.propostas_itens
  add column if not exists referencia_id uuid,
  add column if not exists fonte_referencia text,
  add column if not exists tipo_referencia text,
  add column if not exists codigo_referencia text,
  add column if not exists referencia_uf char(2),
  add column if not exists referencia_mes text;

alter table public.medicoes_itens
  add column if not exists referencia_id uuid,
  add column if not exists fonte_referencia text,
  add column if not exists tipo_referencia text,
  add column if not exists codigo_referencia text,
  add column if not exists referencia_uf char(2),
  add column if not exists referencia_mes text;

alter table public.orcamento_itens
  add column if not exists referencia_id uuid,
  add column if not exists tipo_referencia text,
  add column if not exists referencia_uf char(2),
  add column if not exists referencia_mes text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'propostas_itens_fonte_referencia_check') then
    alter table public.propostas_itens
      add constraint propostas_itens_fonte_referencia_check
      check (fonte_referencia is null or fonte_referencia in ('sinapi', 'sicro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'propostas_itens_tipo_referencia_check') then
    alter table public.propostas_itens
      add constraint propostas_itens_tipo_referencia_check
      check (tipo_referencia is null or tipo_referencia in ('insumo', 'composicao'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'medicoes_itens_fonte_referencia_check') then
    alter table public.medicoes_itens
      add constraint medicoes_itens_fonte_referencia_check
      check (fonte_referencia is null or fonte_referencia in ('sinapi', 'sicro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'medicoes_itens_tipo_referencia_check') then
    alter table public.medicoes_itens
      add constraint medicoes_itens_tipo_referencia_check
      check (tipo_referencia is null or tipo_referencia in ('insumo', 'composicao'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orcamento_itens_tipo_referencia_check') then
    alter table public.orcamento_itens
      add constraint orcamento_itens_tipo_referencia_check
      check (tipo_referencia is null or tipo_referencia in ('insumo', 'composicao'));
  end if;
end $$;

create index if not exists propostas_itens_referencia_idx
  on public.propostas_itens(fonte_referencia, codigo_referencia);
create index if not exists medicoes_itens_referencia_idx
  on public.medicoes_itens(fonte_referencia, codigo_referencia);
create index if not exists orcamento_itens_referencia_idx
  on public.orcamento_itens(fonte_referencia, codigo);

grant select on public.referencia_insumos, public.referencia_composicoes to authenticated;
