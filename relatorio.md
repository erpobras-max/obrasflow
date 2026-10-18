# Relatório de Análise do Sistema — ObrasFlow ERP

Data: 17/10/2026
Branch analisada: `main` (working tree limpa)

---

## 1. Resumo executivo

O **ObrasFlow** é um ERP de construção civil e imobiliária construído como aplicação web full-stack sobre **TanStack Start** (React 19 + SSR via Nitro em Cloudflare Workers), com **Supabase** (PostgreSQL + Auth + RLS) como backend de dados e **Cloudflare R2** como armazenamento de arquivos.

O sistema é maduro e amplo: cobre o ciclo comercial (propostas → contratos → obras), execução (cronograma, diário, medições), operacional (compras, cotações, prestadores, estoque com QR, equipamentos, RH, ponto), financeiro (civil e imobiliário separados) e um portal do cliente com links públicos de assinatura/cotação/imóvel.

A base de código está **organizada e documentada** (`AGENTS.md`, `DESIGN.md`, `PROGRESS.md`), com forte uso de RLS, validação por Zod e um modelo de papéis bem definido. Os principais riscos concentram-se na **governança das migrations** (histórico parcialmente aplicado fora do repositório) e em alguns **artefatos de deploy legados/divergentes**.

---

## 2. Visão geral

| Aspecto | Detalhe |
|---|---|
| Tipo | ERP (construção civil + imobiliária) |
| Nome interno do pacote | `tanstack_start_ts` |
| Origem do scaffold | Lovable (template `tanstack_start_ts_2026-05-29`) |
| Linguagem | TypeScript 5.8 (strict) |
| Runtime de produção | Cloudflare Workers (Nitro adapter) |
| Banco de dados | Supabase (PostgreSQL) — projeto `supejqjocgnwhigppyeb` |
| Armazenamento | Cloudflare R2 (bucket `erpobras`) |
| Observabilidade | New Relic (browser agent) |
| UI | shadcn/ui + Radix + Tailwind CSS v4 |

---

## 3. Stack tecnológica

### Frontend / SSR
- **React 19.2** + **React DOM 19.2**
- **TanStack Start 1.167**, **TanStack Router 1.168**, **TanStack Query 5.83**
- **Vite 7.3** + plugin `@lovable.dev/vite-tanstack-config` (configuração centralizada, não duplicar plugins)
- **Nitro 3.0.260603-beta** (adaptador Cloudflare Workers)
- **Tailwind CSS 4.2** + `tw-animate-css`

### Componentes e formulários
- **shadcn/ui** (~48 componentes em `src/components/ui/`) sobre **Radix UI**
- **react-hook-form 7.71** + **zod 3.24** + `@hookform/resolvers`
- **lucide-react**, **sonner** (toasts), **vaul** (drawer), **embla-carousel-react**, **cmdk**

### Dados e integrações
- **@supabase/supabase-js 2.107**
- **@aws-sdk/client-s3** + **s3-request-presigner** (acesso ao R2 compatível com S3)
- **xlsx** (SheetJS, via CDN) e **papaparse** (importação Bling)
- **jszip** (compactação de documentos)

### Visualização / utilidades
- **recharts**, **date-fns**, **class-variance-authority**, **clsx**, **tailwind-merge**

### Qualidade
- **Playwright** (e2e desktop + mobile), **ESLint 9** + **Prettier**
- **@newrelic/browser-agent** para observabilidade

### Gerenciadores de pacote
Coexistem **dois lockfiles**: `package-lock.json` (npm) e `bun.lock` (Bun), além de `bunfig.toml`. O CI de deploy usa `npm ci`; o workflow de segurança usa `bun install --frozen-lockfile`.

---

## 4. Arquitetura

### 4.1 Modelo de execução
Aplicação SSR/SPA híbrida. O frontend roda no navegador e também é servido pelo Worker via Nitro (`vite build` gera `.output/`). O serviço SSR é corrigido por um script pós-build (`scripts/patch-nitro-cloudflare-env.mjs`) que injeta `globalThis.__env__` para que os bindings do Cloudflare cheguem às server functions.

### 4.2 Acesso a dados
Dois caminhos distintos, ambos via Supabase:

1. **Cliente de navegador** (`src/integrations/supabase/client.custom.ts`): usa a **publishable key** (pública), com persistência de sessão em `localStorage` e tratamento de clock skew (`retry-clock-skew.ts`). É um `Proxy` com inicialização lazy.
2. **Servidor** (`src/integrations/supabase/client.server.custom.ts`): usa a **service role key** (`MY_SUPABASE_SERVICE_ROLE_KEY`) lida de `globalThis.__env__` / `cloudflare:workers` / `process.env`, para operações administrativas.

### 4.3 Server Functions
As operações que exigem autenticação no servidor usam `createServerFn` do TanStack Start com:

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.custom.ts`): valida o token Bearer via `supabase.auth.getClaims(token)` e injeta `userId` e `claims` no contexto.
- Validação de entrada com **Zod** (`.inputValidator`).

Exemplo representativo: `src/lib/importacoes.functions.ts` (importação de clientes/produtos/pedidos/contas em lotes).

> Observação: nas server functions de importação, as operações de escrita usam o **cliente autenticado do usuário** (contexto), não a service role — ou seja, o RLS continua valendo. Algumas regras dependem de **triggers no banco** (ex.: redução de estoque ao marcar pedido como "atendido", disparada por um update "dummy" — padrão frágil, ver seção 10).

### 4.4 Autenticação e autorização

- **Autenticação**: Supabase Auth (e-mail/senha). Há suporte a login por **CPF/CNPJ** para clientes (migrations `*_cpf_cnpj_login`) e um fluxo especial de **ponto por CPF sem senha** (`20261014000006_ponto_por_cpf_sem_auth.sql`).
- **Cargos/papéis** (`src/lib/permissions.ts`):

| Papel | Módulos principais |
|---|---|
| `admin` | tudo + `usuarios`, `ponto` |
| `diretor` | tudo + `ponto` |
| `financeiro_civil` | financeiro, fiscal, estoque, compras, prestadores, orçamentos, medições, relatórios, produtos, vendas, importações, ponto |
| `financeiro_imobiliaria` | financeiro imobiliário, fiscal, imobiliária, relatórios, documentos, ponto |
| `compras` | compras, prestadores, estoque, orçamentos, documentos, produtos |
| `engenharia` | obras, comercial, orçamentos, diário, medições, cronograma, prestadores, equipamentos, documentos, relatórios |
| `almoxarifado` | estoque, compras, equipamentos, documentos, produtos |
| `rh` | rh, documentos, relatórios, ponto |
| `cliente` | dashboard, obras, documentos |
| `funcionario` | ponto |
| `imobiliaria` | dashboard, imobiliária |

- **RLS**: políticas extensas por `auth.uid()` e `has_role`, com separação explícita entre financeiro civil e imobiliário, e entre equipe e cliente.

### 4.5 Armazenamento
Arquivos (documentos, fotos de imóveis, anexos de cotações) vão para o **R2** via SDK da AWS. A configuração de produção (endpoint, bucket, credenciais) é documentada em `docs/cloudflare-variaveis.md`.

---

## 5. Estrutura do repositório

```text
src/
  components/       Componentes de módulo + ui/ (shadcn)
  hooks/            use-auth, use-cotacoes, use-portal-context, use-mobile
  integrations/     Cliente Supabase (client, server, auth, types)
  lib/              Regras de negócio, schemas Zod, server functions, R2
  routes/           Rotas (TanStack Router), _app (protegido), portal, públicos
supabase/
  migrations/       90 arquivos de evolução do schema + RLS
  functions/        (não versionado — sem Edge Functions neste checkout)
  config.toml       project_id do Supabase
db/                 SQL avulso/legado (cronograma, estoque, itr, medição, notificações, rls)
tests/              e2e (Playwright) + testes .test.mjs
docs/               cloudflare-variaveis, observability, WEB_INTERFACE_REVIEW
.github/workflows/  deploy.yml, security.yml
```

Arquivos na raiz de nota: `consolidated_setup.sql`, `fix_contrato.py`, `fix_proposta.py` (scripts pontuais legados), `netlify.toml` (deploy legado, ver seção 8), `wrangler.jsonc`.

---

## 6. Módulos e rotas

| Área | Rotas |
|---|---|
| Acesso | `/auth`, `/forgot-password`, `/reset-password` |
| Painel | `/`, `/dashboard`, `/empresa`, `/perfil`, `/usuarios` |
| Comercial | `/comercial`, `/comercial/clientes`, `/comercial/propostas`, `/comercial/contratos`, `/comercial/licitacoes` |
| Obras | `/obras`, `/cronograma`, `/diario`, `/medicoes`, `/documentos`, `/relatorios` |
| Operacional | `/compras`, `/cotacoes`, `/prestadores`, `/estoque`, `/estoque/movimentacao`, `/equipamentos`, `/orcamentos`, `/fiscal`, `/importacoes`, `/vendas/pedidos`, `/rh`, `/ponto` |
| Financeiro | `/financeiro` (civil), `/imobiliaria/financeiro` |
| Imobiliária | `/imobiliaria`, `/imobiliaria/dashboard`, `/imobiliaria/clientes`, `/imobiliaria/imoveis`, `/imobiliaria/locacoes`, `/imobiliaria/fiadores` (e `/imobiliaria/vendas` documentada) |
| Portal do cliente | `/portal`, `/portal/contratos`, `/portal/documentos`, `/portal/financeiro`, `/portal/fotos` |
| Acesso público | `/assinar/$token`, `/cotacao/$token`, `/imovel-publico/$token` |

Destaques de negócio implementados:

- **Propostas hierárquicas** com catálogo de etapas/acabamento e fluxo de aprovação.
- **Cronograma automático** gerado a partir da proposta aceita (`obra_cronograma`, com ordem, meta e progresso).
- **Cotações de compra** com convites por token, respostas públicas, comparativo, seleção de vencedor e geração de pedidos.
- **Prestadores de serviço** com múltiplos serviços, medições e geração de contas a pagar na aprovação.
- **Estoque com QR** (RPC `registrar_movimentacao_almoxarifado`, saldo por depósito/prateleira).
- **Contratos personalizáveis** (cláusulas JSONB) e assinatura pública manuscrita.

---

## 7. Banco de dados

### 7.1 Migrations
Há **90 arquivos** em `supabase/migrations/`, evoluindo de `20260604...` a `20261014...`. Principais áreas cobertas: usuários/papéis, obras, diário, medições, estoque, financeiro, dashboard, compras, fiscal, orçamentos, RH, propostas, catálogo, imobiliária, vistorias, índices, contratos/assinaturas, ponto e RLS.

### 7.2 Achados na numeração (importante)
A numeração (timestamp) apresenta **inconsistências** que afetam a ordem determinística de aplicação e a reconciliação via `supabase db push`:

- **Prefixos de versão duplicados:**
  - `20260923000000` — `_add_logo_empresa` **e** `_fix_service_role_cliente_link`
  - `20261013000005` — `_exclusao_admin_compras` **e** `_fix_solicitacao_itens_valor_estimado`
  - `20261014000006` — `_contas_receber_forma_pagamento` **e** `_ponto_por_cpf_sem_auth`
- **Lacunas** em sequências documentadas (migrations citadas no `PROGRESS.md` que **não existem** no repositório), por exemplo:
  - `20260928000004_fornecedores_dados_bancarios_e_permissoes`
  - `20260928000005_notificacoes_usuario`
  - `20261001000001_obra_funcionarios` / `20261001000002_funcionario_epi_custos_folha`
  - `20261005000001_corrigir_colunas_indices_bcb` / `20261005000002_imobiliaria_vendas`
  - `20261013000002_fornecedor_preferencial_solicitacao`

Isso é coerente com o próprio `PROGRESS.md`, que alerta que parte das migrations foi aplicada **manualmente no SQL Editor** e não consta em `supabase_migrations.schema_migrations`, recomendando **reconciliar o histórico do CLI antes de depender de `supabase db push`**.

### 7.3 Sem Edge Functions
Não há `supabase/functions/` versionado neste checkout. Funcionalidades que exigem agendamento (lembretes, envio automático de e-mail/WhatsApp, baixa automática) seguem como **pendências** dependentes de rotina agendada/provedor externo.

### 7.4 SQL avulso
`db/*.sql`, `consolidated_setup.sql` (raiz) e scripts `fix_*.py` sugerem correções/manutenção pontuais fora do fluxo versionado. Convém avaliar se representam dívida ou se devem ser incorporados/revisados.

---

## 8. Infraestrutura e deploy

### 8.1 Deploy (ativo)
`.github/workflows/deploy.yml` — dispara em push para `main` e `workflow_dispatch`:

1. Node 20 + `npm ci`
2. `npm run build` (`vite build` + patch do Nitro)
3. Validação de que a configuração pública do Supabase chegou ao bundle
4. `cloudflare/wrangler-action` com `deploy --config .output/server/wrangler.json`

### 8.2 Segurança (CI)
`.github/workflows/security.yml` — em PR e push para `main`:
- build com Bun (`bun install --frozen-lockfile`)
- `bun audit`
- higiene de repositório: bloqueia `.env` rastreado e faz scan de chaves privadas (`MY_SUPABASE_SERVICE_ROLE_KEY`, `R2_*`).

### 8.3 Achados de infraestrutura

- **`wrangler.jsonc` (raiz) desalinhado com o deploy real.** O arquivo aponta `main: dist/server/index.mjs` e `assets: dist/client`, mas o CI publica a partir de `.output/server/wrangler.json` (gerado pelo Nitro). O arquivo da raiz aparenta ser legado e pode confundir deploys manuais.
- **`netlify.toml` presente mas não usado** — configura um deploy Netlify (`bun run build` + `.netlify/functions/server`), enquanto a produção efetiva é Cloudflare. Dois alvos de deploy convivendo sem uso.
- **Duas cadeias de lockfile** (npm e Bun) podem gerar divergência de dependências entre CI e desenvolvimento local.
- **Chave publishable hardcoded como fallback** em `src/integrations/supabase/client.custom.ts`. É uma chave pública por design (equivalente à anon key), então não é segredo — mas é importante não tratar o arquivo como se contivesse segredo, e manter a service role estritamente em variável de ambiente (o que já é feito).

---

## 9. Qualidade, testes e documentação

- **Documentação forte**: `AGENTS.md` (fluxo de trabalho com Issue → branch → PR), `DESIGN.md` (linguagem de interface), `PROGRESS.md` (estado detalhado), `docs/WEB_INTERFACE_REVIEW.md`, `docs/observability.md`.
- **Testes**:
  - Playwright e2e (`tests/e2e/acesso-publico.spec.ts`) rodando em Chromium desktop e Pixel 7, apontando por padrão para `https://obrasflow.erpobras.workers.dev`.
  - Testes auxiliares `.test.mjs` (`cronograma-db`, `retry-clock-skew`, `empresa-logo`, `acesso-diagnostico`).
- **Lint/format**: ESLint 9 + Prettier (com plugins react-hooks, react-refresh, prettier).
- **Design system**: tokens semânticos OKLCH em `src/styles.css`, componente `ResponsiveTable` obrigatório para tabelas, padrões de responsividade sem rolagem horizontal.

---

## 10. Achados e riscos (priorizados)

### Alto
1. **Desalinhamento do histórico de migrations.** Aplicações manuais no banco publicado não estão no repositório (lacunas), e há prefixos duplicados. Risco de `supabase db push` sobrescrever ou falhar; risco de ambiente de homologação divergir da produção.
2. **Regras de negócio apoiadas em triggers disparadas por update "dummy"** (ex.: `importarPedidosVenda` faz `update({ updated_at })` para forçar o trigger de baixa de estoque). Padrão frágil, difícil de rastrear e testar.

### Médio
3. **Artifatos de deploy divergentes** (`wrangler.jsonc` da raiz vs `.output`, `netlify.toml` órfão) — risco de deploy manual incorreto.
4. **`src/integrations/supabase/types.ts` desatualizado** (o próprio `PROGRESS.md` registra a pendência de regenerar a partir do schema publicado), com casts locais espalhados — perda de segurança de tipos.
5. **Duplo lockfile (npm + Bun)** — potencial divergência de dependências entre CI e ambiente local.
6. **Pendências de negócio dependentes de infraestrutura externa**: envio automático de e-mail/WhatsApp, lembretes agendados (sem Edge Functions/cron), recebimento parcial de pedidos.

### Baixo
7. **Avisos de `npm audit` e de versão do Node** no ambiente local (documentados no `PROGRESS.md`).
8. **Scripts e SQL avulsos** na raiz/`db/` (`consolidated_setup.sql`, `fix_*.py`) sem dono claro no fluxo versionado.
9. **Assinatura digital sem trilha de auditoria/validade jurídica formal** (registrado como recomendação no `PROGRESS.md`).

---

## 11. Recomendações

1. **Reconciliar o histórico de migrations** antes de qualquer novo `db push`:
   - importar/registrar as migrations aplicadas manualmente;
   - renomear os arquivos com prefixo duplicado para timestamps únicos;
   - validar `supabase db reset`/`db push` em ambiente isolado.
2. **Padronizar o deploy**: remover ou corrigir `wrangler.jsonc` da raiz e o `netlify.toml` órfão para evitar divergência; documentar o único caminho (Cloudflare via `.output`).
3. **Regenerar `types.ts`** e remover os casts locais, recuperando segurança de tipos ponta a ponta.
4. **Unificar o gerenciador de pacotes** (npm **ou** Bun) nos scripts, CI e lockfiles.
5. **Substituir triggers disparadas por update "dummy"** por RPCs explícitas (padrão `SECURITY DEFINER`, já usado em outras partes do sistema).
6. **Priorizar as pendências de infraestrutura** (Edge Functions/cron para lembretes e envio de mensagens) que destravam automações de negócio.
7. **Decidir o destino dos SQLs/scripts avulsos** (`db/`, `consolidated_setup.sql`, `fix_*.py`): incorporar versionado ou remover.

---

## 12. Conformidade com o fluxo do repositório

Este arquivo foi gerado como artefato de análise, sem commit. De acordo com `AGENTS.md`, qualquer alteração de código/banco deve seguir: **Issue → branch própria a partir de `main` → desenvolvimento → validação → Pull Request com `Closes #<n>` → merge autorizado**. Para versionar este relatório (ou qualquer correção derivada dos achados acima), recomenda-se abrir a Issue correspondente e criar branch/PR dedicados, em vez de alterar `main` diretamente.
