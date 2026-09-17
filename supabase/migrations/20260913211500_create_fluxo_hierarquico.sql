-- Estrutura contratada da proposta na obra/medição e correções financeiras.
alter table public.propostas_itens
 add column if not exists etapa_codigo text,
 add column if not exists etapa_nome text,
 add column if not exists item_codigo text,
 add column if not exists item_nome text,
 add column if not exists subitem_codigo text,
 add column if not exists unidade text not null default 'un';
alter table public.medicoes_itens
 add column if not exists proposta_item_id uuid references public.propostas_itens(id) on delete set null,
 add column if not exists etapa_codigo text,
 add column if not exists etapa_nome text,
 add column if not exists item_codigo text,
 add column if not exists item_nome text,
 add column if not exists subitem_codigo text,
 add column if not exists percentual_executado numeric(7,4) not null default 0 check(percentual_executado between 0 and 100);
-- Recupera a hierarquia de propostas existentes criadas pelo catálogo antigo.
update public.propostas_itens pi
set etapa_codigo=coalesce(pi.etapa_codigo,ce.ordem::text), etapa_nome=coalesce(pi.etapa_nome,ce.nome),
    item_codigo=coalesce(pi.item_codigo,ci.codigo), item_nome=coalesce(pi.item_nome,ci.descricao),
    subitem_codigo=coalesce(pi.subitem_codigo,cs.codigo), unidade=coalesce(nullif(pi.unidade,''),cs.unidade)
from public.propostas_catalogo_subitens cs
join public.propostas_catalogo_itens ci on ci.id=cs.item_id
join public.propostas_catalogo_etapas ce on ce.id=ci.etapa_id
where pi.etapa_nome is null and (pi.descricao=cs.descricao or pi.descricao=cs.codigo||' - '||cs.descricao);

create index if not exists medicoes_itens_estrutura_idx on public.medicoes_itens(medicao_id,etapa_codigo,item_codigo,subitem_codigo);

create or replace function public.criar_medicao_da_obra(p_obra_id uuid)
returns public.medicoes language plpgsql security definer set search_path=public as $$
declare v_obra public.obras; v_anterior numeric(7,4); v_seq integer; v_med public.medicoes;
begin
 select * into v_obra from public.obras where id=p_obra_id for update;
 if not found then raise exception 'Obra não encontrada'; end if;
 select coalesce(sum(percentual_total),0),count(*)+1 into v_anterior,v_seq from public.medicoes where obra_id=p_obra_id and status<>'cancelada';
 if v_anterior>=100 then raise exception 'Esta obra já atingiu 100%% de conclusão'; end if;
 insert into public.medicoes(obra_id,numero,periodo_inicio,periodo_fim,status,percentual_total,percentual_anterior,percentual_disponivel,valor_total,observacoes,created_by)
 values(p_obra_id,'OBR_'||trim(both '_' from regexp_replace(upper(v_obra.nome),'[^A-Z0-9]+','_','g'))||'_'||lpad(v_seq::text,4,'0'),current_date,current_date,'rascunho',0,v_anterior,greatest(0,100-v_anterior),0,'Informe o percentual executado de cada serviço contratado.',auth.uid())
 returning * into v_med;
 insert into public.medicoes_itens(medicao_id,proposta_item_id,descricao,unidade,qtd_contratada,qtd_executada,valor_unitario,valor_total,etapa_codigo,etapa_nome,item_codigo,item_nome,subitem_codigo,percentual_executado,referencia_id,fonte_referencia,tipo_referencia,codigo_referencia,referencia_uf,referencia_mes)
 select v_med.id,pi.id,pi.descricao,coalesce(nullif(pi.unidade,''),'un'),pi.quantidade,0,pi.valor_unitario,0,pi.etapa_codigo,pi.etapa_nome,pi.item_codigo,pi.item_nome,pi.subitem_codigo,0,pi.referencia_id,pi.fonte_referencia,pi.tipo_referencia,pi.codigo_referencia,pi.referencia_uf,pi.referencia_mes
 from public.propostas_itens pi where pi.proposta_id=v_obra.proposta_id order by pi.ordem;
 return v_med;
end $$;
grant execute on function public.criar_medicao_da_obra(uuid) to authenticated;

create or replace function public.calcular_item_medicao_por_percentual()
returns trigger language plpgsql set search_path=public as $$
declare v_usado numeric(7,4);
begin
 if new.proposta_item_id is not null then
  select coalesce(sum(mi.percentual_executado),0) into v_usado
  from public.medicoes_itens mi join public.medicoes m on m.id=mi.medicao_id
  where mi.proposta_item_id=new.proposta_item_id and mi.id is distinct from new.id and m.status<>'cancelada';
  if v_usado+coalesce(new.percentual_executado,0)>100 then raise exception 'Avanço acumulado ultrapassa 100%%. Saldo: %%%',greatest(0,100-v_usado); end if;
  new.qtd_executada:=round(new.qtd_contratada*new.percentual_executado/100,4);
 end if;
 new.valor_total:=round(new.qtd_executada*new.valor_unitario,2);
 return new;
end $$;
drop trigger if exists medicoes_itens_calcular_percentual on public.medicoes_itens;
create trigger medicoes_itens_calcular_percentual before insert or update of percentual_executado,qtd_executada,qtd_contratada,valor_unitario on public.medicoes_itens for each row execute function public.calcular_item_medicao_por_percentual();

create or replace function public.gerar_conta_receber_medicao()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_cliente uuid;
begin
 if new.status in('aprovada','faturada') and new.valor_total>0 then
  select cliente_id into v_cliente from public.obras where id=new.obra_id;
  insert into public.contas_receber(medicao_id,cliente_id,obra_id,descricao,valor_total,data_vencimento,status)
  values(new.id,v_cliente,new.obra_id,'Medição '||coalesce(new.numero,new.id::text),round(new.valor_total*100)::bigint,new.periodo_fim,'aberta')
  on conflict(medicao_id) where medicao_id is not null do update set valor_total=excluded.valor_total,data_vencimento=excluded.data_vencimento,descricao=excluded.descricao,obra_id=excluded.obra_id,cliente_id=excluded.cliente_id where public.contas_receber.status='aberta';
 elsif new.status='cancelada' then update public.contas_receber set status='cancelada' where medicao_id=new.id and status='aberta'; end if;
 return new;
end $$;

create or replace function public.escopo_obra(p_obra_id uuid)
returns table(proposta_item_id uuid,etapa_codigo text,etapa_nome text,item_codigo text,item_nome text,subitem_codigo text,descricao text,unidade text,quantidade numeric,valor_unitario numeric,percentual_executado numeric,percentual_saldo numeric)
language sql stable security definer set search_path=public as $$
 select pi.id,pi.etapa_codigo,pi.etapa_nome,pi.item_codigo,pi.item_nome,pi.subitem_codigo,pi.descricao,pi.unidade,pi.quantidade,pi.valor_unitario,
 least(100,coalesce(sum(mi.percentual_executado) filter(where m.status<>'cancelada'),0))::numeric,
 greatest(0,100-coalesce(sum(mi.percentual_executado) filter(where m.status<>'cancelada'),0))::numeric
 from public.obras o join public.propostas_itens pi on pi.proposta_id=o.proposta_id
 left join public.medicoes_itens mi on mi.proposta_item_id=pi.id left join public.medicoes m on m.id=mi.medicao_id
 where o.id=p_obra_id group by pi.id,pi.etapa_codigo,pi.etapa_nome,pi.item_codigo,pi.item_nome,pi.subitem_codigo,pi.descricao,pi.unidade,pi.quantidade,pi.valor_unitario,pi.ordem order by pi.ordem
$$;
grant execute on function public.escopo_obra(uuid) to authenticated;