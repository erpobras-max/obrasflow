-- Aprovação de proposta -> obra e controle sequencial de medições por obra.

alter table public.obras
  add column if not exists proposta_id uuid references public.propostas(id) on delete set null;

create unique index if not exists obras_proposta_id_unique
  on public.obras(proposta_id) where proposta_id is not null;

alter table public.medicoes
  add column if not exists percentual_anterior numeric(5,2) not null default 0,
  add column if not exists percentual_disponivel numeric(5,2) not null default 100;

create unique index if not exists medicoes_obra_numero_unique
  on public.medicoes(obra_id, numero) where numero is not null;

create or replace function public.criar_obra_da_proposta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'aceita' and (tg_op = 'INSERT' or old.status is distinct from 'aceita') then
    insert into public.obras (
      proposta_id, numero, nome, descricao, cliente_id,
      status, orcamento, progresso, valor_executado, observacoes, created_by
    )
    select new.id, '', new.titulo, new.descricao, new.cliente_id,
      'planejamento', coalesce(new.valor_total, 0), 0, 0, new.observacoes, new.created_by
    where not exists (
      select 1 from public.obras o where o.proposta_id = new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists propostas_criar_obra_aceita on public.propostas;
create trigger propostas_criar_obra_aceita
after insert or update of status on public.propostas
for each row execute function public.criar_obra_da_proposta();

create or replace function public.criar_medicao_da_obra(p_obra_id uuid)
returns public.medicoes
language plpgsql
set search_path = public
as $$
declare
  v_obra public.obras;
  v_anterior numeric(5,2);
  v_sequencia integer;
  v_numero text;
  v_medicao public.medicoes;
begin
  -- Serializa a criação por obra para impedir números repetidos.
  select * into v_obra from public.obras where id = p_obra_id for update;
  if not found then raise exception 'Obra não encontrada'; end if;

  select coalesce(sum(percentual_total), 0), count(*) + 1
    into v_anterior, v_sequencia
    from public.medicoes
   where obra_id = p_obra_id and status <> 'cancelada';

  if v_anterior >= 100 then
    raise exception 'Esta obra já atingiu 100%% de conclusão';
  end if;

  v_numero := 'OBR_' ||
    trim(both '_' from regexp_replace(upper(v_obra.nome), '[^A-Z0-9]+', '_', 'g')) ||
    '_' || lpad(v_sequencia::text, 4, '0');

  insert into public.medicoes (
    obra_id, numero, periodo_inicio, periodo_fim, status,
    percentual_total, percentual_anterior, percentual_disponivel,
    valor_total, observacoes, created_by
  ) values (
    p_obra_id, v_numero, current_date, current_date, 'rascunho',
    0, v_anterior, greatest(0, 100 - v_anterior),
    0, 'Medição criada com saldo disponível de ' || greatest(0, 100 - v_anterior) || '%.', auth.uid()
  ) returning * into v_medicao;

  return v_medicao;
end;
$$;

-- Impede que a soma das medições ativas ultrapasse 100%.
create or replace function public.validar_percentual_medicao()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_total numeric(6,2);
begin
  select coalesce(sum(percentual_total), 0) into v_total
  from public.medicoes
  where obra_id = new.obra_id
    and id is distinct from new.id
    and status <> 'cancelada';

  if v_total + coalesce(new.percentual_total, 0) > 100 then
    raise exception 'Percentual informado ultrapassa o saldo disponível de %%%', greatest(0, 100 - v_total);
  end if;
  new.percentual_anterior := v_total;
  new.percentual_disponivel := greatest(0, 100 - v_total);
  return new;
end;
$$;

drop trigger if exists medicoes_validar_percentual on public.medicoes;
create trigger medicoes_validar_percentual
before insert or update of percentual_total, status, obra_id on public.medicoes
for each row execute function public.validar_percentual_medicao();
