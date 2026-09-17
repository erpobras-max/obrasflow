-- Estrutura hierárquica do orçamento comercial: catálogo padrão e cópia por proposta.
-- Executar no Supabase SQL Editor ou via Supabase CLI antes de publicar a interface.

alter table public.propostas
  add column if not exists prazo_total_dias integer,
  add column if not exists observacoes_gerais text;

create table if not exists public.propostas_catalogo_etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.propostas_catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  etapa_id uuid not null references public.propostas_catalogo_etapas(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (etapa_id, codigo)
);

create table if not exists public.propostas_catalogo_subitens (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.propostas_catalogo_itens(id) on delete cascade,
  codigo text not null,
  descricao text not null,
  unidade text not null default 'un',
  valor_unitario numeric(14,2) not null default 0 check (valor_unitario >= 0),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, codigo)
);

create table if not exists public.propostas_etapas (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  catalogo_etapa_id uuid references public.propostas_catalogo_etapas(id) on delete set null,
  codigo text,
  descricao text not null,
  observacoes text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.propostas_itens_hierarquia (
  id uuid primary key default gen_random_uuid(),
  proposta_etapa_id uuid not null references public.propostas_etapas(id) on delete cascade,
  catalogo_item_id uuid references public.propostas_catalogo_itens(id) on delete set null,
  codigo text not null,
  descricao text not null,
  quantidade numeric(14,3) not null default 1 check (quantidade >= 0),
  valor_unitario numeric(14,2) not null default 0 check (valor_unitario >= 0),
  observacoes text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.propostas_subitens (
  id uuid primary key default gen_random_uuid(),
  proposta_item_id uuid not null references public.propostas_itens_hierarquia(id) on delete cascade,
  catalogo_subitem_id uuid references public.propostas_catalogo_subitens(id) on delete set null,
  codigo text not null,
  descricao text not null,
  unidade text not null default 'un',
  quantidade numeric(14,3) not null default 1 check (quantidade >= 0),
  valor_unitario numeric(14,2) not null default 0 check (valor_unitario >= 0),
  observacoes text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists propostas_catalogo_itens_etapa_idx on public.propostas_catalogo_itens(etapa_id, ordem);
create index if not exists propostas_catalogo_subitens_item_idx on public.propostas_catalogo_subitens(item_id, ordem);
create index if not exists propostas_etapas_proposta_idx on public.propostas_etapas(proposta_id, ordem);
create index if not exists propostas_itens_hierarquia_etapa_idx on public.propostas_itens_hierarquia(proposta_etapa_id, ordem);
create index if not exists propostas_subitens_item_idx on public.propostas_subitens(proposta_item_id, ordem);

alter table public.propostas_catalogo_etapas enable row level security;
alter table public.propostas_catalogo_itens enable row level security;
alter table public.propostas_catalogo_subitens enable row level security;
alter table public.propostas_etapas enable row level security;
alter table public.propostas_itens_hierarquia enable row level security;
alter table public.propostas_subitens enable row level security;

-- O modelo segue o acesso já aplicado às propostas: usuários autenticados podem
-- consultar e manter o catálogo e os orçamentos aos quais o aplicativo dá acesso.
do $$
declare tab text;
begin
  foreach tab in array array[
    'propostas_catalogo_etapas','propostas_catalogo_itens','propostas_catalogo_subitens',
    'propostas_etapas','propostas_itens_hierarquia','propostas_subitens'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'authenticated_full_access', tab);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated_full_access', tab);
  end loop;
end $$;
