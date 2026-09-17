-- Garante o cadastro institucional em instalações que ainda não executaram a migração inicial.
create table if not exists public.configuracoes_empresa (
  id integer primary key default 1,
  razao_social text not null,
  cnpj text not null,
  endereco text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint configuracoes_empresa_single_row check (id = 1)
);

insert into public.configuracoes_empresa (id, razao_social, cnpj, endereco)
values (1, 'Minha Empresa Ltda.', '00.000.000/0001-00', 'Endereço a preencher')
on conflict (id) do nothing;

alter table public.configuracoes_empresa enable row level security;

drop policy if exists "permitir_select_empresa" on public.configuracoes_empresa;
create policy "permitir_select_empresa" on public.configuracoes_empresa
  for select to authenticated using (true);

drop policy if exists "permitir_update_empresa" on public.configuracoes_empresa;
create policy "permitir_update_empresa" on public.configuracoes_empresa
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'diretor')
    or public.has_role(auth.uid(), 'rh')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'diretor')
    or public.has_role(auth.uid(), 'rh')
  );

grant select, insert, update on public.configuracoes_empresa to authenticated;
grant all on public.configuracoes_empresa to service_role;

-- Cadastro completo da empresa para documentos, propostas e relatórios.
alter table public.configuracoes_empresa
  add column if not exists nome_fantasia text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists celular text,
  add column if not exists website text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text check (uf is null or char_length(uf) = 2),
  add column if not exists situacao_cadastral text,
  add column if not exists data_abertura date,
  add column if not exists atividade_principal text;

comment on table public.configuracoes_empresa is
  'Dados oficiais da empresa utilizados em documentos, propostas e relatórios.';
