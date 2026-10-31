# Medições de Obras com Motor Compartilhado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernizar Medição de Obras com o motor maduro de Empreiteiros, mantendo contas a receber e contas a pagar separadas, com aprovação segura, evidências, relatório configurável, indicadores e Portal do Cliente.

**Architecture:** Um núcleo TypeScript puro concentra tipos, conversões, saldos e máquina de estados. Medição de Obras e Medição de Empreiteiros usam adaptadores separados; a primeira migra para novos componentes compartilhados e a segunda preserva inicialmente sua UI. RPCs transacionais no Supabase controlam versões, aprovações, aceite e financeiro.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Supabase/PostgreSQL, Zod, Tailwind/Radix, Recharts, R2, Node Test Runner e PGlite.

**Spec:** `docs/superpowers/specs/2026-10-31-medicoes-motor-compartilhado-design.md`

## Global Constraints

- Medição de Obras gera somente contas a receber; Medição de Empreiteiros gera somente contas a pagar.
- Rascunho, devolvida e em conferência nunca alteram progresso ou financeiro definitivo.
- Valores monetários novos são inteiros em centavos; conversão de legado é explícita e testada.
- A fonte comercial padrão é o escopo materializado da proposta aceita e de sua revisão congelada.
- Aprovação, cancelamento, aceite e faturamento são RPCs transacionais, idempotentes e auditadas.
- Fotografias públicas não expõem custo interno, BDI interno, composições, salários ou fornecedores.
- Mudanças de banco são aditivas, possuem rollback documentado e passam em banco efêmero.
- Não remover tabelas, rotas ou relatórios legados antes da auditoria final de migração.
- Cada tarefa usa TDD, termina com testes verdes e um commit pequeno.
- Atualizar `PROGRESS.md` ao final de cada fase publicável.

## Review Focus

- Duas pessoas salvam o mesmo rascunho: o segundo salvamento deve falhar por `lock_version`, sem sobrescrever dados.
- Aprovação comercial é repetida após timeout: deve retornar o mesmo resultado e manter uma única conta a receber.
- Obra sem proposta aceita ou revisão publicada: criação deve ser bloqueada com orientação, sem escolher escopo silenciosamente.
- Medição histórica tem totais divergentes ou fatura sem conta: deve ficar somente leitura em `legado_requer_revisao`.
- Relatório/link público contém dados técnicos: a RPC pública deve remover custo, BDI, composição e campos internos antes de responder.

---

## Mapa de arquivos

### Criar

- `src/lib/medicoes-core/types.ts` — contratos compartilhados do domínio.
- `src/lib/medicoes-core/calculos.ts` — conversões, saldos e resumos puros.
- `src/lib/medicoes-core/estados.ts` — máquina de estados e permissões puras.
- `src/lib/medicoes-core/adapters/obra.ts` — adaptação de fotografia comercial de obra.
- `src/lib/medicoes-core/adapters/empreiteiro.ts` — adaptação compatível do contrato de empreiteiro.
- `src/lib/medicoes-core/index.ts` — exports públicos estáveis.
- `src/lib/medicao-obra-v2.functions.ts` — chamadas RPC autenticadas.
- `src/lib/medicao-obra-publica.functions.ts` — link, aceite e contestação públicos.
- `src/components/medicoes-core/measurement-summary-cards.tsx` — resumo reutilizável.
- `src/components/medicoes-core/measurement-items-table.tsx` — contratado/anterior/atual/acumulado/saldo.
- `src/components/medicoes-core/measurement-evidence-panel.tsx` — anexos por boletim/item.
- `src/components/medicoes-core/measurement-approval-timeline.tsx` — eventos e aprovações.
- `src/components/medicoes-core/measurement-report-configurator.tsx` — opções do relatório.
- `src/components/medicoes-core/measurement-status-badge.tsx` — status compartilhado.
- `src/components/medicoes-obra/medicoes-page.tsx` — central com abas.
- `src/components/medicoes-obra/medicao-editor-dialog.tsx` — editor de obra v2.
- `src/components/medicoes-obra/medicao-mapa.tsx` — mapa histórico.
- `src/components/medicoes-obra/medicao-indicadores.tsx` — Curva S e desempenho.
- `src/components/medicoes-obra/medicao-relatorio-v2.tsx` — documento configurável.
- `src/routes/portal/medicoes.tsx` — boletins no Portal do Cliente.
- `src/routes/medicao-obra.$token.tsx` — relatório público e aceite.
- `supabase/migrations/20261031190000_corrigir_progresso_medicoes.sql` — rascunho fora do progresso.
- `supabase/migrations/20261031191000_medicoes_obra_v2_schema.sql` — estrutura, tipos e RLS.
- `supabase/migrations/20261031192000_medicoes_obra_v2_fluxo.sql` — rascunho, versões e aprovações.
- `supabase/migrations/20261031193000_medicoes_obra_v2_publico.sql` — evidências, links e fotografia pública.
- `supabase/migrations/20261031194000_medicoes_obra_v2_indicadores.sql` — séries agregadas.
- `supabase/migrations/20261031195000_medicoes_obra_v2_portal.sql` — aceite e contestação.
- `supabase/migrations/20261031200000_medicoes_obra_v2_backfill.sql` — migração idempotente do legado.
- `tests/medicoes-core.test.mjs` — domínio puro.
- `tests/medicoes-estados.test.mjs` — transições e papéis.
- `tests/medicoes-obra-v2-db.test.mjs` — banco, financeiro, RLS e rollback.
- `tests/medicoes-obra-v2-ui.test.mjs` — guardas estruturais das telas/rotas.
- `tests/medicoes-obra-publica.test.mjs` — sanitização e aceite.
- `docs/rollbacks/medicoes_obra_v2.md` — rollback por migration e auditoria.

### Modificar

- `src/routes/_app/medicoes.tsx` — transformar em rota fina para a nova central.
- `src/components/medicoes/medicao-relatorio.tsx` — fallback legado explicitamente isolado.
- `src/components/contratos-empreiteiros/medicao-editor-sheet.tsx` — consumir cálculos puros sem mudar UI.
- `src/lib/contratos-empreiteiros.ts` — delegar conversões compatíveis ao núcleo.
- `src/routes/portal.tsx` — adicionar navegação para Medições.
- `src/hooks/use-portal-context.ts` — expor contexto necessário sem novo estado paralelo.
- `src/routeTree.gen.ts` — regenerado pelo TanStack Router.
- `src/lib/permissions.ts` — permissões da central e ações.
- `PROGRESS.md` — registrar fases, migrations, testes e deploy.

---

### Task 1: Congelar comportamento atual e corrigir progresso de rascunho

**Files:**
- Create: `supabase/migrations/20261031190000_corrigir_progresso_medicoes.sql`
- Create: `tests/medicoes-obra-v2-db.test.mjs`

**Interfaces:**
- Produces: regra de que apenas `aprovada`, `faturada` e, após expansão, estados definitivos atualizam `obras.progresso` e `obras.valor_executado`.

- [ ] **Step 1: Escrever teste de banco que cria rascunho com valor e confirma progresso zero**

O teste `rascunho não altera progresso nem cria conta a receber` deve inserir obra, medição e item, recalcular e afirmar `progresso = 0`, `valor_executado = 0` e nenhuma linha em `contas_receber`.

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs`

Expected: FAIL porque o trigger atual soma qualquer estado diferente de `cancelada`.

- [ ] **Step 3: Implementar migration corretiva mínima**

Substituir os triggers por versões aditivas que consideram somente `aprovada` e `faturada`, sem editar migrations históricas e sem introduzir ainda o schema v2.

- [ ] **Step 4: Testar rascunho, aprovada e cancelada**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs`

Expected: PASS; aprovada atualiza uma vez e cancelada remove seu efeito.

- [ ] **Step 5: Commit**

`git commit -m "fix(medições): impedir rascunho de atualizar progresso"`

### Task 2: Núcleo compartilhado de cálculos

**Files:**
- Create: `src/lib/medicoes-core/types.ts`
- Create: `src/lib/medicoes-core/calculos.ts`
- Create: `src/lib/medicoes-core/index.ts`
- Create: `tests/medicoes-core.test.mjs`
- Modify: `src/lib/contratos-empreiteiros.ts`

**Interfaces:**
- Produces: `ModoEntradaMedicao = "quantidade" | "percentual" | "valor"`.
- Produces: `LinhaMedicaoCore`, `EntradaMedicaoCore`, `SaldoMedicaoCore`, `ResumoMedicaoCore`.
- Produces: `converterEntradaMedicao(modo, entrada, quantidadeContratada, precoUnitarioCentavos): EntradaMedicaoCore`.
- Produces: `calcularSaldoMedicao(linha, entrada): SaldoMedicaoCore`.
- Produces: `calcularResumoMedicao(linhas, ajustes): ResumoMedicaoCore`.

- [ ] **Step 1: Escrever testes RED de conversão e arredondamento**

Cobrir quantidade, percentual e valor; decimal brasileiro; preço zero; quantidade fracionária; entrada negativa; 99,999%; e equivalência dos três modos em centavos.

- [ ] **Step 2: Executar testes RED**

Run: `node --test tests/medicoes-core.test.mjs`

- [ ] **Step 3: Implementar tipos e funções puras**

Usar inteiros para dinheiro, tolerância decimal explícita para quantidades e nunca arredondar saldo para valor negativo.

- [ ] **Step 4: Delegar funções compatíveis de Empreiteiros ao novo núcleo**

Preservar assinaturas públicas atuais em `src/lib/contratos-empreiteiros.ts`; adicionar testes que provam resultados idênticos.

- [ ] **Step 5: Executar testes focados**

Run: `node --test tests/medicoes-core.test.mjs tests/contratos-empreiteiros.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "refactor(medições): extrair núcleo compartilhado de cálculos"`

### Task 3: Máquina de estados e permissões

**Files:**
- Create: `src/lib/medicoes-core/estados.ts`
- Create: `tests/medicoes-estados.test.mjs`
- Read/verify: `src/lib/permissions.ts`

**Interfaces:**
- Produces: `StatusMedicaoObraV2` com `rascunho`, `em_conferencia`, `devolvida`, `aprovada_tecnica`, `aguardando_aceite_cliente`, `aprovada_comercial`, `faturada`, `recebida`, `cancelada`, `legado_requer_revisao`.
- Produces: `AcaoMedicaoObra` e `podeTransicionarMedicao(status, acao, perfil, contexto): ResultadoTransicao`.
- Consumes: perfis reais `admin`, `diretor`, `engenharia`, `financeiro_civil`.

- [ ] **Step 1: Escrever tabela de testes RED para todas as transições válidas e inválidas**

Incluir segregação técnica/comercial, exceção de admin com justificativa, faturamento por financeiro e bloqueio de legado.

- [ ] **Step 2: Executar RED**

Run: `node --test tests/medicoes-estados.test.mjs`

- [ ] **Step 3: Implementar máquina de estados pura**

Não consultar Supabase nesse arquivo; receber todo contexto por parâmetro.

- [ ] **Step 4: Validar perfis existentes sem alterar o modelo de permissões**

Manter a permissão de módulo `medicoes` existente. A máquina de estados e as RPCs validam as ações pelos perfis `admin`, `diretor`, `engenharia` e `financeiro_civil`; não criar um segundo modelo de autorização nesta fase.

- [ ] **Step 5: Executar testes e commit**

Run: `node --test tests/medicoes-estados.test.mjs`

`git commit -m "feat(medições): definir fluxo de aprovação e permissões"`

### Task 4: Schema aditivo, versões e auditoria

**Files:**
- Create: `supabase/migrations/20261031191000_medicoes_obra_v2_schema.sql`
- Modify: `tests/medicoes-obra-v2-db.test.mjs`
- Create: `docs/rollbacks/medicoes_obra_v2.md`

**Interfaces:**
- Produces: colunas v2 em `medicoes`, incluindo `status_v2`, `lock_version`, `orcamento_revisao_id`, `proposta_id`, `escopo_versao`, `exige_aceite_cliente`, totais em centavos e datas/atores de transição.
- Produces: `configuracoes_empresa.medicoes_obra_v2_ativo boolean NOT NULL DEFAULT false` como flag de rollout por empresa.
- Produces: `medicao_obra_versoes`, `medicao_obra_eventos`, `medicao_obra_aprovacoes`, `medicao_obra_comentarios`, `medicao_obra_anexos`, `medicao_obra_links_publicos`.
- Produces: view/RPC privada que resolve exatamente um escopo comercial ativo.

- [ ] **Step 1: Escrever testes RED do schema, constraints e RLS**

Verificar FKs, unicidade de número por obra, `lock_version >= 1`, audiência válida, token armazenado como hash e isolamento por empresa/cliente.

- [ ] **Step 2: Executar RED em PGlite**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs`

- [ ] **Step 3: Implementar tabelas, índices e políticas aditivas**

Não remover colunas antigas; manter `status` legado sincronizado enquanto a feature flag estiver ativa.

- [ ] **Step 4: Implementar resolução determinística de escopo**

Prioridade: proposta aceita ativa → revisão congelada associada; para obra interna, revisão publicada marcada como escopo. Zero ou múltiplas origens retornam erro explícito.

- [ ] **Step 5: Escrever e testar rollback**

O documento deve listar pré-condições, SQL reverso seguro, dados que precisam ser exportados e procedimento de reaplicação.

- [ ] **Step 6: Executar testes e commit**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs`

`git commit -m "feat(medições): criar schema versionado e auditável"`

### Task 5: RPCs de rascunho, concorrência e aprovação

**Files:**
- Create: `supabase/migrations/20261031192000_medicoes_obra_v2_fluxo.sql`
- Modify: `tests/medicoes-obra-v2-db.test.mjs`
- Create: `src/lib/medicao-obra-v2.functions.ts`

**Interfaces:**
- Produces RPCs: `criar_medicao_obra_v2(uuid, date, date)`, `salvar_rascunho_medicao_obra_v2(uuid, bigint, jsonb, jsonb)`, `transicionar_medicao_obra_v2(uuid, bigint, text, text)`, `cancelar_medicao_obra_v2(uuid, bigint, text)`.
- Produces wrappers TypeScript com os mesmos conceitos e retornos tipados `{ medicaoId, versaoId, lockVersion, status }`.

- [ ] **Step 1: Escrever testes RED de criação e controle otimista**

Cobrir escopo ausente/ambíguo, snapshot correto, dois salvamentos com mesma versão e preservação do primeiro.

- [ ] **Step 2: Implementar criação e salvamento de rascunho**

Salvar linhas por substituição transacional, recalcular no servidor e rejeitar totais enviados que não coincidam.

- [ ] **Step 3: Escrever testes RED de transições e segregação**

Cobrir papéis, mesma pessoa em duas aprovações, exceção admin, justificativa obrigatória e transição repetida.

- [ ] **Step 4: Implementar transições, eventos e versões imutáveis**

Usar `FOR UPDATE`, validar estado/versão, gravar evento e garantir idempotência por estado e versão.

- [ ] **Step 5: Escrever testes RED de financeiro atômico**

Cobrir uma única conta a receber, aceite obrigatório, falha financeira com rollback, cancelamento e recebimento já conciliado.

- [ ] **Step 6: Implementar aprovação/aceite opcional e cancelamento**

Quando `exige_aceite_cliente = true`, aprovação comercial não cria conta; o aceite posterior cria. Quando falso, cria na aprovação comercial.

- [ ] **Step 7: Executar testes e commit**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs tests/medicoes-estados.test.mjs`

`git commit -m "feat(medições): adicionar aprovação transacional e concorrência"`

### Task 6: Componentes compartilhados e adaptador de obra

**Files:**
- Create: `src/lib/medicoes-core/adapters/obra.ts`
- Create: `src/lib/medicoes-core/adapters/empreiteiro.ts`
- Create: `src/components/medicoes-core/measurement-status-badge.tsx`
- Create: `src/components/medicoes-core/measurement-summary-cards.tsx`
- Create: `src/components/medicoes-core/measurement-items-table.tsx`
- Create: `src/components/medicoes-core/measurement-approval-timeline.tsx`
- Create: `tests/medicoes-obra-v2-ui.test.mjs`

**Interfaces:**
- Produces: `MeasurementDomainAdapter<TSource>` com `toCoreLines`, `canEditCommercialValues`, `financialDirection` e `sanitizePublicSnapshot`.
- Produces componentes controlados, sem consultas diretas ao banco.
- Consumes tipos e cálculos das Tasks 2 e 3.

- [ ] **Step 1: Escrever testes RED de adaptação e sanitização**

Assegurar que obra usa preço comercial congelado e que snapshot público omite custos/BDI/insumos; empreiteiro mantém resultados atuais.

- [ ] **Step 2: Implementar adaptadores**

Fixar `financialDirection: "receivable"` para obra e `"payable"` para empreiteiro.

- [ ] **Step 3: Escrever guardas estruturais RED dos componentes**

Testar props obrigatórias, três modos de entrada, colunas anterior/atual/acumulado/saldo e ausência de Supabase nos componentes.

- [ ] **Step 4: Implementar componentes controlados**

Usar acessibilidade de tabela, labels explícitos, teclado e layout responsivo com cartões no mobile.

- [ ] **Step 5: Executar testes/build e commit**

Run: `node --test tests/medicoes-core.test.mjs tests/medicoes-obra-v2-ui.test.mjs && npm run build`

`git commit -m "feat(medições): criar componentes compartilhados"`

### Task 7: Central e editor de Medição de Obras

**Files:**
- Create: `src/components/medicoes-obra/medicoes-page.tsx`
- Create: `src/components/medicoes-obra/medicao-editor-dialog.tsx`
- Modify: `src/routes/_app/medicoes.tsx`
- Modify: `tests/medicoes-obra-v2-ui.test.mjs`

**Interfaces:**
- Consumes wrappers da Task 5 e componentes da Task 6.
- Produces rota com abas `lista`, `mapa`, `indicadores` e editor v2 protegido por feature flag/empresa.

- [ ] **Step 1: Escrever testes RED da central**

Verificar estados loading/error/empty, filtros, abas, resumo, criação bloqueada sem escopo e ausência do seletor livre de status.

- [ ] **Step 2: Implementar rota fina e página da central**

A rota apenas valida search params e monta `MedicoesPage`; mover lógica nova para componentes focados.

- [ ] **Step 3: Escrever testes RED do editor**

Cobrir modo quantidade/percentual/valor, saldo, estouro, conflito de versão, salvar rascunho e botões permitidos pelo status/papel.

- [ ] **Step 4: Implementar editor conectado às RPCs**

Não permitir editar quantidade/preço contratado; orientar uso de aditivo. Mostrar conflito com ação explícita de recarregar.

- [ ] **Step 5: Validar manualmente desktop e viewport móvel**

Fluxo mínimo: criar → medir dois itens → salvar → reabrir → enviar → aprovar técnica → aprovar comercial.

- [ ] **Step 6: Executar testes/build e commit**

Run: `node --test tests/medicoes-obra-v2-ui.test.mjs tests/medicoes-obra-v2-db.test.mjs && npm run build`

`git commit -m "feat(medições): entregar central e editor de obras"`

### Task 8: Evidências, comentários e links públicos

**Files:**
- Create: `src/components/medicoes-core/measurement-evidence-panel.tsx`
- Create: `src/lib/medicao-obra-publica.functions.ts`
- Create: `src/routes/medicao-obra.$token.tsx`
- Create: `tests/medicoes-obra-publica.test.mjs`
- Create: `supabase/migrations/20261031193000_medicoes_obra_v2_publico.sql`

**Interfaces:**
- Produces RPCs de upload/registro, publicação, revogação, fotografia pública e comentário por audiência.
- Produces link público por `versao_id`, token forte armazenado somente como hash e expiração configurável.

- [ ] **Step 1: Escrever testes RED de evidência e audiência**

Cobrir regra opcional/obrigatória, vínculo por atividade, comentário interno invisível e imutabilidade após aprovação.

- [ ] **Step 2: Implementar políticas, funções e painel**

Reutilizar infraestrutura R2 existente, mantendo prefixo próprio e URLs autorizadas.

- [ ] **Step 3: Escrever testes RED de link público**

Cobrir token inválido, expirado, revogado, versão antiga, campos proibidos e rate/abuse guard conforme padrão do projeto.

- [ ] **Step 4: Implementar fotografia sanitizada e rota pública somente leitura**

Não consultar tabelas técnicas diretamente no navegador público; usar RPC sanitizada.

- [ ] **Step 5: Executar testes e commit**

Run: `node --test tests/medicoes-obra-publica.test.mjs tests/medicoes-obra-v2-db.test.mjs`

`git commit -m "feat(medições): adicionar evidências e link seguro"`

### Task 9: Relatório configurável

**Files:**
- Create: `src/components/medicoes-core/measurement-report-configurator.tsx`
- Create: `src/components/medicoes-obra/medicao-relatorio-v2.tsx`
- Modify: `src/components/medicoes/medicao-relatorio.tsx`
- Modify: `tests/medicoes-obra-v2-ui.test.mjs`

**Interfaces:**
- Produces: `ConfiguracaoRelatorioMedicao` com `modo`, `itens`, `mostrarValores`, `mostrarComentarios`, `mostrarEvidencias`, `mostrarDocumentos`, `mostrarAssinaturas`, `mostrarEmpresa`, `mostrarHistorico`, `mostrarPlanejadoMedido`.
- Produces render único usado por tela, impressão/PDF e link público.

- [ ] **Step 1: Escrever testes RED de configuração**

Cobrir completo/percentual, todas/somente medidas, valores ocultos e exclusão de conteúdo interno.

- [ ] **Step 2: Implementar configurador e documento v2**

Renderizar fotografia da versão, não dados vivos. Exibir aviso quando planejado não existir.

- [ ] **Step 3: Preservar relatório legado como fallback explícito**

Usar apenas para registros `legado_requer_revisao` ou não migrados; nunca decidir por estado de loading.

- [ ] **Step 4: Verificar impressão/PDF e Excel**

Testar quebra de página, cabeçalho repetido, fotos, valores ocultos e planilha com os mesmos totais.

- [ ] **Step 5: Executar testes/build e commit**

Run: `node --test tests/medicoes-obra-v2-ui.test.mjs tests/medicoes-obra-publica.test.mjs && npm run build`

`git commit -m "feat(medições): criar relatório configurável e versionado"`

### Task 10: Mapa de medições e indicadores

**Files:**
- Create: `src/components/medicoes-obra/medicao-mapa.tsx`
- Create: `src/components/medicoes-obra/medicao-indicadores.tsx`
- Modify: `src/components/medicoes-obra/medicoes-page.tsx`
- Modify: `tests/medicoes-obra-v2-ui.test.mjs`
- Create: `supabase/migrations/20261031194000_medicoes_obra_v2_indicadores.sql`

**Interfaces:**
- Produces RPC agregada `indicadores_medicao_obra_v2(uuid, date, date)` com séries planejada, medida, acumulada, etapas e metadado `peso_origem`.

- [ ] **Step 1: Escrever testes RED das séries**

Cobrir meses sem medição, cronograma parcial, aditivo, cancelamento, peso de cronograma e fallback financeiro identificado.

- [ ] **Step 2: Implementar agregação no banco**

Retornar estrutura pronta para gráfico e evitar N+1 no navegador.

- [ ] **Step 3: Escrever testes RED do mapa/indicadores**

Verificar matriz por período, drill-down, Curva S, barras por etapa, desvio e mensagem sem cronograma.

- [ ] **Step 4: Implementar telas usando Recharts existente**

Não adicionar biblioteca de gráficos sem necessidade.

- [ ] **Step 5: Executar testes/build e commit**

Run: `node --test tests/medicoes-obra-v2-db.test.mjs tests/medicoes-obra-v2-ui.test.mjs && npm run build`

`git commit -m "feat(medições): adicionar mapa e curva planejado versus medido"`

### Task 11: Portal do Cliente, aceite e contestação

**Files:**
- Create: `src/routes/portal/medicoes.tsx`
- Modify: `src/routes/portal.tsx`
- Modify: `src/hooks/use-portal-context.ts`
- Modify: `src/lib/medicao-obra-publica.functions.ts`
- Create: `supabase/migrations/20261031195000_medicoes_obra_v2_portal.sql`
- Modify: `tests/medicoes-obra-publica.test.mjs`

**Interfaces:**
- Produces RPC autenticada `aceitar_medicao_obra_portal(p_medicao_id uuid, p_versao_id uuid, p_declaracao text)`.
- Produces RPC autenticada `contestar_medicao_obra_portal(p_medicao_id uuid, p_versao_id uuid, p_justificativa text)`.
- O link público da Task 8 permanece somente leitura; aceite e contestação exigem usuário autenticado e vínculo ativo com o cliente da obra.
- Consumes fotografia sanitizada da Task 8.

- [ ] **Step 1: Escrever testes RED de acesso do cliente**

Cliente só vê obras vinculadas, versões publicadas e comentários de audiência cliente; colaborador interno não ganha acesso pelo token do portal.

- [ ] **Step 2: Implementar aba e lista no portal**

Mostrar resumo, itens liberados, evidências, PDF, histórico e estado do aceite.

- [ ] **Step 3: Escrever testes RED de aceite/contestação**

Cobrir versão desatualizada, duplo clique idempotente, justificativa obrigatória, aceite obrigatório gerando uma conta e aceite opcional sem duplicação.

- [ ] **Step 4: Implementar ações transacionais e timeline**

O portal nunca atualiza `medicoes` diretamente.

- [ ] **Step 5: Executar testes/build e commit**

Run: `node --test tests/medicoes-obra-publica.test.mjs tests/medicoes-obra-v2-db.test.mjs && npm run build`

`git commit -m "feat(portal): adicionar boletins e aceite de medições"`

### Task 12: Migração legada, rollout e convergência segura

**Files:**
- Create: `supabase/migrations/20261031200000_medicoes_obra_v2_backfill.sql`
- Modify: `tests/medicoes-obra-v2-db.test.mjs`
- Modify: `src/routes/_app/medicoes.tsx`
- Modify: `src/components/contratos-empreiteiros/medicao-editor-sheet.tsx` somente após estabilização.
- Modify: `PROGRESS.md`
- Modify: `docs/rollbacks/medicoes_obra_v2.md`

**Interfaces:**
- Produces relatório de auditoria com contagens e somas antes/depois.
- Produces feature flag por empresa e caminho de rollback.

- [ ] **Step 1: Escrever testes RED do mapeamento legado**

Cobrir quatro estados antigos, aprovação técnica `migracao_legada`, fatura sem conta, totais divergentes e origem ambígua.

- [ ] **Step 2: Implementar backfill idempotente**

Nunca inventar aprovador humano; inconsistência vira `legado_requer_revisao` somente leitura.

- [ ] **Step 3: Executar auditoria sombra em cópia de dados**

Comparar quantidade de medições, soma por obra/status, contas vinculadas, progresso e saldo. Anexar resultado ao PR sem dados pessoais.

- [ ] **Step 4: Ativar por feature flag para empresa piloto**

Validar criação, aprovação, relatório, portal, cancelamento e financeiro; manter fallback reversível.

- [ ] **Step 5: Migrar visual de Empreiteiros em PR separado**

Somente após a fase piloto. Trocar componentes duplicados sem alterar RPCs, tabelas ou direção financeira; executar toda a suíte de empreiteiros.

- [ ] **Step 6: Atualizar documentação e progresso**

Registrar migrations aplicadas, SHA, testes, riscos conhecidos, rollback, deploy e validação online em `PROGRESS.md`.

- [ ] **Step 7: Verificação final**

Run: `node --test tests/*.test.mjs && npm run build`.

Execute também o ESLint focado em todos os arquivos alterados. Rode `npm run lint` quando a baseline da branch estiver limpa; se houver falhas preexistentes, registre a baseline antes/depois e prove que nenhum erro novo foi introduzido.

Executar smoke test online em desktop e viewport móvel, conferir console e rede, e validar que nenhum rascunho altera financeiro/progresso.

- [ ] **Step 8: Commit**

`git commit -m "feat(medições): concluir migração e rollout controlado"`

---

## Sequência de PRs recomendada

1. PR Fundação: Tasks 1–3.
2. PR Banco v2: Tasks 4–5.
3. PR Central e editor: Tasks 6–7.
4. PR Evidências e relatório: Tasks 8–9.
5. PR Indicadores: Task 10.
6. PR Portal: Task 11.
7. PR Migração e rollout: Task 12.
8. PR posterior e independente: convergência visual de Empreiteiros.

Nenhum PR deve depender de migration ainda não aplicada em produção sem compatibilidade para o schema anterior. Cada PR exige issue própria, branch própria, testes focados, suíte proporcional ao risco e descrição de banco/deploy/rollback.
