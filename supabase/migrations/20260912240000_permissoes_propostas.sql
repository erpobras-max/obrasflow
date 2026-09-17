-- Concede permissões de tabela às sessões autenticadas; as políticas RLS
-- continuam definindo quem pode ler ou alterar cada registro.

grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.propostas_catalogo_etapas,
  public.propostas_catalogo_itens,
  public.propostas_catalogo_subitens,
  public.propostas_etapas,
  public.propostas_itens_hierarquia,
  public.propostas_subitens
to authenticated;
