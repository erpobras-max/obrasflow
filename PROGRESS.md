# Relatório do estado atual do ObrasFlow ERP

Data da auditoria: 28/09/2026

Este relatório foi produzido a partir do código presente em src, das migrations locais e da consulta ao histórico remoto de migrations do projeto Supabase. Quando uma migration existe localmente, mas não aparece no histórico remoto, ela foi marcada como não registrada remotamente; isso não substitui uma validação por checksum ou uma nova consulta ao banco.

## 1. Rotas e páginas

O projeto usa roteamento baseado em arquivos com TanStack Start. A pasta src/pages não existe; as páginas estão em src/routes.

Status usados: completo significa que há fluxo funcional; parcial significa que existe, mas ainda há lógica, integração, validação ou acabamento pendente; redirecionamento significa uma rota técnica que apenas encaminha o usuário.

| Rota | Componente | Status |
| --- | --- | --- |
| / | redirecionamento para /auth | redirecionamento |
| /auth | AuthPage | parcial: login da equipe e acesso por documento existem; confirmação de SMS ainda está vazia |
| /forgot-password | ForgotPassword | completo |
| /reset-password | ResetPassword | completo |
| /imovel-publico/$token | ImovelPublicoPage | completo: página pública depende de URLs de fotos válidas |
| /ponto | PontoPage | completo |
| /assinar/$token | AssinaturaPublicaPage | parcial: assinatura manuscrita e link existem; auditoria jurídica avançada ainda não |
| /portal | PortalLayout | parcial: portal civil existe; não há ainda portal específico completo para locatário da imobiliária |
| /portal/ | PortalIndex | parcial: acompanha obras e cronograma civil |
| /portal/contratos | PortalContratos | completo para contratos civis |
| /portal/documentos | PortalDocumentos | completo |
| /portal/financeiro | PortalFinanceiro | parcial: consulta financeira existe, mas pagamento integrado não |
| /portal/fotos | PortalFotos | completo |
| /_app | AppLayout | completo |
| /_app/dashboard | DashboardPage | parcial: há dados e visões, mas existem incompatibilidades de TypeScript e dependências de tabelas/views |
| /_app/obras | ObrasPage | completo |
| /_app/diario | DiarioPage | completo |
| /_app/medicoes | MedicoesPage | parcial: fluxo de medições existe, mas o formulário ainda tem incompatibilidades de schema/resolver |
| /_app/cronograma | CronogramaPage | parcial: cronograma e importação de etapas da proposta existem; integração completa do acompanhamento ainda precisa de validação |
| /_app/documentos | DocumentosPage | completo |
| /_app/empresa | EmpresaConfigPage | parcial: cadastro existe; upload/preview da logo ainda tem erro de URL/tipagem |
| /_app/equipamentos | EquipamentosPage | completo |
| /_app/estoque | EstoquePage | completo |
| /_app/financeiro | FinanceiroCivilPage | parcial: existe separação de origem, mas faltam correções de tabelas ausentes, permissões e tipagem |
| /_app/fiscal | FiscalPage | parcial: tela de notas e simulação existem; integração fiscal real não |
| /_app/compras | ComprasPage | completo |
| /_app/orcamentos | OrcamentosPage | completo |
| /_app/relatorios | RelatoriosPage | completo |
| /_app/rh | RhPage | parcial: funcionalidades existem; há erro de compilação relacionado a FileClock |
| /_app/usuarios | UsuariosPage | completo |
| /_app/perfil | PerfilPage | completo |
| /_app/vendas/pedidos | PedidosVendaPage | completo |
| /_app/comercial | ComercialLayout | completo |
| /_app/comercial/clientes | ClientesPage | completo |
| /_app/comercial/propostas | PropostasPage | parcial: fluxo existe; há caso sem etapaAtual tratado no TypeScript |
| /_app/comercial/contratos | ContratosPage | parcial: contratos existem; impressão atual é HTML do navegador, sem PDF binário server-side |
| /_app/comercial/licitacoes | LicitacoesPage | parcial: rota e gravação de oportunidades existem; o conceito de oportunidade ainda está presente apesar da decisão de removê-lo |
| /_app/imobiliaria | ImobiliariaLayout | completo |
| /_app/imobiliaria/dashboard | ImobiliariaDashboardPage | completo |
| /_app/imobiliaria/clientes | ImobClientesPage | completo |
| /_app/imobiliaria/imoveis | ImoveisPage | completo |
| /_app/imobiliaria/locacoes | LocacoesPage | parcial: locação, vistoria e contas existem; portal específico e cobrança ainda não |
| /_app/imobiliaria/fiadores | ImobFiadoresPage | completo |
| /_app/imobiliaria/financeiro | FinanceiroImobiliarioPage | parcial: separação de origem existe; pagamentos e integrações externas ainda não |
| /_app/importacoes | ImportacoesPage | parcial: importação e registro de erros existem; integrações adicionais ainda são limitadas |

## 2. Tabelas do Supabase realmente usadas por página

As tabelas abaixo foram identificadas nas chamadas reais ao cliente Supabase em cada arquivo. Lê contém SELECT; escreve contém INSERT, UPDATE e DELETE, agrupados quando aplicável.

| Página | Lê | Escreve |
| --- | --- | --- |
| auth | perfis_usuarios, user_roles | nenhuma |
| ponto | funcionarios, registros_ponto, solicitacoes_ajuste_ponto | registros_ponto, solicitacoes_ajuste_ponto |
| portal layout | obras | nenhuma |
| portal index | diarios_obra, obras, obra_cronograma | nenhuma |
| portal contratos | contratos, assinaturas_contrato quando consultadas pelo fluxo | nenhuma |
| portal documentos | documentos | nenhuma |
| portal financeiro | contas_receber, imobiliaria_clientes | nenhuma |
| portal fotos | diarios_obra_fotos | nenhuma |
| dashboard | contas_pagar, contas_receber, estoque_obra, obras, vw_dashboard_financeiro, vw_dashboard_operacional | nenhuma |
| obras | clientes, contratos, obras | obras |
| diario | diarios_obra, diarios_obra_fotos, obras | diarios_obra, diarios_obra_fotos |
| medicoes | contratos, medicoes, medicoes_itens, obras | medicoes, medicoes_itens |
| cronograma | obra_cronograma, obras | obra_cronograma |
| documentos | documentos, obras | documentos |
| empresa | configuracoes_empresa | configuracoes_empresa |
| equipamentos | equipamentos, equipamentos_alocacoes, equipamentos_custos, equipamentos_manutencoes, obras | equipamentos, equipamentos_alocacoes, equipamentos_custos, equipamentos_manutencoes |
| estoque | depositos, movimentacoes_estoque, produto_estoque, produtos | depositos, produtos |
| financeiro civil | categorias_financeiras, clientes, contas_bancarias, contas_pagar, contas_receber, fornecedores, imobiliaria_clientes, obras, pedidos_compra | categorias_financeiras, contas_bancarias, contas_pagar, contas_receber |
| fiscal | contas_receber, medicoes, notas_fiscais, obras | contas_receber, notas_fiscais |
| compras | contas_pagar, depositos, fornecedores, obras, pedido_itens, pedidos_compra, produtos, solicitacao_itens, solicitacoes_compra | contas_pagar, fornecedores, pedido_itens, pedidos_compra, produtos, solicitacao_itens, solicitacoes_compra |
| orcamentos | obras, orcamento_itens, orcamentos, referencia_composicoes, referencia_insumos | obras, orcamento_itens, orcamentos |
| relatorios | clientes, contas_pagar, contas_receber, estoque_obra, fornecedores, obras, pedidos_compra | nenhuma |
| RH | afastamentos, configuracoes_empresa, documentos_rh, eventos_folha, ferias, funcionarios, obras, registros_ponto, solicitacoes_ajuste_ponto | afastamentos, eventos_folha, ferias, funcionarios, registros_ponto |
| usuarios | funcionarios, perfis_usuarios, user_roles | nenhuma nesta página |
| perfil | perfis_usuarios | perfis_usuarios |
| vendas | clientes, depositos, pedidos_venda, pedidos_venda_itens, produtos | pedidos_venda, pedidos_venda_itens |
| comercial clientes | clientes, perfis_usuarios | clientes |
| comercial propostas | clientes, propostas, propostas_catalogo_etapas, propostas_itens | propostas, propostas_itens |
| comercial contratos | clientes, contratos, propostas | contratos |
| comercial licitações | oportunidades | oportunidades |
| imobiliária dashboard | contas_pagar, contas_receber, imob_indices_reajuste, imoveis, locacoes | imob_indices_reajuste |
| imobiliária clientes | imobiliaria_clientes | imobiliaria_clientes |
| imobiliária imóveis | imobiliaria_clientes, imoveis, imovel_fotos, imovel_links_publicos | imoveis, imovel_fotos, imovel_links_publicos |
| imobiliária locações | contas_pagar, contas_receber, imob_fiadores, imob_vistorias, imob_vistorias_itens, imobiliaria_clientes, imoveis, locacoes | contas_pagar, contas_receber, imob_vistorias, imob_vistorias_itens, imoveis, locacoes |
| imobiliária fiadores | imob_fiadores, imobiliaria_clientes | imob_fiadores |
| imobiliária financeiro | a mesma origem financeira consultada pela tela imobiliária, incluindo contas_pagar e contas_receber | conforme o fluxo financeiro imobiliário |
| importações | importacoes_erros, importacoes_log | importacoes_erros, importacoes_log |

Pontos de atenção encontrados:

- A tela financeira civil também consulta imobiliaria_clientes, o que merece revisão para manter a separação de origem.
- A página imobiliária de imóveis usa imovel_fotos e imovel_links_publicos; a imagem quebrada observada anteriormente é compatível com URL montada com prefixo undefined.
- A tela de cronograma usa obra_cronograma e depende de RLS/grants corretos.
- Alguns arquivos usam views, como vw_dashboard_financeiro e vw_dashboard_operacional, portanto o contrato de dados da página depende dessas views existirem no banco remoto.
- pedidos_compra e estoque_obra apresentaram divergências de schema/permissão em erros anteriores; a página precisa de uma validação contra o schema remoto atual.

## 3. Migrations aplicadas

A lista abaixo está em ordem de nome local. [R] significa que apareceu no histórico remoto de migrations consultado. [M] significa executada manualmente no SQL Editor, mas não registrada automaticamente no histórico. [?] significa que o arquivo existe localmente, mas não apareceu no histórico remoto consultado.

1. [?] 20260604142024_create_perfis_usuarios.sql — perfis de usuários e RLS.
2. [R] 20260604142042_create_app_role_enum.sql — enum de papéis.
3. [?] 20260604142648_update_perfis_usuarios_ativo.sql — usuário ativo, índices e políticas.
4. [?] 20260604155137_create_obras_schema.sql — obras, clientes e equipe.
5. [?] 20260604155203_create_diario_obra.sql — diário de obra.
6. [?] 20260604155219_create_medicoes_schema.sql — medições.
7. [?] 20260605000007_add_cpf_cnpj_login.sql — CPF/CNPJ no acesso.
8. [?] 20260605000533_create_modulo_estoque.sql — estoque base.
9. [?] 20260605001301_create_modulo_financeiro.sql — contas financeiras.
10. [?] 20260605001319_create_dashboard_executivo.sql — dashboard executivo.
11. [?] 20260605001351_create_cronograma_obra.sql — cronograma de obra.
12. [?] 20260605120800_client_cpf_cnpj_login.sql — vínculo do cliente ao acesso.
13. [?] 20260605132500_modulo_estoque.sql — ajustes do estoque.
14. [?] 20260605132800_modulo_financeiro.sql — ajustes financeiros.
15. [?] 20260605133500_dashboard_executivo.sql — ajustes das views do dashboard.
16. [?] 20260607155000_fix_has_role_permissions.sql — correção de função e grants.
17. [?] 20260607163000_modulo_equipamentos.sql — equipamentos e RLS.
18. [?] 20260607212200_modulo_compras.sql — compras e RLS.
19. [?] 20260607212700_modulo_fiscal.sql — notas fiscais, storage e RLS.
20. [?] 20260607215600_modulo_orcamentos.sql — orçamentos e referências.
21. [?] 20260607220700_alter_contas_receber_nullable.sql — vínculos opcionais em contas a receber.
22. [?] 20260607221300_fix_documentos_columns.sql — colunas de documentos e versões.
23. [?] 20260608000000_almoxarifado_central.sql — almoxarifado central.
24. [?] 20260608100000_modulo_rh.sql — RH, folha e ponto.
25. [?] 20260608110800_add_uploaded_by_to_documentos.sql — metadados de upload.
26. [?] 20260608114000_add_comprovante_nota_financial.sql — comprovantes e notas financeiras.
27. [?] 20260701154000_create_imobiliaria_schema.sql — imóveis, clientes e locações.
28. [?] 20260701163000_create_vistorias.sql — vistorias.
29. [?] 20260717090000_create_produtos_estoque.sql — produtos e estoque.
30. [?] 20260717091000_create_vendas_compras.sql — vendas e compras.
31. [?] 20260717092000_financeiro_estendido.sql — contas bancárias e categorias.
32. [?] 20260717093000_create_importacoes.sql — logs de importação.
33. [?] 20260717105419_create_catalogo_propostas.sql — catálogo de propostas.
34. [?] 20260717105542_fix_imobiliaria_tables.sql — correções das tabelas imobiliárias.
35. [?] 20260717105718_fix_imobiliaria_vistorias.sql — correções de vistorias.
36. [?] 20260717105814_add_imobiliaria_indices.sql — índices de reajuste.
37. [?] 20260717110000_create_funcionario_ponto.sql — ponto do funcionário.
38. [?] 20260717120000_create_configuracoes_empresa.sql — configurações da empresa.
39. [?] 20260912190000_create_propostas_hierarquicas.sql — propostas hierárquicas.
40. [?] 20260912210000_create_catalogo_acabamento.sql — catálogo de acabamentos.
41. [?] 20260912220000_create_proposta_obra_medicoes.sql — proposta, obra e medições.
42. [?] 20260912230000_restringir_acesso_propostas.sql — restrição de propostas.
43. [?] 20260912240000_permissoes_propostas.sql — permissões de propostas.
44. [?] 20260912250000_financeiro_por_medicao.sql — contas a receber por medição aprovada.
45. [?] 20260913010000_create_cadastro_empresa.sql — cadastro institucional.
46. [?] 20260913205000_create_referencias_custos.sql — referências SINAPI/SICRO.
47. [?] 20260913211500_create_fluxo_hierarquico.sql — fluxo hierárquico até obra/medição.
48. [?] 20260914193000_create_catalogo_etapas.sql — catálogo de etapas.
49. [?] 20260914200000_fix_rls_configuracoes.sql — correção da RLS de configurações.
50. [R] 20260917000000_imobiliaria_fotos_e_fiadores.sql — fotos de imóveis e fiadores.
51. [R] 20260917000001_imob_vistorias_checklist.sql — itens de checklist de vistoria.
52. [R] 20260917000002_imob_indices_atualizacao.sql — atualização de índices imobiliários.
53. [R] 20260917000003_create_user_roles.sql — múltiplos cargos por usuário.
54. [R] 20260917000004_separar_financeiro_civil_imobiliaria.sql — separação financeira por origem.
55. [R] 20260917000005_cargos_e_financeiro_por_origem.sql — cargos e filtros por origem.
56. [R] 20260917000006_galeria_indices_automaticos.sql — galeria e atualização automática de índices.
57. [R] 20260918000001_contrato_assinaturas.sql — assinaturas manuscritas.
58. [R] 20260918000002_imovel_links_publicos.sql — links públicos de imóveis.
59. [R] 20260918000003_contrato_links_assinatura.sql — links públicos de assinatura.
60. [R] 20260918000004_dashboard_financeiro_civil.sql — dashboard financeiro civil.
61. [R] 20260918000005_portal_cliente_contratos.sql — contratos no portal do cliente.
62. [?] 20260921000000_portal_cliente_financeiro.sql — financeiro no portal do cliente.
63. [?] 20260923000000_add_logo_empresa.sql — logo da empresa.
64. [?] 20260923000000_fix_service_role_cliente_link.sql — correção do vínculo de cliente.
65. [?] 20260924000000_fix_funcionario_self_access.sql — acesso do próprio funcionário.
66. [?] 20260924000001_ponto_completo_funcionario.sql — fluxo completo de ponto.
67. [?] 20260927000000_corrigir_totais_medicoes_cronograma.sql — totais de medições e cronograma.
68. [?] 20260927000001_listar_responsaveis_tecnicos.sql — responsáveis técnicos ativos.
69. [?] 20260927000002_aditivo_receitas.sql — aditivo de receitas.
70. [?] 20260927000003_corrigir_rls_obra_cronograma.sql — RLS do cronograma.
71. [?] 20260927000004_corrigir_financeiro_estoque.sql — permissões de financeiro e estoque.
72. [?] 20260927000005_exibir_contrato_no_link_assinatura.sql — contrato no link de assinatura.
73. [?] 20260927000006_cronograma_automatico_proposta.sql — cronograma criado junto da proposta aceita.
74. [M] 20260928000000_cronograma_etapas_proposta.sql — importa etapas da proposta para o cronograma com datas, percentual e progresso.

Histórico remoto consultado: 14 registros, começando em 20260604142024_create_perfis_usuarios e terminando em 20260918000005_portal_cliente_contratos. A migration 20260928000000 foi executada manualmente no SQL Editor, mas não aparece como registro no histórico consultado. As demais marcações devem ser conferidas antes de usar supabase db push, pois houve no passado conflito de versões, tipos e migrations duplicadas.

## 4. Edge Functions

Não existe a pasta supabase/functions no checkout atual. Portanto:

- Edge Functions locais: nenhuma.
- Resultado de supabase functions list: não foi possível listar funções porque não há diretório local e o CLI exige o projeto estar vinculado; não há evidência local de função deployada.
- Lógica server-side existente: funções do próprio TanStack Start e módulos em src/lib/*.functions.ts, que não são Edge Functions do Supabase.
- Rotinas automáticas de índices, lembretes, cobrança e notificações ainda não estão implementadas como job agendado.

## 5. Autenticação

O login geral usa supabase.auth.signInWithPassword. Depois do login, a aplicação consulta perfis_usuarios e user_roles para definir cargos, módulos permitidos e destino. Os cargos atuais incluem admin, diretor, financeiro_civil, financeiro_imobiliaria, compras, engenharia, almoxarifado, rh, cliente, funcionario e imobiliaria.

O acesso de cliente e funcionário usa CPF/CNPJ ou documento sem pontuação. A tela normaliza os números, chama a rotina server-side de acesso por documento e, quando recebe access_token e refresh_token, chama supabase.auth.setSession. O destino depende do papel: cliente vai para /portal; funcionário vai para /ponto; cargos de gestão vão para /dashboard.

Há tratamento de diagnóstico para informar etapa e referência do erro, mas o fluxo de confirmação SMS está incompleto: confirmSmsCode existe como função vazia. Isso significa que o caminho de código por celular ainda não é uma autenticação operacional completa.

Usuários testáveis conhecidos pela auditoria:

- Admin: existe e já foi usado para login; a conta admin@admin.com apareceu em uma sessão observada.
- Funcionário: existe o registro de teste identificado como FUNCIONARIO TESTE PONTO.
- Cliente civil: existe TESTE AUDITORIA CLIENTE, com CPF/CNPJ cadastrado.
- Corretor: não há cargo separado de corretor no código atual. A operação imobiliária usa principalmente imobiliaria e financeiro_imobiliaria.

O acesso por documento depende de a função server-side estar configurada com as variáveis de Supabase no ambiente de produção. Erros anteriores mostraram a mensagem ACESSO_FALHOU na etapa configurar_servidor quando essas variáveis não estavam disponíveis.

## 6. O que está pendente

- Upload de arquivos R2: há módulos de R2 e referências no frontend, mas faltam tipos Cloudflare completos, validação de URLs e rotina consistente para limpeza de objetos órfãos.
- Geração de PDF de contrato: hoje a impressão usa HTML e o diálogo de impressão do navegador. Falta geração server-side de PDF A4 com paginação estável, cabeçalho, rodapé e arquivo baixável.
- Assinatura digital: assinatura desenhada e links públicos existem. Faltam trilha de auditoria robusta, evidência de identidade, timestamp, hash do documento final e armazenamento do contrato assinado como arquivo imutável.
- Portal do cliente: o portal civil já consulta obras, contratos, documentos, fotos, financeiro e cronograma. Falta um portal imobiliário específico com contratos de locação, parcelas de aluguel, taxas, vencimentos, segunda via, pagamento e renovação.
- Cobrança: não há gateway integrado para PIX, boleto ou cartão; também faltam conciliação automática, webhooks e baixa automática.
- Lembretes automáticos: não há Edge Function ou cron deployado para avisos de vencimento, assinatura, reajuste, vistoria e atraso.
- Índices imobiliários: há integração de serviço e histórico local, mas ainda falta job agendado com retry, registro de última atualização e tratamento de indisponibilidade da API.
- Oportunidades: a rota de licitações ainda usa oportunidades, apesar de a decisão de produto ter sido eliminar esse conceito.
- Qualidade de dados: algumas chamadas antigas usam tabelas/colunas diferentes do schema remoto observado, como categorias_financeiras, contas_bancarias, estoque_obra e pedidos_compra.

## 7. Erros e avisos conhecidos

### npm run build

O comando terminou com código 1 antes de concluir o Vite:

    X [ERROR] Cannot read directory ../..: Acesso negado.
    X [ERROR] Could not resolve C:\Users\rodri\.claude\obrasflow-erp-main\vite.config.ts
    failed to load config from C:\Users\rodri\.claude\obrasflow-erp-main\vite.config.ts

Esse resultado ocorreu no ambiente local auditado e precisa ser repetido em um terminal com permissões de leitura compatíveis. Há histórico de o build no CI do GitHub ter concluído, com aviso de que alguns pacotes exigem Node >=22.12 enquanto o workflow usa Node 20.

### npx tsc --noEmit

O comando terminou com código 1. Erros encontrados:

- src/components/empresa-logo.tsx: loaded possivelmente nulo.
- src/components/referencias/referencia-custos-picker.tsx: callback de sort incompatível com unknown/string.
- src/integrations/supabase/client.server.custom.ts: módulo cloudflare:workers ausente.
- src/lib/indices-reajuste.ts: acesso a value de PromiseSettledResult sem narrowing.
- src/lib/indices-service.ts: calcularNovoAluguel declarado em duplicidade.
- src/lib/observability/browser.ts: number usado onde o tipo exige string.
- src/lib/r2.server.ts: módulo cloudflare:workers ausente.
- src/lib/r2.ts: string incompatível com a união de MIME permitidos.
- src/routes/_app.tsx: nome supabase não encontrado.
- src/routes/_app/comercial.propostas.tsx: etapaAtual pode ser null.
- src/routes/_app/dashboard.tsx: acesso a data em valor que é array.
- src/routes/_app/financeiro.tsx: campos data_recebimento, data_pagamento, valor_recebido, valor_pago e conciliado sem narrowing da união.
- src/routes/_app/medicoes.tsx: incompatibilidades entre resolver, schema e useForm em vários pontos do formulário.
- src/routes/_app/rh.tsx: FileClock não encontrado.

### Erros de runtime já observados

- 401 no Supabase com invalid_token e JWT issued at future, indicando relógio/token de sessão inconsistente.
- 400 em obras com operador neq.finalizada, compatível com coluna ou tipo diferente do schema publicado.
- 400 em estoque_obra por coluna material_id inexistente.
- 400 em estoque_obra com relação material:materiais não encontrada no schema cache.
- 404 em produto_estoque, categorias_financeiras e contas_bancarias quando as tabelas não estavam expostas no projeto remoto.
- 403 em estoque_obra por RLS/permissão.
- Erro React useFormField should be used within FormField.
- URLs de logo montadas com /undefined/outros/... e resposta 404.
- Tela de assinatura acusou public.contrato_assinaturas ausente no schema cache em uma versão anterior.

## 8. Estrutura de pastas

Listagem recursiva auditada, sem node_modules:

    src
    src/components
    src/components/contratos
    src/components/contratos/assinaturas-contrato.tsx
    src/components/contratos/contrato-impressao.tsx
    src/components/cronograma-proprietario.tsx
    src/components/empresa-logo.tsx
    src/components/imobiliaria
    src/components/imobiliaria/public-property-gallery.tsx
    src/components/layout
    src/components/layout/app-header.tsx
    src/components/layout/app-sidebar.tsx
    src/components/layout/documentos-obra.tsx
    src/components/layout/estoque-obra.tsx
    src/components/layout/financeiro-obra.tsx
    src/components/medicoes
    src/components/medicoes/medicao-relatorio.tsx
    src/components/propostas
    src/components/propostas/catalogo-propostas.tsx
    src/components/propostas/proposta-impressao.tsx
    src/components/referencias
    src/components/referencias/referencia-custos-picker.tsx
    src/components/ui
    src/components/ui/accordion.tsx
    src/components/ui/alert-dialog.tsx
    src/components/ui/alert.tsx
    src/components/ui/aspect-ratio.tsx
    src/components/ui/avatar.tsx
    src/components/ui/badge.tsx
    src/components/ui/breadcrumb.tsx
    src/components/ui/button.tsx
    src/components/ui/calendar.tsx
    src/components/ui/card.tsx
    src/components/ui/carousel.tsx
    src/components/ui/chart.tsx
    src/components/ui/checkbox.tsx
    src/components/ui/collapsible.tsx
    src/components/ui/command.tsx
    src/components/ui/context-menu.tsx
    src/components/ui/dialog.tsx
    src/components/ui/drawer.tsx
    src/components/ui/dropdown-menu.tsx
    src/components/ui/form.tsx
    src/components/ui/hover-card.tsx
    src/components/ui/input-otp.tsx
    src/components/ui/input.tsx
    src/components/ui/label.tsx
    src/components/ui/menubar.tsx
    src/components/ui/navigation-menu.tsx
    src/components/ui/pagination.tsx
    src/components/ui/popover.tsx
    src/components/ui/progress.tsx
    src/components/ui/radio-group.tsx
    src/components/ui/resizable.tsx
    src/components/ui/scroll-area.tsx
    src/components/ui/select.tsx
    src/components/ui/separator.tsx
    src/components/ui/sheet.tsx
    src/components/ui/sidebar.tsx
    src/components/ui/skeleton.tsx
    src/components/ui/slider.tsx
    src/components/ui/sonner.tsx
    src/components/ui/switch.tsx
    src/components/ui/table.tsx
    src/components/ui/tabs.tsx
    src/components/ui/textarea.tsx
    src/components/ui/toggle-group.tsx
    src/components/ui/toggle.tsx
    src/components/ui/tooltip.tsx
    src/hooks/use-auth.ts
    src/hooks/use-mobile.tsx
    src/hooks/use-portal-context.ts
    src/integrations/supabase/auth-attacher.custom.ts
    src/integrations/supabase/auth-attacher.ts
    src/integrations/supabase/auth-middleware.custom.ts
    src/integrations/supabase/auth-middleware.ts
    src/integrations/supabase/client.custom.ts
    src/integrations/supabase/client.server.custom.ts
    src/integrations/supabase/client.server.ts
    src/integrations/supabase/client.ts
    src/integrations/supabase/previewAuthStorage.ts
    src/integrations/supabase/retry-clock-skew.ts
    src/integrations/supabase/types.ts
    src/lib
    src/lib/acesso-diagnostico.ts
    src/lib/acesso-documento.functions.ts
    src/lib/api.ts
    src/lib/api/example.functions.ts
    src/lib/bling-import.ts
    src/lib/cep.ts
    src/lib/clientes.schema.ts
    src/lib/cnpj.ts
    src/lib/compras.schema.ts
    src/lib/config.server.ts
    src/lib/cronograma.ts
    src/lib/diario.schema.ts
    src/lib/documento.ts
    src/lib/documentos.schema.ts
    src/lib/empresa-logo.ts
    src/lib/error-capture.ts
    src/lib/error-page.ts
    src/lib/financeiro.schema.ts
    src/lib/imobiliaria.schema.ts
    src/lib/importacoes.functions.ts
    src/lib/impressao.ts
    src/lib/indices-reajuste.ts
    src/lib/indices-service.ts
    src/lib/indices.functions.ts
    src/lib/lovable-error-reporting.ts
    src/lib/medicoes.schema.ts
    src/lib/obras.schema.ts
    src/lib/observability/browser.ts
    src/lib/orcamentos.schema.ts
    src/lib/permissions.ts
    src/lib/propostas-hierarquia.ts
    src/lib/r2.functions.ts
    src/lib/r2.server.ts
    src/lib/r2.ts
    src/lib/role-meta.ts
    src/lib/usuarios.functions.ts
    src/lib/utils.ts
    src/lib/validacao-documento.ts
    src/router.tsx
    src/routes
    src/routes/__root.tsx
    src/routes/_app.tsx
    src/routes/_app
    src/routes/_app/comercial.clientes.tsx
    src/routes/_app/comercial.contratos.tsx
    src/routes/_app/comercial.licitacoes.tsx
    src/routes/_app/comercial.propostas.tsx
    src/routes/_app/comercial.tsx
    src/routes/_app/compras.tsx
    src/routes/_app/cronograma.tsx
    src/routes/_app/dashboard.tsx
    src/routes/_app/diario.tsx
    src/routes/_app/documentos.tsx
    src/routes/_app/empresa.tsx
    src/routes/_app/equipamentos.tsx
    src/routes/_app/estoque.tsx
    src/routes/_app/financeiro.tsx
    src/routes/_app/fiscal.tsx
    src/routes/_app/imobiliaria.clientes.tsx
    src/routes/_app/imobiliaria.dashboard.tsx
    src/routes/_app/imobiliaria.financeiro.tsx
    src/routes/_app/imobiliaria.imoveis.tsx
    src/routes/_app/imobiliaria.locacoes.tsx
    src/routes/_app/imobiliaria.tsx
    src/routes/_app/imobiliaria
    src/routes/_app/imobiliaria/fiadores.tsx
    src/routes/_app/importacoes.tsx
    src/routes/_app/medicoes.tsx
    src/routes/_app/obras.tsx
    src/routes/_app/orcamentos.tsx
    src/routes/_app/perfil.tsx
    src/routes/_app/relatorios.tsx
    src/routes/_app/rh.tsx
    src/routes/_app/usuarios.tsx
    src/routes/_app/vendas.pedidos.tsx
    src/routes/assinar.$token.tsx
    src/routes/auth.tsx
    src/routes/forgot-password.tsx
    src/routes/imovel-publico.$token.tsx
    src/routes/index.tsx
    src/routes/ponto.tsx
    src/routes/portal.tsx
    src/routes/portal
    src/routes/portal/contratos.tsx
    src/routes/portal/documentos.tsx
    src/routes/portal/financeiro.tsx
    src/routes/portal/fotos.tsx
    src/routes/portal/index.tsx
    src/routes/README.md
    src/routes/reset-password.tsx
    src/routeTree.gen.ts
    src/server.ts
    src/start.ts
    src/styles.css
    supabase
    supabase/config.toml
    supabase/migrations
    supabase/migrations/20260604142024_create_perfis_usuarios.sql
    supabase/migrations/20260604142042_create_app_role_enum.sql
    supabase/migrations/20260604142648_update_perfis_usuarios_ativo.sql
    supabase/migrations/20260604155137_create_obras_schema.sql
    supabase/migrations/20260604155203_create_diario_obra.sql
    supabase/migrations/20260604155219_create_medicoes_schema.sql
    supabase/migrations/20260605000007_add_cpf_cnpj_login.sql
    supabase/migrations/20260605000533_create_modulo_estoque.sql
    supabase/migrations/20260605001301_create_modulo_financeiro.sql
    supabase/migrations/20260605001319_create_dashboard_executivo.sql
    supabase/migrations/20260605001351_create_cronograma_obra.sql
    supabase/migrations/20260605120800_client_cpf_cnpj_login.sql
    supabase/migrations/20260605132500_modulo_estoque.sql
    supabase/migrations/20260605132800_modulo_financeiro.sql
    supabase/migrations/20260605133500_dashboard_executivo.sql
    supabase/migrations/20260607155000_fix_has_role_permissions.sql
    supabase/migrations/20260607163000_modulo_equipamentos.sql
    supabase/migrations/20260607212200_modulo_compras.sql
    supabase/migrations/20260607212700_modulo_fiscal.sql
    supabase/migrations/20260607215600_modulo_orcamentos.sql
    supabase/migrations/20260607220700_alter_contas_receber_nullable.sql
    supabase/migrations/20260607221300_fix_documentos_columns.sql
    supabase/migrations/20260608000000_almoxarifado_central.sql
    supabase/migrations/20260608100000_modulo_rh.sql
    supabase/migrations/20260608110800_add_uploaded_by_to_documentos.sql
    supabase/migrations/20260608114000_add_comprovante_nota_financial.sql
    supabase/migrations/20260701154000_create_imobiliaria_schema.sql
    supabase/migrations/20260701163000_create_vistorias.sql
    supabase/migrations/20260717090000_create_produtos_estoque.sql
    supabase/migrations/20260717091000_create_vendas_compras.sql
    supabase/migrations/20260717092000_financeiro_estendido.sql
    supabase/migrations/20260717093000_create_importacoes.sql
    supabase/migrations/20260717105419_create_catalogo_propostas.sql
    supabase/migrations/20260717105542_fix_imobiliaria_tables.sql
    supabase/migrations/20260717105718_fix_imobiliaria_vistorias.sql
    supabase/migrations/20260717105814_add_imobiliaria_indices.sql
    supabase/migrations/20260717110000_create_funcionario_ponto.sql
    supabase/migrations/20260717120000_create_configuracoes_empresa.sql
    supabase/migrations/20260912190000_create_propostas_hierarquicas.sql
    supabase/migrations/20260912210000_create_catalogo_acabamento.sql
    supabase/migrations/20260912220000_create_proposta_obra_medicoes.sql
    supabase/migrations/20260912230000_restringir_acesso_propostas.sql
    supabase/migrations/20260912240000_permissoes_propostas.sql
    supabase/migrations/20260912250000_financeiro_por_medicao.sql
    supabase/migrations/20260913010000_create_cadastro_empresa.sql
    supabase/migrations/20260913205000_create_referencias_custos.sql
    supabase/migrations/20260913211500_create_fluxo_hierarquico.sql
    supabase/migrations/20260914193000_create_catalogo_etapas.sql
    supabase/migrations/20260914200000_fix_rls_configuracoes.sql
    supabase/migrations/20260917000000_imobiliaria_fotos_e_fiadores.sql
    supabase/migrations/20260917000001_imob_vistorias_checklist.sql
    supabase/migrations/20260917000002_imob_indices_atualizacao.sql
    supabase/migrations/20260917000003_create_user_roles.sql
    supabase/migrations/20260917000004_separar_financeiro_civil_imobiliaria.sql
    supabase/migrations/20260917000005_cargos_e_financeiro_por_origem.sql
    supabase/migrations/20260917000006_galeria_indices_automaticos.sql
    supabase/migrations/20260918000001_contrato_assinaturas.sql
    supabase/migrations/20260918000002_imovel_links_publicos.sql
    supabase/migrations/20260918000003_contrato_links_assinatura.sql
    supabase/migrations/20260918000004_dashboard_financeiro_civil.sql
    supabase/migrations/20260918000005_portal_cliente_contratos.sql
    supabase/migrations/20260921000000_portal_cliente_financeiro.sql
    supabase/migrations/20260923000000_add_logo_empresa.sql
    supabase/migrations/20260923000000_fix_service_role_cliente_link.sql
    supabase/migrations/20260924000000_fix_funcionario_self_access.sql
    supabase/migrations/20260924000001_ponto_completo_funcionario.sql
    supabase/migrations/20260927000000_corrigir_totais_medicoes_cronograma.sql
    supabase/migrations/20260927000001_listar_responsaveis_tecnicos.sql
    supabase/migrations/20260927000002_aditivo_receitas.sql
    supabase/migrations/20260927000003_corrigir_rls_obra_cronograma.sql
    supabase/migrations/20260927000004_corrigir_financeiro_estoque.sql
    supabase/migrations/20260927000005_exibir_contrato_no_link_assinatura.sql
    supabase/migrations/20260927000006_cronograma_automatico_proposta.sql
    supabase/migrations/20260928000000_cronograma_etapas_proposta.sql

## Observação final

O sistema já possui uma base ampla para construção civil e imobiliária, com autenticação, cargos múltiplos, propostas, obras, medições, cronograma, contratos, assinatura, imóveis, locações e portal civil. Os maiores riscos atuais são divergência entre migrations locais e o schema remoto, tipos TypeScript quebrados, referências a tabelas/colunas ausentes e ausência de funções agendadas para automações. Esses pontos devem ser resolvidos antes de considerar o projeto pronto para operação ampla.
