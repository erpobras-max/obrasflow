-- Corrige a política RLS usada pelo upsert do cadastro institucional.
-- Somente perfis administrativos podem criar ou alterar a única configuração da empresa.
alter table public.configuracoes_empresa enable row level security;

drop policy if exists "permitir_update_empresa" on public.configuracoes_empresa;
drop policy if exists "permitir_insert_empresa" on public.configuracoes_empresa;

create policy "permitir_update_empresa"
on public.configuracoes_empresa
for update to authenticated
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

create policy "permitir_insert_empresa"
on public.configuracoes_empresa
for insert to authenticated
with check (
  id = 1
  and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'diretor')
    or public.has_role(auth.uid(), 'rh')
  )
);

grant select, insert, update on public.configuracoes_empresa to authenticated;
