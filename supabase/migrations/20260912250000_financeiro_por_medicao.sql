-- Financeiro por medição: uma conta a receber por medição aprovada.
-- O percentual é calculado pelo valor medido em relação ao orçamento da obra.

alter table public.contas_receber
  add column if not exists medicao_id uuid references public.medicoes(id) on delete set null;

create unique index if not exists contas_receber_medicao_unique
  on public.contas_receber(medicao_id) where medicao_id is not null;

create or replace function public.recalcular_medicao_financeira(p_medicao_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_orcamento numeric(14,2);
  v_percentual numeric(5,2);
begin
  select coalesce(sum(valor_total), 0) into v_total
  from public.medicoes_itens where medicao_id = p_medicao_id;

  select o.orcamento into v_orcamento
  from public.medicoes m join public.obras o on o.id = m.obra_id
  where m.id = p_medicao_id;

  v_percentual := case when coalesce(v_orcamento, 0) > 0
    then round((v_total / v_orcamento) * 100, 2) else 0 end;

  update public.medicoes
     set valor_total = v_total,
         percentual_total = v_percentual,
         updated_at = now()
   where id = p_medicao_id;
end;
$$;

create or replace function public.recalcular_apos_item_medicao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.recalcular_medicao_financeira(coalesce(new.medicao_id, old.medicao_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists medicoes_itens_recalcular_financeiro on public.medicoes_itens;
create trigger medicoes_itens_recalcular_financeiro
after insert or update or delete on public.medicoes_itens
for each row execute function public.recalcular_apos_item_medicao();

create or replace function public.gerar_conta_receber_medicao()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_cliente_id uuid;
begin
  if new.status in ('aprovada', 'faturada') and new.valor_total > 0 then
    select cliente_id into v_cliente_id from public.obras where id = new.obra_id;
    insert into public.contas_receber (
      medicao_id, cliente_id, obra_id, descricao, valor_total,
      data_vencimento, status, origem, created_by
    ) values (
      new.id, v_cliente_id, new.obra_id,
      'Medição ' || coalesce(new.numero, new.id::text),
      new.valor_total, new.periodo_fim, 'aberta', 'medicao', new.created_by
    )
    on conflict (medicao_id) where medicao_id is not null do update
      set valor_total = excluded.valor_total,
          data_vencimento = excluded.data_vencimento,
          descricao = excluded.descricao,
          obra_id = excluded.obra_id,
          cliente_id = excluded.cliente_id
      where public.contas_receber.status = 'aberta';
  elsif new.status = 'cancelada' then
    update public.contas_receber
       set status = 'cancelada'
     where medicao_id = new.id and status = 'aberta';
  end if;
  return new;
end;
$$;

drop trigger if exists medicoes_gerar_recebimento on public.medicoes;
create trigger medicoes_gerar_recebimento
after insert or update of status, valor_total, periodo_fim on public.medicoes
for each row execute function public.gerar_conta_receber_medicao();

create or replace function public.atualizar_progresso_obra()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.obras o
     set valor_executado = coalesce((select sum(valor_total) from public.medicoes m where m.obra_id = o.id and m.status <> 'cancelada'), 0),
         progresso = least(100, coalesce((select sum(percentual_total) from public.medicoes m where m.obra_id = o.id and m.status <> 'cancelada'), 0))
   where o.id = coalesce(new.obra_id, old.obra_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists medicoes_atualizar_progresso_obra on public.medicoes;
create trigger medicoes_atualizar_progresso_obra
after insert or update of percentual_total, valor_total, status or delete on public.medicoes
for each row execute function public.atualizar_progresso_obra();
