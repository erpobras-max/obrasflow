-- Restringe o acesso ao catálogo e à estrutura de propostas.
-- Executar depois de 20260912190000_propostas_hierarquicas.sql.

do $$
declare tab text;
begin
  foreach tab in array array[
    'propostas_catalogo_etapas','propostas_catalogo_itens','propostas_catalogo_subitens',
    'propostas_etapas','propostas_itens_hierarquia','propostas_subitens'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'authenticated_full_access', tab);
    execute format('drop policy if exists %I on public.%I', 'catalogo_leitura', tab);
    execute format('drop policy if exists %I on public.%I', 'equipe_gerencia', tab);
  end loop;
end $$;

create policy catalogo_leitura on public.propostas_catalogo_etapas for select to authenticated using (true);
create policy catalogo_leitura on public.propostas_catalogo_itens for select to authenticated using (true);
create policy catalogo_leitura on public.propostas_catalogo_subitens for select to authenticated using (true);

create policy equipe_gerencia on public.propostas_catalogo_etapas for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')));
create policy equipe_gerencia on public.propostas_catalogo_itens for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')));
create policy equipe_gerencia on public.propostas_catalogo_subitens for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','engenharia')));

create policy equipe_gerencia on public.propostas_etapas for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')));
create policy equipe_gerencia on public.propostas_itens_hierarquia for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')));
create policy equipe_gerencia on public.propostas_subitens for all to authenticated
using (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')))
with check (exists (select 1 from public.perfis_usuarios p where p.user_id = auth.uid() and p.perfil in ('admin','diretor','financeiro','engenharia')));
