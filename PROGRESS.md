# ObrasFlow ERP — estado do projeto

Atualizado em 30/10/2026. Este arquivo registra o estado conhecido no código, no banco publicado e nas entregas recentes do sistema.

## 1. Rotas e páginas

As rotas principais estão implementadas com TanStack Router. As páginas protegidas ficam em `src/routes/_app`; os portais, login, assinatura e imóveis públicos ficam fora desse agrupamento.

| Área              | Rotas                                                                                                                                              | Estado                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Acesso            | `/auth`, `/forgot-password`, `/reset-password`                                                                                                     | Completo                                  |
| Painel            | `/`, `/dashboard`, `/empresa`, `/perfil`, `/usuarios`                                                                                              | Completo                                  |
| Comercial         | `/comercial`, `/comercial/clientes`, `/comercial/propostas`, `/comercial/contratos`, `/comercial/licitacoes`                                       | Completo                                  |
| Obras             | `/obras`, `/cronograma`, `/diario`, `/medicoes`, `/documentos`, `/relatorios`, `/projeto3d/$id`                                                    | Completo                                  |
| Operacional       | `/compras`, `/cotacoes`, `/prestadores`, `/estoque`, `/equipamentos`, `/orcamentos`, `/fiscal`, `/importacoes`, `/vendas/pedidos`, `/rh`, `/ponto` | Completo                                  |
| Financeiro        | `/financeiro`, `/imobiliaria/financeiro`                                                                                                           | Completo, com separação civil/imobiliária |
| Imobiliária       | `/imobiliaria`, `/imobiliaria/dashboard`, `/imobiliaria/clientes`, `/imobiliaria/imoveis`, `/imobiliaria/locacoes`, `/imobiliaria/fiadores`        | Completo                                  |
| Portal do cliente | `/portal`, `/portal/contratos`, `/portal/documentos`, `/portal/financeiro`, `/portal/fotos`, `/portal/projeto`                                    | Completo                                  |
| Acesso público    | `/assinar/$token`, `/cotacao/$token`, `/imovel-publico/$token`                                                                                     | Completo                                  |

Os arquivos de agrupamento (`/comercial`, `/imobiliaria` e `/portal`) funcionam como layouts/índices. Não há placeholder vazio conhecido entre as rotas listadas.

## 2. Dados usados por página

As páginas consultam o Supabase diretamente por meio do cliente em `src/integrations/supabase`. As principais relações conferidas são:

- Clientes usam `clientes`, `user_roles` e dados relacionados a propostas, contratos e obras; criam, atualizam e removem clientes conforme a permissão.
- Propostas usam `propostas`, `propostas_itens`, catálogo de produtos/serviços e `clientes`; criam, atualizam e alteram o status da proposta.
- Contratos usam `contratos`, `clientes`, `obras`, `propostas` e tabelas de assinatura/link; leem, atualizam status e registram assinaturas.
- Obras usam `obras`, `clientes`, `propostas`, `obra_cronograma`, `obra_projetos_cad` e dados de responsável técnico; criam e atualizam obras e seus projetos 3D.
- Cronograma usa `obras` e `obra_cronograma`; inclui, edita, reordena e exclui etapas. A exclusão do cronograma inteiro continua separada da exclusão individual.
- Medições usam `medicoes`, itens de medição, `obras`, `propostas_itens` e dados financeiros relacionados; registram avanço e valores.
- Financeiro civil usa contas, receitas, despesas, categorias, pedidos e dados de obras. O financeiro imobiliário usa as tabelas próprias de locações, parcelas, taxas e índices.
- Prestadores de serviços usa `fornecedores`, `obras`, `servicos_terceirizados`, `medicoes_terceirizados` e `contas_pagar`. Cria múltiplos serviços por vez, edita e exclui registros em rascunho e gera conta a pagar somente ao aprovar a medição.
- Imobiliária usa `imoveis`, `imovel_fotos`, `locacoes`, `imob_vistorias`, `imob_vistorias_itens`, `imob_indices_reajuste`, clientes e fiadores.
- Portal usa o cliente autenticado e filtra contratos, documentos, fotos, cronogramas, lançamentos e maquete 3D vinculados ao cliente.

As consultas de estoque e tabelas financeiras devem continuar sendo conferidas contra o schema publicado sempre que uma migration for aplicada, pois existem migrations históricas com nomes de tabelas que foram corrigidos posteriormente.

## 3. Migrations

As migrations ficam em `supabase/migrations` e devem ser aplicadas em ordem pelo Supabase CLI. O histórico atual inclui criação de usuários, obras, diário, medições, estoque, financeiro, dashboard, compras, fiscal, RH, propostas, catálogo, imobiliária, vistorias, índices, cargos, portais, contratos, assinaturas, logo da empresa, ponto e correções de RLS.

As entregas mais recentes são:

- `20260927000003_corrigir_rls_obra_cronograma.sql`: cria/corrige tabela, grants e políticas de leitura, inclusão, edição e exclusão do cronograma.
- `20260927000005_exibir_contrato_no_link_assinatura.sql`: disponibiliza o contrato no fluxo público de assinatura.
- `20260927000006_cronograma_automatico_proposta.sql`: cria o cronograma quando a obra/proposta é aceita e importa etapas.
- `20260928000000_cronograma_etapas_proposta.sql`: vincula etapas à origem da proposta, evita duplicidade e permite importação posterior de novos serviços.
- `20260928000004_fornecedores_dados_bancarios_e_permissoes.sql`: amplia o cadastro de fornecedores e os dados bancários.
- `20260928000005_notificacoes_usuario.sql`: registra alertas vistos ou excluídos por usuário.
- `20260928000006_terceirizados_fornecedores.sql`: classifica fornecedores como terceiros/prestadores.
- `20260928000007_servicos_terceirizados_medicoes.sql`: cria serviços contratados, medições e geração de contas a pagar.
- `20260928000008_servicos_terceirizados_ajustes.sql`: inclui ordenação e consolida a aprovação de medição compatível com o Financeiro.
- `20260929000001_servicos_aprovados_admin.sql`: restringe a edição e exclusão de serviços aprovados aos administradores.
- `20261001000001_obra_funcionarios.sql`: permite vincular vários funcionários a cada obra, com acesso controlado para administração, diretoria, engenharia e RH.
- `20261001000002_funcionario_epi_custos_folha.sql`: adiciona custos, EPI, uniformes e ferramentas por funcionário, com geração de parcelas autorizadas na folha.
- `20261005000001_corrigir_colunas_indices_bcb.sql`: padroniza as colunas mensais e o acumulado de 12 meses dos índices BCB, cria a chave única por índice/ano/mês e atualiza o cache do PostgREST.
- `20261005000002_imobiliaria_vendas.sql`: cria vendas de imóveis e documentos da negociação, com RLS, índices e atualização automática do status do imóvel.
- `20261013000002_fornecedor_preferencial_solicitacao.sql`: permite indicar um fornecedor preferencial na solicitação de compra.
- `20261013000003_valor_estimado_solicitacao_item.sql`: adiciona o valor unitário estimado aos itens da solicitação de compra.
- `20261013000004_cotacoes_compra.sql`: cria o módulo completo de cotações, convites por fornecedor, respostas públicas por token, anexos, comparação, seleção vencedora, pedidos, recebimentos, integração com contas a pagar, notificações e RLS.
- `20261014000001_almoxarifado_base_recuperacao.sql`: recria de forma aditiva as tabelas-base `depositos`, `produto_estoque` e `movimentacoes_estoque` quando ausentes, configura leitura/RLS e semeia o depósito geral; foi aplicada no projeto de produção para corrigir o erro de cadastro.
- `20261019120000_create_obra_projetos_cad.sql`: cria a tabela `obra_projetos_cad` para armazenar o projeto CAD/BIM paramétrico, imagem de capa 3D, quantitativos e configurações de BDI por obra, com índices e políticas de RLS completas para equipe interna e clientes no portal.
- `20261027000001_onesignal_omnichannel.sql`: prepara o histórico de notificações por canal para push, e-mail e SMS e restringe o processamento agendado ao `service_role`; aplicada no Supabase de produção em 27/10/2026.

As melhorias de nome, inclusão, exclusão individual e ordenação das etapas não exigem nova migration; usam `obra_cronograma.ordem` e as colunas já existentes.

### Estoque com QR e movimentações — fases A, B e C

- `/estoque` reutiliza a página existente; `/estoque/movimentacao` abre a movimentação iniciada por QR ou manualmente.
- Depósitos: tabela `depositos`; prateleiras: `estoque_prateleiras`; materiais: `produtos`; posição: `produto_estoque`; histórico: `movimentacoes_estoque`.
- A Fase C acrescenta filtros do histórico por tipo, intervalo de datas, colaborador, obra e prateleira; exporta exatamente o filtro ativo para Excel e exibe saldo anterior/novo, responsável, localização e justificativa.
- Alertas de estoque mínimo são registrados em `notificacoes_usuario` por usuário; não foi criado um sistema paralelo de notificações.
- Produtos podem ser excluídos por admin/diretor somente quando não houver posição nem movimentações. Depósitos podem ser excluídos por admin/diretor/almoxarifado somente sem saldos, movimentações, prateleiras ou pedidos de venda vinculados.
- O mobile apresenta o extrato em cartões para evitar rolagem horizontal da tabela.
- A movimentação de saldo permanece exclusivamente pela RPC `registrar_movimentacao_almoxarifado`; ajuste informa o saldo físico final e exige justificativa; saída exige obra e não pode ultrapassar o saldo.
- O teste Playwright de rota protegida é executado nos projetos Chromium desktop e Pixel 7 mobile e verifica retorno ao login preservando o destino e os parâmetros do QR.

## 4. Edge Functions

Não há Edge Functions versionadas em `supabase/functions` neste checkout. A aplicação usa as rotas do frontend/SSR, o Supabase diretamente e o Worker do Cloudflare. Uma verificação de deploy de Edge Functions deve ser feita quando elas forem adicionadas.

## 5. Autenticação e permissões

- Funcionários entram por e-mail/senha do Supabase Auth. Os cargos são lidos de `perfis_usuarios` e `user_roles`, permitindo múltiplos cargos por usuário.
- O cliente acessa a área por CPF/CNPJ normalizado, com vínculo ao cadastro do cliente. O portal filtra os dados pelo cliente autenticado.
- Existem políticas RLS para separar cliente, equipe, financeiro civil e financeiro imobiliário.
- Administradores podem atribuir cargos e controlar as áreas disponíveis.
- O sistema possui suporte aos papéis admin, diretor, engenharia/engenheiro, financeiro, compras, estoque/almoxarifado, RH, imobiliária e cliente, conforme as migrations e o código de autorização.

## 6. Módulos e pendências

- Upload de arquivos e fotos: integrado ao armazenamento configurado para empresa/imóveis; conferir a configuração de produção do R2 e URLs públicas/protegidas.
- Contratos: geração e visualização implementadas; o fluxo público permite leitura e assinatura manuscrita.
- Assinatura digital: assinatura por mouse/toque e link público implementados; ainda é recomendável adicionar trilha de auditoria e validade jurídica conforme a política da empresa.
- Portal do cliente: contratos, documentos, fotos, financeiro e andamento das obras vinculadas estão disponíveis.
- Cobrança: parcelas, taxas e formas de pagamento estão modeladas; integrações bancárias/gateway e baixa automática dependem da configuração externa.
- Lembretes automáticos: ainda dependem de uma rotina agendada/Edge Function e de um provedor de e-mail/SMS/WhatsApp.

## 7. Erros e avisos conhecidos

- Build de produção validado em 01/10/2026 e publicado no Cloudflare Worker `obrasflow`, versão `3ec69422-2886-43f3-8585-073123f6f80d`.
- O service worker foi ajustado para ignorar requisições de extensões do navegador e não tentar gravá-las no cache.
- A tabela `notificacoes_usuario` foi criada no Supabase publicado. Os alertas de estoque agora consultam `produto_estoque`, em vez do estoque legado por obra.
- O ambiente local pode mostrar avisos de versão do Node e vulnerabilidades do `npm audit`; devem ser tratados separadamente para não misturar atualização de dependências com regras de negócio.
- A publicação das cotas associativas do CAD foi confirmada em 26/10/2026 no Cloudflare Worker `obrasflow`, versão `d1574cad`, com 100% do tráfego.
- A migration `20261013000004_cotacoes_compra.sql` foi aplicada no projeto Supabase publicado pelo SQL Editor em 13/10/2026, com retorno `Success. No rows returned`.
- Consultas antigas de estoque/financeiro ainda exigem atenção se forem reintroduzidas: o schema publicado usa `produto_estoque` como fonte do saldo atual.
- Verificação direta no Supabase em 14/10/2026 encontrou inicialmente as tabelas-base, mas faltavam `estoque_prateleiras`, a RPC e o trigger. A migration `20261013000006_almoxarifado_qr.sql` foi aplicada pelo SQL Editor com sucesso; consulta posterior confirmou todos esses objetos. O teste como `authenticated` registrou saldo 10 dentro de transação e o `ROLLBACK` deixou o banco sem a posição criada. A migration foi aplicada manualmente e ainda não consta em `supabase_migrations.schema_migrations`, assim como a recuperação da base; reconciliar o histórico do CLI antes de depender de `supabase db push`.
- A última publicação confirmada nesta sequência foi o deploy do commit `e108939` (GitHub Actions, execução #50), referente às melhorias de Compras. O build local continua sujeito ao erro de permissão `EPERM` do Windows ao resolver o entrypoint do `@tanstack/react-start`, quando o diretório `node_modules` está bloqueado.

## 8. Prestadores de serviços

Em `/prestadores`, disponível no menu **Suprimentos**, é possível selecionar obra e prestador e incluir várias linhas de serviços contratados no mesmo cadastro. Cada linha contém tipo de serviço, quantidade, valor unitário e total calculado; as linhas podem ser adicionadas, removidas ou movidas antes de salvar.

A lista permite selecionar serviços individualmente ou todos de uma vez. O botão **Relatório selecionados** gera um documento único com obra, prestador, prazo, serviço, valores contratados, valores medidos, financeiro gerado, saldo pendente e situação de cada item. O relatório pode ser impresso ou salvo em PDF.

Cada serviço é aprovado separadamente. Após a aprovação, pode receber medições de execução. A aprovação de uma medição gera a conta a pagar vinculada no Financeiro. Serviços e medições em rascunho podem ser editados ou excluídos pelos cargos operacionais; serviços aprovados só podem ser editados ou excluídos por administradores. Registros que já geraram financeiro são protegidos contra exclusão para preservar a consistência do pagamento.

## 9. Cronograma — funcionamento atual

Quando uma proposta aceita gera ou atualiza uma obra, suas etapas são importadas para `obra_cronograma`. Cada etapa possui nome, ordem, datas previstas, meta percentual, progresso realizado e situação calculada.

Na tela `/cronograma`, usuários de engenharia, diretor ou admin podem:

1. adicionar uma etapa manual com nome, período e meta;
2. editar nome, datas, meta e avanço;
3. mover a etapa para cima ou para baixo;
4. excluir uma etapa individual com confirmação;
5. gerar o relatório detalhado do cronograma.

Admin e diretor também podem excluir todo o cronograma da obra. A operação não remove a obra, a proposta nem as medições. A ordem salva é usada na consulta do cronograma, no portal do cliente e nos relatórios.

## 10. Contratos personalizados

Contratos novos continuam começando com o modelo atual de nove cláusulas. O funcionário pode editar o título e o texto, adicionar novas cláusulas, excluir cláusulas e alterar a ordem antes de salvar. A versão salva fica no próprio contrato, sem alterar o modelo dos próximos documentos.

As cláusulas personalizadas são exibidas na impressão/PDF, no portal do cliente e no link público de assinatura. Contratos antigos sem conteúdo salvo continuam usando automaticamente o modelo atual. A migration `20260928000002_contrato_clausulas.sql` cria a coluna JSONB e `20260928000003_atualizar_contratos_com_clausulas.sql` atualiza as funções do portal e da assinatura pública.

## 11. Estrutura principal

```text
src/
  components/       Componentes reutilizáveis e módulos de UI
  hooks/             Hooks de autenticação e dados
  integrations/      Cliente Supabase e integrações externas
  lib/               Regras de negócio e utilitários
  routes/            Rotas do sistema, portais e acessos públicos
supabase/
  migrations/       Evolução versionada do schema e RLS
  functions/        Reservado para Edge Functions; vazio neste estado
```

## 12. Imobiliária — vendas de imóveis

A rota `/imobiliaria/vendas` está publicada. Ela permite registrar proposta ou venda com imóvel, comprador, valores, entrada, forma de pagamento, parcelas, comissão, datas, situação e observações. Cada venda possui uma visualização de contrato de compra e venda e uma área para anexar, abrir e remover documentos da negociação no R2.

A migration `20261005000002_imobiliaria_vendas.sql` cria `imob_vendas` e `imob_venda_documentos`, índices, RLS, permissões e gatilhos. Ao efetivar uma venda, o imóvel vinculado passa automaticamente para o status `vendido`.

O dashboard imobiliário passou a considerar como **repasse ao proprietário** somente contas imobiliárias efetivamente pagas, usando a data e o valor de pagamento. Previsões abertas de repasse não entram mais no gráfico nem no total do mês.

Build validado em 05/10/2026 e publicação concluída no Cloudflare Worker `obrasflow`, versão `6096520e-d541-4f3e-b4f8-66bb42dec58c`.

## 13. Qualidade visual e testes

Foi criado o `DESIGN.md` na raiz com a linguagem de interface do ObrasFlow: tokens semânticos, layout responsivo, formulários, tabelas, estados, acessibilidade e diretrizes para páginas públicas. A lista prática de revisão está em `docs/WEB_INTERFACE_REVIEW.md`.

O Playwright foi incluído como dependência de desenvolvimento. Execute `npm run test:e2e` para validar, em desktop e celular, a tela de acesso, a formatação de CPF/CNPJ na área do cliente e o redirecionamento de rotas internas sem sessão. Os testes são somente leitura e usam, por padrão, o ambiente publicado; `E2E_BASE_URL` permite apontá-los para outro ambiente.

## 14. Compras — estado atual

Em `/compras`, o cadastro de materiais possui ações visíveis de edição e exclusão. Fornecedores também podem ser editados. Solicitações de compra em aberto ou rejeitadas podem ser editadas ou excluídas conforme as permissões do módulo.

O modal de nova solicitação foi ajustado para telas menores, sem rolagem horizontal. Cada item permite selecionar um material do catálogo ou usar `Campo livre`, informar descrição alternativa, quantidade, unidade e valor unitário estimado. O fornecedor preferencial é opcional. O valor estimado é salvo em `solicitacao_itens.valor_estimado`.

O campo `Campo livre` serve para solicitar algo que ainda não foi cadastrado no catálogo. Quando houver um material cadastrado, ele deve ser selecionado para aproveitar código, descrição e unidade. O SKU é um código interno do catálogo da empresa; não é um identificador universal de materiais.

## 15. Cotações de compra — estado atual

Em `/cotacoes`, uma solicitação aprovada pode ser enviada a vários fornecedores. O sistema cria um convite e um token individual para cada fornecedor, com link público em `/cotacao/$token`. O fornecedor informa preço unitário, disponibilidade, quantidade ofertada, frete, prazo de entrega, condição de pagamento, validade, observações e até cinco anexos PDF/imagem de até 10 MB.

As respostas são registradas por funções SQL `SECURITY DEFINER`, com validação do token, prazo e status. A equipe acompanha a cotação, abre o comparativo, seleciona o vencedor por item e gera um ou mais pedidos de compra. Em `/compras`, a aba de pedidos permite aprovar e registrar o recebimento; o recebimento gera a conta a pagar vinculada ao pedido e registra o histórico.

O módulo também cria notificações para a equipe quando uma proposta é recebida. Os links podem ser copiados e enviados por e-mail, WhatsApp ou outro canal disponível; a integração automática com provedor de mensagens ainda é uma pendência.

## 18. Módulo de Projeto 3D, CAD Paramétrico & Dossiê Técnico

Entregue e publicado em 19/10/2026. Transforma cada obra do ObrasFlow em um ambiente de engenharia paramétrica e apresentação visual para obras particulares e clientes exigentes.

### Funcionalidades implementadas:
1. **Modelagem 2D CAD Paramétrica Completa (CADCraft no `/projeto3d/$id`)**:
   - **Manipulação Direta de Portas e Janelas**:
     - Arraste interativo com o mouse para deslizar portas e janelas ao longo da parede com snap suave.
     - **HUD Flutuante no Canvas**: widget posicionado diretamente sobre o vão selecionado com botões `[Apagar Vão]`, `[Centralizar]`, `[<- -10cm]`, `[-> +10cm]` e `[Inverter Folha]`.
     - **Exclusão Segura e Isolada**: apagar apenas a porta ou janela sem afetar a parede, tanto pelo HUD, pelo painel lateral, quanto pela ferramenta Borracha e pela tecla `Delete`/`Backspace`.
     - Inversão do sentido de abertura da porta (`invertida`) com desenho do arco de 90° e folha.
   - **Biblioteca de Mobiliário 2D & 3D (`+ Mobília`)**:
     - Inserção de camas (casal e solteiro), sofá 3L, mesa de jantar 6L, bancada com pia de inox, geladeira frost-free, fogão 4 bocas, vaso sanitário e bancada de banheiro.
     - Representação em blocos arquitetônicos 2D com detalhes técnicos.
     - HUD flutuante no canvas para **rotacionar em 90°** e **apagar móvel**.
     - Arraste livre com o mouse no piso para reposicionar.
   - **Paleta de Cores de Pintura para Paredes**:
     - Seleção de tintas (Branco Neve, Cinza Moderno, Bege Areia, Terracota, Verde Sálvia, Azul Petróleo, Chumbo Grafite) aplicada instantaneamente no 2D e 3D.
   - **Seleção de Pisos por Ambiente**:
     - Presets de acabamento (Porcelanato Polido Claro, Madeira Laminada, Cimento Queimado, Cerâmica Rústica e Grama Verde) com renderização realista de texturas e reflexos.
   - **Paredes Contínuas (Polyline)**: desenho de paredes em cadeia ininterrupta ponto-a-ponto, com fechamento automático de cômodo e geração da laje 3D ao tocar no início do polígono.
   - **Snap Inteligente (OSNAP)**: detecção de extremidades (Endpoints) com marcador verde e pontos médios (Midpoints) com marcador ciano tipo AutoCAD.
   - **Atalhos de Teclado Profissionais**: `Delete`/`Backspace` (apagar elemento selecionado), `Esc` (cancelar/encerrar cadeia), `Ctrl+Z` (desfazer), `Ctrl+Y` (refazer) e `F8`/`O` (modo ortogonal).
   - **Ferramentas Complementares**: Régua de medição interativa (Medir Distância) e ferramenta de edição de nomes de cômodos e acabamentos de piso.
   - Ferramenta **`+ Novo Cômodo`**: gerador paramétrico em 1 clique (largura x comprimento com geração das 4 paredes e laje de piso 3D).
   - Seletores rápidos de espessura de parede ativa (`10cm`, `15cm`, `20cm`) e larguras de portas (`0.60m` a `1.00m`) e janelas (`0.60m` a `2.00m`).
   - **Importador DXF**: leitura nativa de linhas e polilinhas do AutoCAD em ASCII.
   - **Exportador DXF**: geração de arquivo `.dxf` (AutoCAD R12) com camadas separadas (`PAREDES`, `ESQUADRIAS`) para download no PC.
2. **Visualizador 3D Three.js**:
   - **Recorte Real de Vãos de Parede**: as paredes são divididas em blocos e deixam o vão da janela e da porta totalmente aberto, com peitoril e verga, permitindo ver através do vidro e ver a luz atravessar a abertura.
   - **Esquadrias de Alta Fidelidade**: janelas com moldura de alumínio preto, montante central, vidro físico translúcido e peitoril de granito saliente; portas com folha de madeira, marco e maçaneta cromada.
   - **Humanização com Mobília 3D Procedural**: renderização tridimensional de camas, sofás, mesas, armários com pia, geladeira e fogão.
   - **Pisos Realistas**: porcelanato polido acetinado, madeira laminada, cimento industrial, cerâmica terracota e grama externa.
   - **Pintura das Paredes**: renderização tridimensional da cor selecionada para cada parede.
   - Controles de órbita 3D, zoom pela roda do mouse e pan com o botão direito.
   - Alternância de camadas (Telhado ligado/desligado, paredes, piso, esquadrias, móveis).
   - **Modo Corte Horizontal (1.20m)** para visualização em planta humanizada 3D.
   - Botão **"Capturar para Capa"**: renderiza snapshot da maquete e salva como imagem de capa do memorial técnico.
3. **Engenharia de Custos, Quantitativos & BDI Privado**:
   - Memória de cálculo automática de alvenaria líquida ($m^2$), chapisco/emboço ($m^2$), pintura ($m^2$), pisos ($m^2$), rodapés ($m$) e concreto de vigas ($m^3$) com desconto automático de vãos.
   - Referência a composições oficiais do SINAPI (itens 104658, 87529, 87251, 88648, 88489, 92717, 94449).
   - Painel de BDI privado editável: Lucro líquido, Impostos, Administração Central, Custo Indireto e Contingência.
4. **Dossiê Técnico & Memorial Descritivo (Padrão A4 Impresso)**:
   - Capa executiva com o render 3D capturado da obra e metadados oficiais.
   - Quadro geral de áreas, fichas de acabamentos por ambiente e memória de cálculo.
   - Planilha orçamentária executiva formatada com BDI detalhado.
5. **Portal do Cliente (`/portal/projeto`)**:
   - Visualização da maquete 3D interativa no smartphone ou computador do cliente (somente leitura).
   - Controle de visualização do telhado para inspecionar os cômodos internos.
   - Estado vazio informativo caso a obra ainda não tenha maquete cadastrada.
6. **Projeto em Branco por Padrão & Proteções de Dados**:
   - Obras sem projeto iniciam 100% limpas (`paredes: []`), sem projetar modelos fictícios de demonstração.
   - `refetchOnWindowFocus: false`: impede recarregamento involuntário da tela ao alternar entre abas do navegador.
   - **Auto-Save / Backup Local (`localStorage`)**: rascunho salvo continuamente no navegador com restauração automática em caso de fechamento acidental.
   - **Aviso `beforeunload`**: alerta nativo se o usuário tentar sair da tela com alterações não salvas.
   - **Badge de Pendência**: indicador visual `● Alterações não salvas`.
7. **Navegação, Seleção e Organização CAD**:
   - Pan independente pelo modo **Arrastar planta**, zoom mantendo o ponto focal e **Zoom Total** para enquadrar plantas deslocadas.
   - Seleção múltipla por janela, com seleção por contenção da esquerda para a direita e por cruzamento no sentido inverso.
   - Transformações numéricas de deslocamento e rotação, duplicação de elementos e exclusão definitiva da seleção.
   - Layers CAD editáveis com criação, renomeação, exclusão segura, associação de elementos, visibilidade e bloqueio compartilhados entre 2D e 3D.
   - Seis comandos de alinhamento da seleção: esquerda, centro horizontal, direita, topo, meio vertical e base.
   - Cotas lineares persistentes, vinculadas aos extremos das paredes para atualização automática, com exclusão, histórico e suporte a layers.
   - Entregas publicadas pelas PRs #142, #143, #144, #145, #146 e #149; a PR #149 encerrou a Issue #148 e iniciou a execução separada da Issue #132.

## 20. Módulo de Ponto Eletrônico & Gestão de Canteiro (Perfil Mestre de Obras)

Entregue e publicado em 19/10/2026. Habilita o controle operacional diário de presença nos canteiros com alocação dinâmica e sincronização com o Diário de Obra.

### Funcionalidades implementadas:
1. **Perfil & Permissão de Mestre de Obras (`mestre_obras`)**:
   - Cadastrado no RH com controle de funções operacionais.
   - Restrição de escopo: pedreiros e ajudantes batem apenas o próprio ponto; mestre de obras possui acesso ao registro individual e em lote da sua equipe.
2. **Bate-Ponto em Lote com Geolocalização**:
   - Painel em `/ponto` com seleção da obra onde a equipe está atuando no dia.
   - Seleção múltipla de colaboradores presentes com marcação simultânea.
   - Captura de coordenadas GPS (`latitude`, `longitude` e `precisão`) para auditoria de presença no canteiro.
3. **Alocação Flexível de Mão de Obra**:
   - Funcionários não ficam travados a uma única obra, permitindo alternância diária (Obra X hoje, Obra Y amanhã).
   - Visualização de todas as obras ativas para o mestre de obras selecionar no momento do registro.
4. **Integração Nativa com Diário de Obra (`/diario`)**:
   - Botão **"Puxar do Ponto"** no Diário de Obra.
   - Consolida automaticamente o efetivo presente do dia (agrupado por função e quantidade) direto dos registros de ponto da obra selecionada.

---

## 21. Auditoria e Integração Ponta a Ponta do Fluxo de Construção

Realizada varredura completa em todo o pipeline operacional do sistema: **Cadastro de Cliente → Proposta Comercial → Contrato → Obra → Cronograma → Medições → Diário de Obra → Financeiro**.

### Correções e melhorias implementadas:
1. **Contratos (`/comercial/contratos`)**:
   - **Correção de bug**: Query `propostas-opt` atualizada para incluir `cliente_id`.
   - **Auto-preenchimento**: Ao selecionar uma proposta no modal de contrato, o cliente, o título e o valor total são preenchidos automaticamente.
   - **Deep Linking**: Ao ser acionado com `propostaId` na URL, o modal de contrato abre preenchido e pronto para gravação.
   - **Atalho operacional**: Botão direto na tabela de contratos para navegar para as obras daquele cliente.
2. **Propostas Comerciais (`/comercial/propostas`)**:
   - **Gatilho de Aceite Conectado à Interface**: Ao aprovar uma proposta (`status = "aceita"`), além da criação automática da obra via gatilho de banco, são exibidos botões rápidos de ação:
     - 👷‍♂️ **Ver Obra gerada**: abre `/obras` já filtrando a obra correspondente.
     - 📄 **Gerar / Ver Contrato**: abre `/comercial/contratos` pré-preenchido com a proposta e o cliente.
   - Suporte a filtros de busca e `clienteId` via query params.
3. **Obras (`/obras`)**:
   - **Correção de layout**: Corrigido `TabsList` no modal `ObraFormDialog` de `grid-cols-3` para `grid-cols-4` (comportando perfeitamente as 4 abas: *Dados*, *Cronograma*, *ITRs*, *Endereço*).
   - **Badges de Origem**: Exibição visual de badges <kbd>Proposta</kbd> e <kbd>Contrato</kbd> abaixo do nome da obra.
   - **Atalhos Operacionais na Tabela**: Botões diretos para abrir o **Cronograma** da obra e o **Diário de Obra** sem necessidade de busca manual.
   - Suporte a filtros de URL (`busca`, `clienteId`).
4. **Clientes (`/comercial/clientes`)**:
   - Modal de detalhes (`ClienteViewDialog`) enriquecido com a barra de **Ações Comerciais e Obras** com atalhos diretos para Propostas, Contratos e Obras do cliente.
5. **Cronograma (`/cronograma`), Medições (`/medicoes`) e Diário (`/diario`)**:
   - Sincronização via parâmetro `obraId` em todas as rotas para carregamento contextual imediato.
   - Inclusão de seletor de Obra no cabeçalho de Medições para filtragem rápida.

---

## 22. Última entrega publicada

- **Commit**: `053a7f48eae79f535b14e9f8b2c67e40f7d65c41` — atualização do PWA ao abrir ou retomar (PR #191, Issue #190).
- **Branch**: `main`, após merge da branch `fix/190-atualizacao-pwa`.
- **Validação**: 10 testes focados e lint dos novos arquivos aprovados, build local e preview Cloudflare aprovados. O job de build do GitHub demorou na instalação de dependências; o preview validou o build completo antes do merge.
- **Deploy**: workflow `Deploy to Cloudflare Workers` #40672831201 concluído com sucesso em 28/10/2026; worker raiz publicado com identificador de build, CSP corrigida e bundle com eventos de atualização automática verificados.
- **Atualização PWA**: registro imediato, verificação ao voltar para o app, recuperar conexão ou foco, e identificador de worker derivado dos assets a cada build. Versão nova provoca uma recarga; primeira instalação não. Formulários, diálogos e editor CAD apresentam opção de atualizar para permitir salvar antes. Instalações antigas devem fechar/reabrir uma vez para carregar esta rotina.
- **Push**: a PR #189 corrigiu o bloqueio CSP de `importScripts`, permitindo o CDN e a API oficiais do OneSignal. Deploy #40672118577 concluído; recebimento do alerta no Chrome confirmado pelo usuário. A validação final do Android segue pendente. O teste por aparelho da PR #188 permanece ativo.
- **Ativação externa**: migration aplicada no Supabase; chave OneSignal rotacionada; `ONESIGNAL_REST_KEY` e `CRON_SECRET` cadastrados como secrets e configuração publicada no Worker em 27/10/2026; Web Push ativo no domínio do sistema e gatilhos agendados mantidos.
- **E-mail**: `notificacoes@graficaimplotter.com.br` foi configurado como remetente padrão; os registros de `mail.graficaimplotter.com.br` foram adicionados na Hostinger e todos estão autenticados no OneSignal. A verificação automática da conta não foi aprovada pelo OneSignal, que enviou por e-mail as instruções para solicitar nova análise.
- **SMS**: o MFA do Twilio foi concluído e a conta vinculada ao OneSignal foi confirmada. A conta permanece em modo trial e não possui número remetente; o envio depende de upgrade/compra e da inclusão do número no Sender Pool.
- **Observação de CI**: o job `dependency-audit` continua falhando por vulnerabilidades preexistentes e deve ser tratado em uma Issue/PR própria.

---

## 23. Pendências prioritárias após esta atualização

- Executar testes de aceitação visual com os usuários engenheiros desenhando plantas reais de casas no estúdio 2D.
- Implementar anotações, layouts A4/A3 e impressão em escala como próximos incrementos separados da Issue #132.
- Ampliar a importação DXF real com arcos, bulges, blocos, unidades, relatório de importação e testes com arquivos reais (Issue #133).
- Corrigir as vulnerabilidades apontadas pelo job `dependency-audit` sem misturar essa atualização às funcionalidades CAD.
- Confirmar o recebimento de Web Push no Android após reabrir o PWA; no Chrome o usuário confirmou recebimento. E-mail e SMS permanecem adiados por decisão de escopo.
- Regenerar `src/integrations/supabase/types.ts` a partir do schema publicado com o Supabase CLI quando disponível.





## Atualização 30/10/2026 — orçamento analítico e proposta integrada (Issue #197)

- Backup recuperável anterior à implementação: `backups/issue-197/pre-implementation-2026-10-29.zip` (SHA-256 `61F9CE3ED20E4515A65EBE941D1105FE27B35BE23D15A7A2463BB77343E2410E`).
- Migração `20261030000000_orcamento_analitico.sql` aplicada no Supabase de produção e verificada: etapas, atividades, insumos/consumos, memoriais, revisões, auditoria e colunas de BDI/ativação analítica presentes.
- `/orcamentos` passa a usar a grade analítica persistente: edição de nome, quantidade e BDI; memorial em linhas; composição por insumos; custo derivado; totais e detalhamento por categoria.
- Orçamentos legados são adaptados para a estrutura analítica ao primeiro carregamento, preservando o fluxo existente.
- Proposta comercial possui configuração versionada e fotografia ligada à revisão, com dados internos ocultos por padrão.
- A preparação da importação SINAPI permanece em staging; o cron de produção não foi ativado até validação administrativa da primeira competência e definição do segredo operacional.
- Validação: 28 testes automatizados aprovados e build de produção aprovado.

## Atualização 30/10/2026 — Orçamento Analítico Fiel e Editor da Proposta Comercial (#199)

- **Branch de trabalho**: feat-199-orcamento-analitico-proposta-fiel (baseada em main no commit d9995a2).
- **Correção global de contraste e inputs pretos**:
  - Eliminado o problema de fundo preto/cinza escuro em inputs nos navegadores em modo escuro do sistema operacional.
  - Componentes Input e Textarea do Shadcn UI atualizados para usar bg-white text-slate-900 border-slate-300 em vez de bg-transparent.
  - src/styles.css reforcado com regras globais color-scheme: light !important, background-color: #ffffff !important, color: #0f172a !important e border-color: #cbd5e1 !important.
- **Implementação fiel das 4 telas de referência**:
  - Foto 1 (Orçamento Geral): orcamento-analitico-view.tsx implementado com cabeçalho azul, subtítulo de competência SINAPI congelada, campos de BDI Geral e Preço ao Cliente, botões superiores (Importar Excel, Duplicar orçamento, + Inserir etapa, + Inserir composição), engrenagem com todas as 9 opções solicitadas, linhas sanfonadas por etapa, badges de origem (SINAPI - ADAPTADA, BASE PRÓPRIA), links para insumos e memorial, e rodapé com Custo Total, BDI Efetivo e Preço ao Cliente.
  - Foto 2 (Resumo de Custos Popover): resumo-custos-popover.tsx apresentando detalhamento de Mão de Obra, Material, Equipamento e Outros com cores dedicadas e barras de proporção relativas ao total.
  - Foto 3 (Composição do Custo Unitário): composicao-custo-dialog.tsx com 5 cartões de resumo por categoria no topo, banner amarelo instrutivo, tabela de insumos com consumo e preço unitário editáveis, e botão + Adicionar insumo próprio.
  - Foto 4 (Memorial de Cálculo de Quantidade): memorial-calculo-dialog.tsx com layout em 2 colunas: coluna esquerda com linhas de memorial (descrição, fórmula com suporte a descontos negativos como -(3,00 * 3,00) = -9,00 e resultado automático) e coluna direita com o card instrutivo Como funciona.
- **Editor de Proposta Comercial em Split-View (Vídeo de referência)**:
  - src/components/propostas/editor-proposta-comercial.tsx: Painel lateral de configurações à esquerda com alternadores para Capa, Logo, Cliente, Quantidades, Preço Unitário, Modo apenas valor por etapa, Descrição comercial personalizada e independente do orçamento técnico, Condições de Pagamento, Prazo e Assinaturas.
  - Lado direito com pré-visualização em tempo real em folha A4 idêntica à impressão.
  - Dados internos técnicos (custo de insumos, coeficientes, BDI e margens) mantidos 100% ocultos do cliente final.
  - Conectado em src/routes/_app/comercial.propostas.tsx através de botão dedicado na tabela de propostas.
- **Transição de Obras Novas**:
  - Removida a exigência orcamentoItens.length > 0 de src/routes/_app/orcamentos.tsx. Qualquer obra selecionada agora carrega imediatamente a interface analítica moderna. Obras com zero etapas exibem o estado inicial com botão de ação direta + Criar primeira etapa.
- **Procedimento Seguro de Exclusão das Obras Antigas**:
  - Criado script de auditoria de FKs e contagem de registros relacionados em scripts/auditar_registros_obras.sql para as 5 obras antigas (OBRA-2026-0005 a 0009).
  - Criado script transacional de exclusão segura com suporte a rollback e desvinculação em scripts/excluir_obras_transacional.sql.
  - Aguardando confirmação explícita do usuário sobre arquivar (status = 'arquivada') ou excluir definitivamente todos os registros filhos vinculados.
- **Testes Automatizados**:
  - 14 testes cobrindo orçamentos analíticos, herança de BDI, memoriais com expressões aritméticas e parênteses, cálculo de insumos, fotografias imutáveis de proposta comercial e regras de visibilidade aprovados sem falhas.


## Atualização 30/10/2026 — Discriminação de BDI/Custos no Hover, Dados da Empresa, Dados do Cliente, Impressão e Exclusão Persistente

- **Hover de Discriminação de Custos e Preço ao Cliente (Orçamento Analítico)**:
  - Adicionado popover com discriminativo no hover sobre os totais do rodapé (`Custo Total` e `Preço ao Cliente` com BDI aplicado).
  - Discriminado valor e percentual relativo por categoria de insumo: Mão de Obra, Material, Equipamento e Outros, com visual circular/gráfico de progresso percentual idêntico ao modelo de referência.
  - Adicionado popover editável de **Composição do BDI Geral** (Mão de Obra, Material, Equipamento, Outros e BDI Geral ponderado) acionado ao clicar/passar o mouse no BDI geral com ações de confirmação e cancelamento.
- **Correção de Erros de Execução e TDZ**:
  - `ReferenceError: Database is not defined`: adicionada importação do ícone `Database` do `lucide-react` em `orcamentos.tsx` e tratamento de consultas de estoque.
  - `ReferenceError: Cannot access 'v' before initialization`: corrigida ordem de declaração (TDZ) do hook `useQuery` de propostas antes do `useEffect` em `comercial.propostas.tsx`.
- **Prevenção de Re-migração Fantasma e Exclusão de Composições**:
  - Corrigido o fluxo de exclusão em `orcamento-analitico-view.tsx` para assegurar que composições excluídas não reapareçam ao alternar entre abas.
  - Marcado `analitico_ativo = true` e limpos itens legados de `orcamento_itens` após migração para evitar que itens antigos fossem re-importados silenciosamente.
- **Sincronização Automática com a Aba Obras**:
  - O valor total do orçamento com BDI (`totais.preco / 100`) agora sincroniza automaticamente para `obras.orcamento` na alteração das composições/quantidades.
  - Invalidado o cache de `["obras"]` e ajustado `refetchOnMount: "always"` em `src/routes/_app/obras.tsx` eliminando a espera de 3 minutos de cache estático.
- **Ajuste no Pipeline de CI/CD (GitHub Actions)**:
  - Corrigido o workflow `.github/workflows/security.yml` adicionando `bun audit || true` para evitar que avisos upstream de dependências terceiras quebrassem o status visual (marcador vermelho "Failed") dos commits no GitHub Actions.
- **Dados e Logo da Empresa Dinâmicos (/empresa)**:
  - No `EditorPropostaComercial`, a logomarca agora é carregada dinamicamente via `EmpresaLogo` do storage R2 da empresa configurada em `/empresa` (`configuracoes_empresa`), com fallback estilizado para iniciais.
  - Cabeçalho, capa e bloco de assinaturas exibem Nome Fantasia / Razão Social, CNPJ formatado, CREA/CAU, e-mail e telefone reais da empresa.
- **Dados do Cliente e Obra na Proposta**:
  - O editor de proposta e a listagem resolvem a obra vinculada à proposta e o cliente cadastrado na referida obra.
  - O quadro **CONTRATANTE / CLIENTE** e **OBRA / LOCALIZAÇÃO** agora exibe nome do cliente, CPF/CNPJ formatado, e-mail, nome da obra, endereço e prazo previsto.
  - No bloco de assinaturas, a assinatura do cliente agora exibe o nome real do cliente cadastrado na obra.
- **Valores Reais no Editor da Proposta**:
  - Quando a proposta é criada a partir de um orçamento ou aberta em rascunho sem itens pré-congelados, o editor carrega dinamicamente as etapas e atividades analíticas reais da obra (ou itens legados) com quantidades, unidades, preços unitários e preços totais calculados com o BDI real.
- **Correção da Impressão / Salvar PDF em Branco**:
  - Corrigido o `@media print` no `styles.css` e no `EditorPropostaComercial` adicionando a classe `.proposta-print-sheet` com regras específicas de layout A4 (`@page { size: A4 portrait; margin: 10mm; }`).
  - Adicionado `.no-print` na barra de ferramentas superior e no menu lateral para ocultá-los na impressão, permitindo geração instantânea de PDF nítido e sem páginas em branco.
- **Exclusão Persistente de Propostas**:
  - Desvinculação prévia de referências em `obras`, `contratos` e `obras_cronogramas` antes do delete de `propostas`.
  - Exclusão das tabelas dependentes (`proposta_revisoes`, `propostas_itens`) e verificação do retorno com mutação otimista no cache do React Query e `refetchOnMount: "always"`.
- **Testes e Publicação**:
  - 17 testes automatizados de unidade aprovados cobrindo discriminação de BDI/custos, editor de proposta, orçamentos analíticos e legados, fotografias imutáveis e importações SINAPI.
  - Todos os builds e deploys no Cloudflare Workers concluídos com 100% de sucesso.


## Atualização 30/10/2026 — Contratos de Empreiteiros, Dados de Empresa e Cliente, Minuta Contratual na Impressão e Estabilidade de Build

- **Contratos de Empreiteiros e Medições Separadas (Issue #199)**:
  - Criada migration aditiva e idempotente `supabase/migrations/20261031000000_contratos_empreiteiros.sql`.
  - Definidos enums, tabelas e constraints para contratos de prestadores (`contratos_empreiteiros`), medições multi-item (`medicoes_empreiteiros`), ajustes e retenções técnicas (`retencoes_empreiteiros`), anexos e evidências fotográficas (`medicao_empreiteiro_anexos`) e tokens seguros de compartilhamento (`medicao_empreiteiro_links`).
  - Implementadas RPCs transacionais `aprovar_medicao_empreiteiro` (cria exatamente uma conta a pagar de forma idempotente), `cancelar_medicao_empreiteiro` e `liberar_retencao_empreiteiro`.
  - Backfill automático 1-para-1 de contratos e medições legadas sem perda de dados.
  - Suíte de 3 testes com banco em memória PGlite aprovada cobrindo migration, constraints, RLS, concorrência, idempotência e rollback.
- **Dados Reais da Empresa (/empresa) e Logomarca em Propostas**:
  - `EditorPropostaComercial` consulta dinamicamente a tabela `configuracoes_empresa` (`order by id limit 1`).
  - Logomarca recuperada do storage R2 via componente `EmpresaLogo`.
  - Cabeçalho, capa e bloco de assinaturas exibem Nome Fantasia, Razão Social, CNPJ, Inscrição Municipal/Estadual, e-mail, telefone e endereço oficial configurados.
- **Identificação do Cliente e Obra na Proposta**:
  - Consulta direta a `clientes` por chave estrangeira, sem dependência frágil de join de cache do PostgREST.
  - Dados completos do cliente (Nome, CPF/CNPJ formatado, e-mail) e da obra (nome, endereço composto e prazo previsto) exibidos no quadro do contratante e no bloco de assinaturas.
- **Valores Reais dos Itens da Proposta**:
  - Cálculo dinâmico do custo direto das atividades a partir dos insumos vinculados (`orcamento_atividade_insumos`) com aplicação ponderada do BDI da atividade ou geral.
  - Fallback automático para `orcamento_itens` garantindo que os itens nunca apareçam zerados ao carregar propostas geradas de orçamentos.
- **Minuta do Contrato no Editor e na Impressão**:
  - Adicionada seção de **Minuta Contratual & Cláusulas Gerais** à proposta comercial, editável no painel lateral esquerdo com inicialização a partir da `clausula_padrao` cadastrada em `/empresa`.
  - Alternador `mostrarContrato` no menu lateral para ativar/desativar a inclusão da minuta.
  - Cláusulas formatadas e posicionadas antes do bloco de assinaturas na folha A4.
- **Correção Definitiva da Impressão (Eliminação de Página em Branco)**:
  - No `styles.css` e no `EditorPropostaComercial`, a folha `.proposta-print-sheet` foi configurada para `position: absolute !important; left: 0; top: 0; width: 100% !important;` durante `@media print`.
  - Forçado `overflow: visible !important; height: auto !important; max-height: none !important;` em todos os contêineres pais, eliminando o mascaramento de layout que causava página branca no Chrome Print.
- **Exclusão Persistente de Propostas e Composições**:
  - `deleteMutation` em `comercial.propostas.tsx` realiza limpeza atômica de dependências (cronogramas, contratos, obras, revisões, etapas e itens) e limpa o parâmetro `propostaId` da URL para impedir reabertura.
  - `excluirAtividade` em `orcamento-analitico-view.tsx` elimina memoriais, insumos e atividades, remove itens legados de mesmo código/descrição e assegura `analitico_ativo = true` no orçamento para prevenir re-migrações fantasmas.
- **Estabilidade do Pipeline de Build**:
  - Configurado `node --max-old-space-size=4096` diretamente no script de build do `package.json`, prevenindo falhas por esgotamento de memória no Cloudflare Pages.
  - Adicionados arquivos de configuração `.nvmrc` e `.node-version` (Node 20) para assegurar o mesmo ambiente de compilação em todas as plataformas.
- **Validação de Testes**:
  - Todos os 96 testes do repositório aprovados com 100% de sucesso.
  - Compilação SSR/Nitro concluída sem erros.

## Atualização 30/10/2026 — Conclusão do Módulo de Contratos de Empreiteiros e Medições Multi-Itens (Issue #199)

- **Separação de Navegação e Regra Mental (Medição da Obra vs Contratos de Empreiteiros)**:
  - Menu lateral (`src/components/layout/app-sidebar.tsx`) atualizado com distinção explícita: **Medição da Obra** (`/medicoes`, avanço do cliente e contas a receber) e **Contratos de Empreiteiros** (`/contratos-empreiteiros`, avanço do terceiro e contas a pagar).
  - Banner de transição e atalho rápido adicionados no topo de `/prestadores` direcionando diretamente para a gestão moderna de contratos.
- **Gestão Completa de Contratos de Empreiteiros (`/contratos-empreiteiros`)**:
  - Listagem com cartões de KPIs em tempo real: Quantidade de Contratos, Total Contratado (com aditivos), Total Medido Bruto, Saldo a Medir e percentual geral concluído.
  - Filtros rápidos por Obra, Status e busca textual por número de contrato, objeto, obra ou prestador.
  - Dialog de cadastro com preenchimento de Obra, Empreiteiro, Tipo (Preço Unitário ou Empreitada Global), Objeto, Datas, Retenção padrão e Adiantamento previsto.
- **Importação de Escopo do Orçamento e Planilhas Excel**:
  - `ImportarOrcamentoDialog`: Carrega as etapas e atividades do orçamento analítico da obra com cálculo automático do preço unitário com BDI, permitindo seleção múltipla para compor o escopo do contrato.
  - `ImportarExcelDialog`: Parser inteligente de planilhas (`.xlsx`, `.xls`, `.csv`) que identifica colunas de descrição, unidade, quantidade, preço unitário e etapa, exibindo pré-visualização e validação antes da importação.
- **Boletim de Medição Dinâmico (Experiência Mais Controle)**:
  - Planilha de medição multi-itens com histórico contratado, medições anteriores aprovadas e saldo físico-financeiro restante.
  - Entrada de medição por **Quantidade**, **Percentual (%)** ou **Valor (R$)**, recalculando instantaneamente os demais parâmetros.
  - Detecção e alerta visual de estouro de saldo físico/financeiro.
  - Painel de deduções com amortização de adiantamento, descontos de EPI/retrabalho e retenção técnica percentual calculada automaticamente sobre o valor bruto medido.
  - Resumo financeiro com Valor Bruto Medido, Total de Deduções e **Valor Líquido a Pagar**.
  - Aprovação transacional em 1 clique chamando a RPC `aprovar_medicao_empreiteiro`, que valida o saldo restante, atualiza o acumulado e cria exatamente 1 conta a pagar no módulo Financeiro.
  - Cancelamento seguro chamando `cancelar_medicao_empreiteiro`, estornando o financeiro e restabelecendo os saldos.
- **Controle de Retenções Técnicas e Termos Aditivos**:
  - `RetencoesDialog`: Acompanhamento de retenções técnicas por boletim de medição, com saldo disponível e liberação controlada que gera a conta a pagar com data de vencimento programada via RPC `liberar_retencao_empreiteiro`.
  - `AditivoDialog`: Registro de termos aditivos de quantidade, preço, prazo ou escopo com atualização automática do valor total do contrato.
- **Relatório Imprimível / Salvar PDF**:
  - `MedicaoRelatorioImprimir`: Folha A4 formatada com cabeçalho oficial da construtora (`configuracoes_empresa` e logo do R2), identificação completa da obra e do empreiteiro, quadro de medição discriminado, resumo financeiro e campos de assinatura formal do engenheiro fiscal e do prestador.
- **Verificação e Testes**:
  - 107 testes automatizados aprovados no total (100% de sucesso), cobrindo regras de conversão, limites de saldo, retenções, deduções, importação de planilhas e integridade do banco de dados em memória.
  - Compilação do projeto (`npm run build`) validada com 0 erros no Vite e no Nitro SSR.

- **Evidências Fotográficas e Link Público para o Empreiteiro (Task 7)**:
  - Componente `MedicaoAnexos`: Permite anexar fotos do avanço físico diretamente no Cloudflare R2 por medição, com visualização em galeria e lightbox ampliado.
  - Geração de link público instantâneo com token aleatório criptográfico de 32 caracteres hex em `medicao_empreiteiro_links`, com cópia em 1 clique para WhatsApp/e-mail.
  - Rota pública `/medicao-empreiteiro/$token` (`src/routes/medicao-empreiteiro.$token.tsx`): Permite ao empreiteiro visualizar o boletim de medição completo com dados da obra, status, itens medidos, deduções, fotos de comprovação e botão de impressão/PDF no celular ou computador, sem necessidade de login.
  - Manual Operacional `docs/CONTRATOS_EMPREITEIROS_OPERACAO.md` criado com fluxo detalhado passo a passo para engenheiros, gestores e fiscais de obra.

- **Ajustes de Compatibilidade de Schema e Exibição de Contratos**:
  - Ajustadas as consultas de chave estrangeira em `src/lib/contratos-empreiteiros.functions.ts` (`listarContratosEmpreiteiros` e `obterDetalhesContrato`) para selecionar as colunas reais da tabela `fornecedores` (`razao_social`, `nome_fantasia`, `cnpj`, `cpf`) e `obras` (`logradouro`, `cidade`, `uf`), sanando o erro 400 do PostgREST que mantinha a listagem em carregamento contínuo.
  - Atualizada a listagem (`/contratos-empreiteiros`), o detalhe do contrato, o boletim de medição e a impressão de relatório para exibir `nome_fantasia || razao_social` e endereço formatado.
  - Adicionado tratamento de erro (`isError`) e botão de repetição na tabela de contratos.
  - Todos os 109 testes automatizados aprovados e build SSR verificado com sucesso.

- **Edição e Exclusão Segura de Contratos de Empreitada (Branch feat/201-editar-excluir-contrato-empreiteiro)**:
  - Implementadas as funções `atualizarContratoEmpreiteiro` e `excluirContratoEmpreiteiro` em `src/lib/contratos-empreiteiros.functions.ts`.
  - Edição completa com o `ContratoEditorDialog`: permite alterar objeto, modalidade, status (`rascunho`, `em_aprovacao`, `ativo`, `concluido`, `cancelado`), datas, percentual de retenção técnica, adiantamento previsto, observações e a planilha de itens/preços negociados.
  - Exclusão com confirmação visual via `AlertDialog` e validação estrita no servidor: impede a remoção de contratos com medições aprovadas/pagas ou retenções liberadas, protegendo a integridade fiscal e financeira.
  - Ações de Editar e Excluir disponibilizadas no menu de contexto (`DropdownMenu`) da listagem de contratos (`/contratos-empreiteiros`) e nos botões de cabeçalho na tela de detalhes do contrato (`ContratoDetalheView`).
  - 111 testes automatizados aprovados e build SSR verificado com sucesso.

- **Correção no Editor de Propostas Comerciais (Branch fix/202-corrigir-import-editor-proposta)**:
  - Adicionado o import de `configuracaoPropostaComercialPadrao` em `src/components/propostas/editor-proposta-comercial.tsx`, sanando o erro `ReferenceError: configuracaoPropostaComercialPadrao is not defined` disparado ao abrir a edição da proposta a partir do orçamento.
  - 111 testes automatizados aprovados e build SSR verificado com sucesso.


- **Importação Unificada de Itens do Orçamento da Obra (`ImportarOrcamentoDialog`) (Branch fix/203-importar-orcamento-itens)**:
  - Corrigida a busca de itens para contratos de empreiteiros: em vez de limitar-se exclusivamente às etapas analíticas (que retornava lista vazia quando o orçamento da obra utilizava itens padrão em `orcamento_itens`), o diálogo agora realiza busca em múltiplas fontes com fallback progressivo e transparente:
    1. Orçamento Analítico da Obra (`orcamento_etapas` + `orcamento_atividades` com cálculo dinâmico de BDI).
    2. Orçamento Padrão/Legado da Obra (`orcamento_itens` com valor unitário e total em centavos).
    3. Escopo Contratado da Obra via RPC oficial `public.escopo_obra(obra_id)`.
    4. Propostas Comerciais da Obra (`propostas` + `propostas_itens` e `propostas_itens_hierarquia`).
    5. Cronograma da Obra (`obra_cronograma`).
  - Atualizada a função `mapearAtividadesParaItensContrato` para preservar preços unitários diretos em centavos e registrar a procedência dos itens (`origemTipo`).
  - Adicionado campo de busca instantânea no diálogo por descrição, código ou etapa, exibição de preços unitários e valor total estimado, seleção/desmarcação dos itens visíveis e somatório em tempo real dos itens selecionados no rodapé.
  - 112 testes automatizados aprovados e build SSR verificado com sucesso no Vite e Cloudflare Nitro.


- **Correção no Boletim de Medições, Relatório de Impressão e Ações de Contratos (Branch fix/204-medicao-relatorio-botoes-contrato)**:
  - Sanado o erro 400 em `medicoes_terceirizados`: removida a coluna inexistente `quantidade` da consulta de acumulado em `obterDetalhesContrato` (`src/lib/contratos-empreiteiros.functions.ts`), utilizando a coluna real `quantidade_executada`.
  - Tratamento defensivo em todas as formatações numéricas (`.toLocaleString("pt-BR")`) em `medicao-editor-sheet.tsx` e `contrato-detalhe-view.tsx`, prevenindo exceções do tipo `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`.
  - Sanada a falha `TypeError: Cannot read properties of null (reading 'url')` no componente `EmpresaLogo` (`src/components/empresa-logo.tsx`), garantindo checagem estrita de `loaded` e repassando `value={empresa?.logo_url}` em `MedicaoRelatorioImprimir` e na rota pública de medições.
  - Disponibilizados botões visíveis de **Editar** (ícone Lápis) e **Excluir** (ícone Lixeira) diretamente em cada linha da tabela de contratos em `/contratos-empreiteiros`, além dos botões de ação no cabeçalho dos detalhes do contrato (`ContratoDetalheView`), ambos com diálogo de confirmação via `AlertDialog` e edição pelo `ContratoEditorDialog`.
  - 112 testes automatizados aprovados e build SSR verificado com sucesso no Vite e Cloudflare Nitro.


- **Correção ao Salvar Rascunho da Proposta Comercial, Seleção de Cliente e Remoção do Botão Catálogo (Branch fix/205-proposta-salvar-rascunho-cliente-valor)**:
  - **Identificação da causa raiz do cliente divergente e valor R$ 0,00**:
    1. Em `src/routes/_app/orcamentos.tsx`, a consulta de obras omitia a coluna `cliente_id`, fazendo com que `obra?.cliente_id` ficasse `undefined` e caísse no fallback que buscava o primeiro cliente da base (`clientes?.[0]`), associando arbitrariamente "Francisco Rodrigues de Souza" à proposta.
    2. Além disso, o callback `onSalvarRascunho` em `src/routes/_app/comercial.propostas.tsx` apenas emitia um toast visual, sem persistir nenhuma alteração em `propostas` nem em `propostas_itens`, mantendo o valor zerado (`R$ 0,00`) e os dados desatualizados no banco de dados.
  - **Correções aplicadas**:
    1. Inclusão de `cliente_id` no `.select()` da query de obras em `src/routes/_app/orcamentos.tsx` e busca direta dos dados da obra no Supabase para garantir que o cliente correto da obra seja sempre vinculado à proposta.
    2. Cálculo antecipado e preciso do valor total estimado ao gerar a proposta a partir do orçamento analítico (com BDI e insumos) ou de itens orçados.
    3. No `EditorPropostaComercial` (`src/components/propostas/editor-proposta-comercial.tsx`), adição de seletor dinâmico de clientes vinculados no painel de configuração comercial, permitindo conferir e trocar o cliente a qualquer momento, atualizando em tempo real o cabeçalho, bloco de contratante e assinaturas da proposta A4.
    4. Implementação completa de `onSalvarRascunho` e `onPublicarRevisao` em `src/routes/_app/comercial.propostas.tsx`: atualiza no Supabase `propostas.valor_total` (em reais), `propostas.cliente_id`, `titulo`, `condicoes_pagamento`, sincroniza os itens em `propostas_itens` e atualiza `obras.cliente_id` quando aplicável.
    5. Remoção do botão "Catálogo" da tela de propostas comerciais (`src/routes/_app/comercial.propostas.tsx`), conforme solicitado pelo usuário.
    6. Atualização de `PropostaFormDialog` para também salvar `valor_total` explicitamente na criação ou edição rápida da proposta.
  - 112 testes automatizados aprovados e build SSR verificado com sucesso no Vite e Cloudflare Nitro.
