-- Catálogo base de execução de obras. Não remove nem altera itens já cadastrados.
with etapas(ordem,nome) as (values
(1,'Planejamento, Projetos e Licenciamento'),(2,'Serviços Preliminares e Canteiro de Obras'),(3,'Infraestrutura (Fundações)'),(4,'Supraestrutura'),(5,'Submuramento e Alvenaria (Vedações)'),(6,'Cobertura e Impermeabilização'),(7,'Instalações Prediais'),(8,'Revestimentos e Acabamentos Brutos'),(9,'Revestimentos Finos e Pisos'),(10,'Esquadrias, Louças e Metais'),(11,'Pintura e Acabamentos Finais'),(12,'Limpeza, Testes e Entrega'))
insert into public.propostas_catalogo_etapas(nome,ordem,ativo)
select e.nome,e.ordem,true from etapas e
where not exists (select 1 from public.propostas_catalogo_etapas x where lower(x.nome)=lower(e.nome));

with base as (select id,nome from public.propostas_catalogo_etapas), itens(etapa,descricao) as (values
('Planejamento, Projetos e Licenciamento','Serviços técnicos e legalização'),('Serviços Preliminares e Canteiro de Obras','Implantação e preparação'),('Infraestrutura (Fundações)','Fundações'),('Supraestrutura','Estrutura portante'),('Submuramento e Alvenaria (Vedações)','Vedações'),('Cobertura e Impermeabilização','Cobertura e proteção'),('Instalações Prediais','Instalações embutidas'),('Revestimentos e Acabamentos Brutos','Acabamentos brutos'),('Revestimentos Finos e Pisos','Pisos e revestimentos'),('Esquadrias, Louças e Metais','Instalações finais'),('Pintura e Acabamentos Finais','Finalização'),('Limpeza, Testes e Entrega','Entrega da obra'))
insert into public.propostas_catalogo_itens(etapa_id,codigo,descricao,ordem,ativo)
select b.id, 'CAT-' || row_number() over(order by b.nome)::text, i.descricao,0,true from itens i join base b on b.nome=i.etapa
where not exists(select 1 from public.propostas_catalogo_itens x where x.etapa_id=b.id and x.descricao=i.descricao);

with dados(etapa,descricao,ordem) as (values
('Planejamento, Projetos e Licenciamento','Estudos preliminares, sondagem e topografia',1),('Planejamento, Projetos e Licenciamento','Projetos executivos e licenciamento',2),('Planejamento, Projetos e Licenciamento','Orçamento e cronograma físico-financeiro',3),
('Serviços Preliminares e Canteiro de Obras','Canteiro, tapume e ligações provisórias',1),('Serviços Preliminares e Canteiro de Obras','Limpeza, terraplenagem e compactação',2),('Serviços Preliminares e Canteiro de Obras','Gabarito de locação',3),
('Infraestrutura (Fundações)','Escavação de valas, estacas ou tubulões',1),('Infraestrutura (Fundações)','Armação, formas e concretagem',2),('Infraestrutura (Fundações)','Impermeabilização da infraestrutura',3),
('Supraestrutura','Formas, armações e concretagem de pilares, vigas e lajes',1),('Supraestrutura','Estrutura metálica, wood frame ou alvenaria estrutural',2),('Supraestrutura','Desforma e cura do concreto',3),
('Submuramento e Alvenaria (Vedações)','Elevação de paredes',1),('Submuramento e Alvenaria (Vedações)','Vergas e contravergas',2),('Submuramento e Alvenaria (Vedações)','Encunhamento',3),
('Cobertura e Impermeabilização','Estrutura do telhado e telhamento',1),('Cobertura e Impermeabilização','Rufos e calhas',2),('Cobertura e Impermeabilização','Impermeabilização de áreas molhadas e expostas',3),
('Instalações Prediais','Instalações hidráulicas, sanitárias e testes',1),('Instalações Prediais','Instalações elétricas, lógicas e quadros',2),('Instalações Prediais','AVAC, gás, incêndio e SPDA',3),
('Revestimentos e Acabamentos Brutos','Chapisco, emboço, reboco ou drywall',1),('Revestimentos e Acabamentos Brutos','Contrapiso e regularização',2),('Revestimentos e Acabamentos Brutos','Gesso e forro',3),
('Revestimentos Finos e Pisos','Cerâmicos, porcelanatos e rejuntamento',1),('Revestimentos Finos e Pisos','Soleiras, bancadas, pedras e nichos',2),
('Esquadrias, Louças e Metais','Janelas, portas e vidros',1),('Esquadrias, Louças e Metais','Louças e metais sanitários',2),('Esquadrias, Louças e Metais','Tomadas, interruptores e luminárias',3),
('Pintura e Acabamentos Finais','Preparo de superfícies',1),('Pintura e Acabamentos Finais','Pintura interna e externa',2),('Pintura e Acabamentos Finais','Marcenaria e serralheria finais',3),
('Limpeza, Testes e Entrega','Limpeza pós-obra e comissionamento',1),('Limpeza, Testes e Entrega','Inspeção de qualidade e documentação final',2),('Limpeza, Testes e Entrega','Entrega das chaves',3))
insert into public.propostas_catalogo_subitens(item_id,codigo,descricao,unidade,valor_unitario,ordem,ativo)
select i.id, i.codigo||'.'||d.ordem, d.descricao,'un',0,d.ordem,true from dados d join public.propostas_catalogo_etapas e on e.nome=d.etapa join public.propostas_catalogo_itens i on i.etapa_id=e.id
where i.descricao in ('Serviços técnicos e legalização','Implantação e preparação','Fundações','Estrutura portante','Vedações','Cobertura e proteção','Instalações embutidas','Acabamentos brutos','Pisos e revestimentos','Instalações finais','Finalização','Entrega da obra')
and not exists(select 1 from public.propostas_catalogo_subitens s where s.item_id=i.id and s.descricao=d.descricao);