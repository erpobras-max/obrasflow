# ObrasFlow ERP — estado do projeto

Atualizado em 28/09/2026. Este arquivo registra o estado conhecido no código e as entregas recentes do sistema.

## 1. Rotas e páginas

As rotas principais estão implementadas com TanStack Router. As páginas protegidas ficam em `src/routes/_app`; os portais, login, assinatura e imóveis públicos ficam fora desse agrupamento.

| Área              | Rotas                                                                                                                                       | Estado                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Acesso            | `/auth`, `/forgot-password`, `/reset-password`                                                                                              | Completo                                  |
| Painel            | `/`, `/dashboard`, `/empresa`, `/perfil`, `/usuarios`                                                                                       | Completo                                  |
| Comercial         | `/comercial`, `/comercial/clientes`, `/comercial/propostas`, `/comercial/contratos`, `/comercial/licitacoes`                                | Completo                                  |
| Obras             | `/obras`, `/cronograma`, `/diario`, `/medicoes`, `/documentos`, `/relatorios`                                                               | Completo                                  |
| Operacional       | `/compras`, `/estoque`, `/equipamentos`, `/orcamentos`, `/fiscal`, `/importacoes`, `/vendas/pedidos`, `/rh`, `/ponto`                       | Completo                                  |
| Financeiro        | `/financeiro`, `/imobiliaria/financeiro`                                                                                                    | Completo, com separação civil/imobiliária |
| Imobiliária       | `/imobiliaria`, `/imobiliaria/dashboard`, `/imobiliaria/clientes`, `/imobiliaria/imoveis`, `/imobiliaria/locacoes`, `/imobiliaria/fiadores` | Completo                                  |
| Portal do cliente | `/portal`, `/portal/contratos`, `/portal/documentos`, `/portal/financeiro`, `/portal/fotos`                                                 | Completo                                  |
| Acesso público    | `/assinar/$token`, `/imovel-publico/$token`                                                                                                 | Completo                                  |

Os arquivos de agrupamento (`/comercial`, `/imobiliaria` e `/portal`) funcionam como layouts/índices. Não há placeholder vazio conhecido entre as rotas listadas.

## 2. Dados usados por página

As páginas consultam o Supabase diretamente por meio do cliente em `src/integrations/supabase`. As principais relações conferidas são:

- Clientes usam `clientes`, `user_roles` e dados relacionados a propostas, contratos e obras; criam, atualizam e removem clientes conforme a permissão.
- Propostas usam `propostas`, `propostas_itens`, catálogo de produtos/serviços e `clientes`; criam, atualizam e alteram o status da proposta.
- Contratos usam `contratos`, `clientes`, `obras`, `propostas` e tabelas de assinatura/link; leem, atualizam status e registram assinaturas.
- Obras usam `obras`, `clientes`, `propostas`, `obra_cronograma` e dados de responsável técnico; criam e atualizam obras.
- Cronograma usa `obras` e `obra_cronograma`; inclui, edita, reordena e exclui etapas. A exclusão do cronograma inteiro continua separada da exclusão individual.
- Medições usam `medicoes`, itens de medição, `obras`, `propostas_itens` e dados financeiros relacionados; registram avanço e valores.
- Financeiro civil usa contas, receitas, despesas, categorias, pedidos e dados de obras. O financeiro imobiliário usa as tabelas próprias de locações, parcelas, taxas e índices.
- Imobiliária usa `imoveis`, `imovel_fotos`, `locacoes`, `imob_vistorias`, `imob_vistorias_itens`, `imob_indices_reajuste`, clientes e fiadores.
- Portal usa o cliente autenticado e filtra contratos, documentos, fotos, cronogramas e lançamentos vinculados ao cliente.

As consultas de estoque e tabelas financeiras devem continuar sendo conferidas contra o schema publicado sempre que uma migration for aplicada, pois existem migrations históricas com nomes de tabelas que foram corrigidos posteriormente.

## 3. Migrations

As migrations ficam em `supabase/migrations` e devem ser aplicadas em ordem pelo Supabase CLI. O histórico atual inclui criação de usuários, obras, diário, medições, estoque, financeiro, dashboard, compras, fiscal, RH, propostas, catálogo, imobiliária, vistorias, índices, cargos, portais, contratos, assinaturas, logo da empresa, ponto e correções de RLS.

As entregas mais recentes são:

- `20260927000003_corrigir_rls_obra_cronograma.sql`: cria/corrige tabela, grants e políticas de leitura, inclusão, edição e exclusão do cronograma.
- `20260927000005_exibir_contrato_no_link_assinatura.sql`: disponibiliza o contrato no fluxo público de assinatura.
- `20260927000006_cronograma_automatico_proposta.sql`: cria o cronograma quando a obra/proposta é aceita e importa etapas.
- `20260928000000_cronograma_etapas_proposta.sql`: vincula etapas à origem da proposta, evita duplicidade e permite importação posterior de novos serviços.

As melhorias de nome, inclusão, exclusão individual e ordenação das etapas não exigem nova migration; usam `obra_cronograma.ordem` e as colunas já existentes.

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

- O build do GitHub já passou nas alterações recentes do cronograma.
- O deploy do Cloudflare já apresentou `No access to the specified service` para o Worker `obrasflow`; isso indica problema de permissão ou conta do segredo `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, não erro do build.
- O ambiente local pode mostrar avisos de versão do Node e vulnerabilidades do `npm audit`; devem ser tratados separadamente para não misturar atualização de dependências com regras de negócio.
- Consultas antigas de estoque/financeiro podem retornar 400/404 quando o banco ainda não recebeu todas as migrations correspondentes.

## 8. Cronograma — funcionamento atual

Quando uma proposta aceita gera ou atualiza uma obra, suas etapas são importadas para `obra_cronograma`. Cada etapa possui nome, ordem, datas previstas, meta percentual, progresso realizado e situação calculada.

Na tela `/cronograma`, usuários de engenharia, diretor ou admin podem:

1. adicionar uma etapa manual com nome, período e meta;
2. editar nome, datas, meta e avanço;
3. mover a etapa para cima ou para baixo;
4. excluir uma etapa individual com confirmação;
5. gerar o relatório detalhado do cronograma.

Admin e diretor também podem excluir todo o cronograma da obra. A operação não remove a obra, a proposta nem as medições. A ordem salva é usada na consulta do cronograma, no portal do cliente e nos relatórios.

## 9. Estrutura principal

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

