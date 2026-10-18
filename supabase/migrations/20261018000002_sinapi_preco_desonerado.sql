-- Adiciona a variante tributária "com desoneração" às bases SINAPI.
-- As colunas existentes (preco_mediano / custo_total) continuam guardando o valor
-- "sem desoneração" (sd), que é o correto para orçamentos públicos/CEF após a
-- reoneração da folha de pagamento (2024). A Caixa publica ambas as variantes (sd e cd).

alter table public.referencia_insumos
  add column if not exists preco_desonerado bigint; -- em centavos, com desoneração (cd)

alter table public.referencia_composicoes
  add column if not exists custo_desonerado bigint; -- em centavos, com desoneração (cd)

comment on column public.referencia_insumos.preco_desonerado is
  'Preço mediano com desoneração (cd), em centavos';
comment on column public.referencia_composicoes.custo_desonerado is
  'Custo total com desoneração (cd), em centavos';
