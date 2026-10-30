# Orçamento Analítico e Proposta Integrada Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um orçamento analítico, versionado e reversível com composições/insumos SINAPI ou próprios, memoriais de quantidade, BDI hierárquico e proposta comercial derivada.

**Architecture:** O domínio de cálculo ficará em funções puras TypeScript; o banco preservará catálogo, cópias congeladas e revisões imutáveis. A tela atual de `/orcamentos` será progressivamente substituída por componentes focados, protegidos por feature flag, enquanto propostas passam a apontar para uma revisão publicada do orçamento. A sincronização SINAPI usará descoberta agendada, arquivo bruto no R2, staging, validação e publicação atômica.

**Tech Stack:** TypeScript, React 19, TanStack Start/Query, Supabase/PostgreSQL/RLS, Cloudflare Workers/R2, Zod, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-orcamento-analitico-proposta-design.md`

## Global Constraints

- O custo unitário e total nunca são editáveis diretamente; derivam de consumo × preço dos insumos.
- Valores monetários usam centavos inteiros ou `numeric` de escala fixa, nunca ponto flutuante.
- BDI resolve uma única regra na ordem atividade → categoria → geral, sem somar camadas.
- Adaptações SINAPI afetam somente a cópia do orçamento.
- Revisões são criadas explicitamente; proposta aceita bloqueia sua revisão vinculada.
- Orçamentos existentes continuam acessíveis e o novo fluxo fica atrás de feature flag até validação.
- Cronograma, arquivos, relatórios e compras não serão redesenhados.

## Review Focus

- Fórmula de memorial malformada ou tentativa de execução deve falhar sem avaliar código; coberta na Task 2.
- Composição auxiliar cíclica deve ser detectada sem recursão infinita; coberta na Task 2.
- BDI zero, custo zero e categorias sem regra específica devem produzir totais determinísticos; cobertos na Task 2.
- Nova competência com preços zerados ou planilha alterada não pode virar padrão; coberta na Task 7.
- Duplo clique/publicação concorrente não pode criar revisões duplicadas nem alterar revisão aceita; coberta na Task 3.

---

### Task 1: Backup recuperável e schema aditivo

**Files:**
- Create: `backups/issue-197/README.md`
- Create: `backups/issue-197/manifest.sha256`
- Create: `supabase/migrations/20261030000000_orcamento_analitico.sql`
- Test: `tests/orcamento-analitico-db.test.mjs`

**Interfaces:**
- Consumes: schema atual de `orcamentos`, `orcamento_itens`, `referencia_insumos`, `referencia_composicoes`, `propostas` e `propostas_itens`.
- Produces: tabelas `orcamento_etapas`, `orcamento_atividades`, `orcamento_atividade_insumos`, `orcamento_memoriais`, `orcamento_revisoes`, `orcamento_auditoria`, `proposta_revisoes`, `sinapi_competencias`, `sinapi_composicao_itens` e `sinapi_importacoes`; colunas aditivas em `orcamentos` e `propostas`; RPCs transacionais de publicação e duplicação.

- [ ] **Step 1: Criar backup recuperável** dos arquivos que o plano alterará e registrar origem, data, Issue #197 e instruções de restauração no README; gerar hashes no manifesto sem incluir credenciais ou dados de produção.
- [ ] **Step 2: Escrever testes de banco inicialmente falhos** para constraints monetárias, ordem/parentesco de etapas, imutabilidade de revisão aceita, idempotência da publicação e RLS por papel.
- [ ] **Step 3: Executar** `node --test tests/orcamento-analitico-db.test.mjs` e confirmar falha pela ausência das tabelas/RPCs.
- [ ] **Step 4: Implementar migration aditiva** com FKs, checks, índices, grants, RLS, triggers de auditoria e RPCs `publicar_revisao_orcamento(uuid, text)` e `duplicar_orcamento_analitico(uuid, uuid)`.
- [ ] **Step 5: Executar o teste de banco** e confirmar PASS; se `@electric-sql/pglite` continuar ausente, registrar a dependência de teste antes de prosseguir e validar a migration em banco efêmero equivalente.
- [ ] **Step 6: Verificar rollback** aplicando a seção documentada de reversão apenas no banco efêmero e reaplicando a migration.

### Task 2: Domínio de cálculo analítico

**Files:**
- Create: `src/lib/orcamento-analitico.ts`
- Modify: `src/lib/orcamentos.schema.ts`
- Test: `tests/orcamento-analitico.test.mjs`

**Interfaces:**
- Consumes: linhas do memorial, árvore de composições e regras BDI persistidas pela Task 1.
- Produces: `avaliarFormulaMemorial(formula: string): number`, `somarMemorial(linhas): number`, `achatarComposicao(raiz, itens): InsumoAnalitico[]`, `calcularComposicao(insumos): ResumoCusto`, `resolverBdi(contexto): RegraBdi`, `calcularPrecoAtividade(atividade): ResumoPreco`.

- [ ] **Step 1: Escrever testes falhos** com valores literais para fórmulas, descontos, caracteres proibidos, ciclos, custos por categoria, BDI de atividade, categoria e geral, custo zero e arredondamento em centavos.
- [ ] **Step 2: Executar** `node --test tests/orcamento-analitico.test.mjs` e confirmar as falhas esperadas.
- [ ] **Step 3: Implementar parser aritmético seguro**, sem `eval`/`Function`, aceitando decimal brasileiro, parênteses e quatro operações.
- [ ] **Step 4: Implementar achatamento com detecção de ciclos** e preservar caminho técnico para exibição.
- [ ] **Step 5: Implementar cálculos em centavos/numeric** e resolução exclusiva do BDI.
- [ ] **Step 6: Executar teste focado e depois** `node --test tests/*.test.mjs`; reportar qualquer falha preexistente nominalmente.

### Task 3: Repositório de orçamento, revisões e migração legada

**Files:**
- Create: `src/lib/orcamento-analitico.functions.ts`
- Create: `src/lib/orcamento-legado.ts`
- Test: `tests/orcamento-legado.test.mjs`
- Modify: `src/integrations/supabase/client.custom.ts`

**Interfaces:**
- Consumes: RPCs/tabelas da Task 1 e cálculos da Task 2.
- Produces: server functions `obterOrcamentoAnalitico`, `salvarRascunhoOrcamento`, `publicarRevisaoOrcamento`, `duplicarOrcamento`, `migrarOrcamentoLegado`; legado vira atividade própria com insumo consolidado e marcador `legado_conferir`.

- [ ] **Step 1: Escrever teste falho** para conversão literal de item legado, preservação do total e marcação para conferência.
- [ ] **Step 2: Executar o teste** e confirmar falha pela ausência das funções.
- [ ] **Step 3: Implementar mapper legado puro** e server functions com validação Zod e autorização de admin/diretor/engenharia.
- [ ] **Step 4: Fazer publicação e duplicação chamarem RPCs transacionais**, usando chave idempotente por orçamento/versão.
- [ ] **Step 5: Executar testes focados** e conferir que revisão aceita rejeita mutação.

### Task 4: Componentes do orçamento analítico

**Files:**
- Create: `src/components/orcamentos/orcamento-analitico-view.tsx`
- Create: `src/components/orcamentos/memorial-calculo-dialog.tsx`
- Create: `src/components/orcamentos/composicao-custo-dialog.tsx`
- Create: `src/components/orcamentos/bdi-config-dialog.tsx`
- Create: `src/components/orcamentos/resumo-custos-popover.tsx`
- Modify: `src/routes/_app/orcamentos.tsx`
- Test: `tests/e2e/orcamento-analitico.spec.ts`

**Interfaces:**
- Consumes: consultas/mutações da Task 3 e tipos/cálculos da Task 2.
- Produces: planilha hierárquica responsiva; edição de descrição, unidade, quantidade e BDI; diálogos de memorial/composição; tooltips acessíveis; engrenagem de ações.

- [ ] **Step 1: Escrever cenários Playwright falhos** para criar etapa, inserir composição, editar memorial, bloquear custo direto, recalcular insumo, aplicar precedência BDI e operar teclado/toque.
- [ ] **Step 2: Executar** `npx playwright test tests/e2e/orcamento-analitico.spec.ts` e confirmar falhas no fluxo atual.
- [ ] **Step 3: Implementar componentes focados** seguindo os protótipos aprovados e reutilizando Button/Dialog/Table/Popover existentes.
- [ ] **Step 4: Integrar na rota por feature flag** `orcamento_analitico_v1`, mantendo o fluxo legado como fallback.
- [ ] **Step 5: Executar o teste e2e** em desktop e viewport móvel; confirmar cálculo e acessibilidade por foco.

### Task 5: Catálogo unificado e bases próprias

**Files:**
- Create: `src/components/orcamentos/catalogo-composicoes-dialog.tsx`
- Create: `src/lib/catalogo-orcamento.functions.ts`
- Modify: `src/components/referencias/referencia-custos-picker.tsx`
- Modify: `src/routes/_app/orcamentos.tsx`
- Test: `tests/catalogo-orcamento.test.mjs`

**Interfaces:**
- Consumes: catálogos SINAPI e próprios, competência/UF/regime do orçamento.
- Produces: `pesquisarCatalogoOrcamento(filtros)` e `copiarComposicaoParaOrcamento(composicaoId, atividadeId)`; pesquisa unificada e cópia congelada completa.

- [ ] **Step 1: Escrever testes falhos** para pesquisa por código/descrição, filtro automático da competência, mistura SINAPI/própria e cópia que não compartilha IDs mutáveis com o catálogo.
- [ ] **Step 2: Implementar consultas paginadas e cópia transacional** de composição/insumos.
- [ ] **Step 3: Implementar diálogo com visualização prévia de insumos** e indicador de base/fonte.
- [ ] **Step 4: Executar testes focados e e2e da Task 4**.

### Task 6: Proposta derivada e revisões comerciais

**Files:**
- Create: `src/lib/proposta-orcamento.functions.ts`
- Create: `src/components/propostas/configurar-proposta-orcamento.tsx`
- Modify: `src/routes/_app/comercial.propostas.tsx`
- Modify: `src/components/propostas/proposta-impressao.tsx`
- Test: `tests/proposta-orcamento.test.mjs`
- Test: `tests/e2e/proposta-orcamento.spec.ts`

**Interfaces:**
- Consumes: revisão publicada da Task 3.
- Produces: `criarPropostaDaRevisao`, `criarRevisaoProposta`, configuração de campos e documento imutável sem custos/BDI por padrão.

- [ ] **Step 1: Escrever testes falhos** para configuração padrão, fotografia imutável, numeração de revisão e bloqueio da revisão após aceite.
- [ ] **Step 2: Implementar funções transacionais** que sempre referenciam uma revisão publicada.
- [ ] **Step 3: Implementar configuração de exibição** de etapas, atividades, quantidades, preço unitário e anexos; manter custo interno, insumos e BDI ocultos por padrão.
- [ ] **Step 4: Atualizar visualização/impressão** para usar a fotografia da revisão e manter compatibilidade com propostas legadas.
- [ ] **Step 5: Executar testes unitários, e2e e regressão de impressão**.

### Task 7: Sincronização interna do SINAPI

**Files:**
- Create: `src/lib/sinapi/sinapi-descoberta.ts`
- Create: `src/lib/sinapi/sinapi-parser.ts`
- Create: `src/lib/sinapi/sinapi-validacao.ts`
- Create: `src/lib/sinapi/sinapi-import.functions.ts`
- Create: `src/routes/api.sinapi.cron.ts`
- Create: `src/components/orcamentos/sinapi-admin-panel.tsx`
- Modify: `wrangler.jsonc`
- Test: `tests/sinapi-import.test.mjs`

**Interfaces:**
- Consumes: página/ZIP oficial da Caixa, R2 e tabelas de staging/publicação da Task 1.
- Produces: `descobrirCompetencia`, `parsearPacoteSinapi`, `validarCompetencia`, `processarImportacaoSinapi` e endpoint agendado autenticado/idempotente.

- [ ] **Step 1: Salvar fixtures mínimas sanitizadas** de estrutura válida, preços zerados e cabeçalho alterado nos testes, sem redistribuir pacote integral de terceiros.
- [ ] **Step 2: Escrever testes falhos** para descoberta, hash/idempotência, parsing, checkpoints, bloqueio de preços zerados e manutenção da competência anterior.
- [ ] **Step 3: Implementar descoberta com allowlist oficial da Caixa**, limites de tamanho, timeout e validação de tipo/hash.
- [ ] **Step 4: Implementar download para R2, parsing em lotes e checkpoints** compatíveis com limites do Worker.
- [ ] **Step 5: Implementar validação/publicação atômica e painel administrativo** com reprocessamento e logs sanitizados.
- [ ] **Step 6: Configurar agendamento diário** e segredo do endpoint sem gravar credenciais no repositório.
- [ ] **Step 7: Executar fixtures, build e teste manual controlado** sem publicar automaticamente uma competência não revisada no primeiro deploy.

### Task 8: Exportações, feature flag, documentação e progresso

**Files:**
- Create: `src/lib/orcamento-exportacao.ts`
- Modify: `src/routes/_app/orcamentos.tsx`
- Modify: `PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-10-29-orcamento-analitico-proposta.md`
- Test: `tests/orcamento-exportacao.test.mjs`

**Interfaces:**
- Consumes: revisão publicada e listas consolidadas das Tasks 2–6.
- Produces: exportação sintética, analítica e de memoriais; status documentado e rollout reversível.

- [ ] **Step 1: Escrever testes falhos** para linhas/valores literais das três exportações e ausência de custos internos na proposta.
- [ ] **Step 2: Implementar geradores** reutilizando a dependência `xlsx` existente e nomes de arquivo determinísticos.
- [ ] **Step 3: Atualizar `PROGRESS.md`** com Issue/branch, schema, telas, testes, feature flag, backup, rollback, pendências de aplicação da migration e sincronização.
- [ ] **Step 4: Rodar verificação final:** testes focados; `node --test tests/*.test.mjs`; `npx eslint` somente nos arquivos alterados; `npm run build`; Playwright do fluxo novo e regressões públicas.
- [ ] **Step 5: Fazer auditoria de requisitos** contra o design e registrar qualquer diferença antes da PR.
- [ ] **Step 6: Abrir PR** com `Closes #197`, instruções de migration/deploy/cron, validação e plano de rollback; não mesclar nem publicar sem autorização explícita.

## Ordem de entrega e reversão

As Tasks 1–3 formam o núcleo reversível sem exposição ao usuário. Tasks 4–6 liberam Orçamento + Proposta atrás da feature flag. Task 7 ativa apenas descoberta/importação controlada no primeiro deploy. Task 8 conclui exportações e documentação. A reversão imediata desliga `orcamento_analitico_v1`; os dados novos permanecem preservados e as tabelas legadas não são removidas.

