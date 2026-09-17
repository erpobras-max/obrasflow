-- Catálogo inicial inspirado no orçamento de acabamento de referência.
-- Valores ficam como referência zero para que cada obra receba sua própria composição.

do $$
declare etapa uuid; item uuid;
begin
  -- 1. Instalações Elétricas
  insert into public.propostas_catalogo_etapas (nome, descricao, ordem) values ('Instalações Elétricas','Alimentação, distribuição e acabamento elétrico',1) returning id into etapa;
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'1.1','Alimentação',1) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values
    (item,'1.1.1','Padrão bifásico 63 A subterrâneo','vb',0,1),
    (item,'1.1.2','Alimentação do padrão até o quadro de distribuição','vb',0,2);
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'1.2','Distribuição',2) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values
    (item,'1.2.1','Fechamento de quadro de distribuição','vb',0,1),
    (item,'1.2.2','Montagem de quadro, circuitos e pontos - material e mão de obra','vb',0,2);

  -- 2. Gesso
  insert into public.propostas_catalogo_etapas (nome, descricao, ordem) values ('Gesso','Emassamento, forro e elementos decorativos',2) returning id into etapa;
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'2.1','Emassamento em gesso reguado',1) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values (item,'2.1.1','Aplicação manual de gesso sarrafeado em paredes','m²',0,1);
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'2.2','Rebaixamentos',2) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values (item,'2.2.1','Forro em placas de gesso para ambiente residencial','m²',0,1),(item,'2.2.2','Tabica metálica para forro de gesso','m',0,2),(item,'2.2.3','Sanca ou cimalha em gesso','m',0,3);

  -- 3. Revestimentos e pisos
  insert into public.propostas_catalogo_etapas (nome, descricao, ordem) values ('Revestimentos','Revestimentos cerâmicos e porcelanatos',3) returning id into etapa;
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'3.1','Revestimento de paredes e banheiros',1) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values (item,'3.1.1','Porcelanato para parede e piso de banheiro','m²',0,1),(item,'3.1.2','Revestimento decorativo para fachada ou ducha externa','m²',0,2);
  insert into public.propostas_catalogo_itens (etapa_id,codigo,descricao,ordem) values (etapa,'3.2','Pisos',2) returning id into item;
  insert into public.propostas_catalogo_subitens (item_id,codigo,descricao,unidade,valor_unitario,ordem) values (item,'3.2.1','Regularização de contrapiso','m²',0,1),(item,'3.2.2','Assentamento de porcelanato e rejuntamento','m²',0,2);

  -- 4 a 10. Etapas de acabamento recorrentes
  insert into public.propostas_catalogo_etapas (nome,descricao,ordem) values
    ('Pedras','Bancadas, soleiras e peitoris',4),
    ('Pintura','Emassamento, selamento e pintura interna/externa',5),
    ('Metais e louças','Kits de banheiro, cozinha e acessórios',6),
    ('Esquadrias','Portas, janelas, portões, boxes e guarda-corpos',7),
    ('Área externa e gourmet','Estrutura, cobertura, instalações e acabamento',8),
    ('Limpeza pós-obra','Limpeza final profissional',9);
end $$;
