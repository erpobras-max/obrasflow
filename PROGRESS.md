# ObrasFlow ERP — estado do projeto

Atualizado em 24/10/2026. Este arquivo registra o estado conhecido no código, no banco publicado e nas entregas recentes do sistema.

## 1. Rotas e páginas

As rotas principais estão implementadas com TanStack Router. As páginas protegidas ficam em `src/routes/_app`; os portais, login, assinatura e imóveis públicos ficam fora desse agrupamento.

| Área              | Rotas                                                                                                                                                               | Estado                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Acesso            | `/auth`, `/forgot-password`, `/reset-password`                                                                                                                      | Completo                                  |
| Painel            | `/`, `/dashboard`, `/empresa`, `/perfil`, `/usuarios`                                                                                                               | Completo                                  |
| Comercial         | `/comercial`, `/comercial/clientes`, `/comercial/propostas`, `/comercial/contratos`, `/comercial/licitacoes`                                                        | Completo                                  |
| Obras             | `/obras`, `/cronograma`, `/diario`, `/medicoes`, `/documentos`, `/relatorios`, `/projeto3d/$id`                                                                     | Completo                                  |
| Operacional       | `/compras`, `/cotacoes`, `/prestadores`, `/estoque`, `/equipamentos`, `/orcamentos`, `/fiscal`, `/importacoes`, `/vendas/pedidos`, `/rh`, `/ponto`                  | Completo                                  |
| Financeiro        | `/financeiro`, `/imobiliaria/financeiro`                                                                                                                            | Completo, com separação civil/imobiliária |
| Imobiliária       | `/imobiliaria`, `/imobiliaria/dashboard`, `/imobiliaria/clientes`, `/imobiliaria/imoveis`, `/imobiliaria/locacoes`, `/imobiliaria/espacos`, `/imobiliaria/fiadores` | Completo, incluindo espaços por período   |
| Portal do cliente | `/portal`, `/portal/contratos`, `/portal/documentos`, `/portal/financeiro`, `/portal/fotos`, `/portal/projeto`                                                      | Completo                                  |
| Acesso público    | `/assinar/$token`, `/cotacao/$token`, `/imovel-publico/$token`, `/reservar/$token`                                                                                  | Completo                                  |

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

Entregue em 19/10/2026 e estabilizado em produção em 24/10/2026. Transforma cada obra do ObrasFlow em um ambiente de engenharia paramétrica e apresentação visual. O editor cobre o fluxo arquitetônico básico do ObrasFlow, mas não possui paridade completa com AutoCAD ou CADCraft.

### Funcionalidades implementadas:

1. **Modelagem 2D CAD Paramétrica (CADCraft no `/projeto3d/$id`)**:
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
   - **Importador DXF**: leitura nativa de linhas e polilinhas da seção `ENTITIES` de arquivos AutoCAD ASCII, com normalização de escala, descarte de segmentos degenerados e enquadramento automático da planta.
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

### Estabilização publicada em 24/10/2026

- Ambientes podem ser selecionados e excluídos definitivamente pela borracha ou pelas teclas `Delete`/`Backspace`; o piso 3D e os quantitativos relacionados deixam de ser gerados, sem apagar as paredes.
- O arquivo real `predio.dxf` usado na validação caiu de 61.602 segmentos incorretamente interpretados para 80 paredes úteis, com limites aproximados de 16,41 × 14,51 m.
- O canvas 2D enquadra o desenho importado e a câmera 3D calcula alvo e distância conforme os limites da planta.
- Ao sair e retornar ao Projeto 3D, o editor volta a hidratar o estado mesmo quando o React Query fornece dados do cache; não é mais necessário usar F5.
- O viewport observa o tamanho do contêiner e libera animação, geometrias, materiais, canvas e contexto WebGL ao desmontar.
- As correções foram entregues pelas PRs #120, #123 e #124, sem migration de banco.

### Decisão sobre implementar um CADCraft completo

**Três motivos para não implementar uma cópia completa agora:**

1. O custo de reproduzir um CAD profissional é alto: seleção avançada, cotas, blocos, layers, arcos, curvas, precisão geométrica, impressão em escala e compatibilidade de arquivos exigem manutenção contínua.
2. A complexidade aumentaria o risco de regressões, perda de desempenho no navegador e dificuldade de uso para clientes que precisam apenas criar uma planta e obter quantitativos.
3. Uma cópia fiel da interface, marca ou comportamento de um produto de terceiros pode criar riscos de propriedade intelectual e manter o ObrasFlow preso às decisões desse produto.

**Três motivos para evoluir o editor até uma solução CAD mais completa:**

1. O usuário permanece no mesmo fluxo de obra, orçamento, quantitativos, diário e portal, sem alternar entre diversos programas ou redigitar informações.
2. Um editor próprio pode transformar diretamente a geometria em materiais, custos, BDI, cronograma e apresentação 3D, criando uma vantagem específica do ObrasFlow.
3. Equipes menores podem trabalhar com uma ferramenta web padronizada, sem depender de instalações locais e licenças CAD adicionais para tarefas arquitetônicas básicas.

**Direção recomendada:** não copiar integralmente outro produto. Evoluir o editor próprio em fases, priorizando recursos confirmados por projetos reais — cotas editáveis, layers, seleção múltipla, copiar/colar, mover/rotacionar com precisão, blocos reutilizáveis e impressão em escala — antes de recursos especializados de CAD generalista.

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
   - **Correção de layout**: Corrigido `TabsList` no modal `ObraFormDialog` de `grid-cols-3` para `grid-cols-4` (comportando perfeitamente as 4 abas: _Dados_, _Cronograma_, _ITRs_, _Endereço_).
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

- **Commit**: `44e55990fc428ab7052a4374b980f969f043284f` — correção da reentrada no Projeto 3D, sobre as correções de exclusão de ambientes e importação DXF.
- **Branch**: `main`.
- **Validação**: `npm run build`, ESLint dos componentes alterados, teste automatizado do parser e validação com `predio.dxf`.
- **Deploy**: publicação concluída no Cloudflare Worker `obrasflow` pela execução GitHub Actions `40123630012`; `/imobiliaria/espacos` respondeu HTTP 200 após o deploy.
- **Aviso de infraestrutura**: o GitHub Actions informou que ações ainda declaradas para Node.js 20 estão sendo executadas em Node.js 24; atualizar as versões das actions deve ser tratado separadamente.

---

## 23. Pendências prioritárias após esta atualização

- Executar testes de aceitação visual com os usuários engenheiros desenhando plantas reais de casas no estúdio 2D.
- Priorizar a próxima fase do editor com base nesses testes: cotas editáveis, layers, seleção múltipla, copiar/colar, transformações precisas, blocos reutilizáveis e impressão em escala.
- Adicionar opção de salvar templates de cômodos frequentes (ex.: banheiro padrão 1,5 × 2,5 m).
- Ampliar a compatibilidade DXF somente a partir de arquivos reais que falharem; o importador atual cobre `LINE` e `LWPOLYLINE` em DXF ASCII, não todos os tipos de entidade do AutoCAD.
- Regenerar `src/integrations/supabase/types.ts` a partir do schema publicado com o Supabase CLI quando disponível.

