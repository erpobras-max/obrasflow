# Proposta independente da obra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir criar, editar e publicar propostas sem obra prévia, criando obra somente após aprovação de uma proposta classificada como `Obra`.

**Architecture:** Manter o fluxo legado baseado em revisão de orçamento e adicionar um fluxo manual de proposta. A origem técnica (`obra_id`/`orcamento_revisao_id`) ficará opcional para novas propostas; aprovação será centralizada em RPC transacional e idempotente. A UI mostrará a conversão para obra somente quando aplicável.

**Tech Stack:** React + TypeScript, TanStack Query, TanStack Router, Supabase/PostgreSQL/RLS, Vitest/Node tests e Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-11-13-proposta-independente-da-obra-design.md`

## Global Constraints

- Seguir `AGENTS.md`: Issue existente ou criada antes do código, branch própria, PR em português, aprovação antes do merge e publicação.
- Não alterar cronograma, arquivos, relatórios, medições, BDI ou composições SINAPI.
- Preservar propostas antigas e o fluxo de criação a partir de revisão de orçamento.
- Somente `tipoProposta = Obra` cria obra automaticamente.
- Aprovação e conversão devem ser idempotentes e protegidas por RLS/roles existentes.
- Não criar contrato automaticamente para Reforma, Projeto, Serviço ou demais tipos.

## Review Focus

- Proposta manual sem `obra_id` ou `orcamento_revisao_id` deve salvar, editar e publicar sem chamar funções que exigem revisão — cobrir em `tests/propostas-editor-db.test.mjs` e teste de integração do diálogo.
- Repetição de aprovação ou clique duplo não pode criar duas obras — cobrir no teste da RPC de aprovação.
- Propostas legadas com revisão devem continuar carregando fotografia, impressão e status — cobrir em `tests/propostas-editor-db.test.mjs`.
- Reforma aprovada não pode criar obra nem contrato automático — cobrir na matriz de classificações.
- RLS deve impedir criação/conversão por papel sem permissão — cobrir no teste de banco existente ou novo teste SQL.

### Task 0: Preparar Issue e branch

**Files:**
- No código; registrar Issue e criar branch Git.

**Interfaces:**
- Produces: número da Issue e branch `feat/<issue>-proposta-independente-obra` usados em todas as tarefas.

- [ ] **Step 1: Verificar Issues existentes**

  Procurar Issue sobre proposta sem obra e reutilizar somente se o escopo coincidir.

- [ ] **Step 2: Criar Issue se necessário**

  Registrar objetivo, regras de classificação, critérios de aceite, impacto de banco e necessidade de migração.

- [ ] **Step 3: Criar branch a partir de `main`**

  Executar `git fetch origin` e criar a branch da Issue sem levar alterações de outras tarefas.

- [ ] **Step 4: Verificar estado inicial**

  Executar `git status --short`, testes focados de propostas e build; anotar qualquer falha preexistente.

### Task 1: Ajustar modelo e RPCs de criação manual

**Files:**
- Create: `supabase/migrations/<timestamp>_proposta_independente_obra.sql`
- Modify: `src/lib/proposta-orcamento.functions.ts`
- Modify: `src/integrations/supabase/types.ts` (gerado conforme padrão do repositório)
- Test: `tests/propostas-editor-db.test.mjs`

**Interfaces:**
- Produces RPC `criar_proposta_manual(p_cliente_id uuid, p_titulo text, p_tipo_proposta text, p_descricao text, p_valor_total numeric, p_validade date, p_condicoes text, p_itens jsonb) returns uuid`.
- Produces RPC `salvar_rascunho_proposta_manual(p_proposta_id uuid, p_dados jsonb) returns uuid`.
- Existing `criar_proposta_de_revisao`, `salvar_rascunho_proposta` and `publicar_rascunho_proposta` remain compatible with non-null revisions.

- [ ] **Step 1: Write failing DB tests**

  Add tests for manual creation with no obra/revisão, required client, allowed types including `Reforma`, and rejection for unauthorized roles.

- [ ] **Step 2: Run focused DB tests to verify failure**

  Run `node --test tests/propostas-editor-db.test.mjs`; expected failure because the RPC/table contract does not yet support manual proposals.

- [ ] **Step 3: Add migration**

  Make `orcamento_revisao_id`/legacy origin optional for new rows, preserve existing foreign keys, add any nullable commercial fields required by the editor, add `Reforma` to the allowed type configuration, and create RLS-safe RPCs using the existing `pode_editar_proposta_editor` policy.

- [ ] **Step 4: Update types and adapters**

  Add the nullable origin and manual proposal fields to Supabase types and normalize old configurations to `Obra` without changing stored legacy data.

- [ ] **Step 5: Run tests to verify pass**

  Re-run `node --test tests/propostas-editor-db.test.mjs` and the proposal unit tests; expected PASS for manual and legacy paths.

- [ ] **Step 6: Commit**

  Commit migration and type/DB tests with `feat: permitir propostas sem obra previa`.

### Task 2: Separar o cálculo comercial manual do cálculo técnico

**Files:**
- Modify: `supabase/migrations/<timestamp>_proposta_independente_obra.sql`
- Modify: `src/lib/propostas/proposta-editor.types.ts`
- Modify: `src/lib/propostas/proposta-editor-state.ts`
- Modify: `src/lib/proposta-orcamento.functions.ts`
- Test: `tests/proposta-editor-adapter.test.mjs`, `tests/editor-proposta-comercial.test.mjs`

**Interfaces:**
- Manual configuration stores `tipoProposta`, commercial items and total; technical photography is present only when an `orcamento_revisao_id` exists.
- `normalizarConfiguracaoProposta` keeps legacy defaults and accepts manual item rows.

- [ ] **Step 1: Write failing adapter/state tests**

  Assert that a manual proposal can calculate/display total from commercial items without invoking `construir_fotografia_comercial`, while a legacy proposal still uses technical photography.

- [ ] **Step 2: Run focused tests and verify failure**

  Run `node --test tests/proposta-editor-adapter.test.mjs tests/editor-proposta-comercial.test.mjs`.

- [ ] **Step 3: Implement the two calculation paths**

  Branch on nullable origin: use existing technical snapshot for legacy proposals; use normalized manual items and explicit total for new proposals. Keep monetary values in the existing representation and preserve print configuration.

- [ ] **Step 4: Run focused tests and verify pass**

  Re-run the same tests and confirm legacy snapshots are byte-compatible for existing fixtures.

- [ ] **Step 5: Commit**

  Commit with `feat: separar itens comerciais de fotografia tecnica`.

### Task 3: Implement approval and manual conversion to obra

**Files:**
- Modify: `supabase/migrations/<timestamp>_proposta_independente_obra.sql`
- Modify: `src/lib/proposta-orcamento.functions.ts`
- Modify: `src/integrations/supabase/types.ts`
- Test: `tests/propostas-editor-db.test.mjs`

**Interfaces:**
- Replace/extend `alterar_status_proposta_editor(p_proposta_id uuid, p_status status_proposta)` so transition to `aceita` calls an idempotent conversion helper only when normalized type is `Obra`.
- Add `converter_proposta_em_obra(p_proposta_id uuid, p_dados jsonb) returns uuid` for explicit manual conversion, requiring confirmation fields and returning the existing linked obra when already converted.

- [ ] **Step 1: Write failing approval matrix tests**

  Cover `Obra` creates one obra, `Reforma`/other types create none, duplicate approval returns the same obra, and manual conversion requires/completes name, address, responsible and status.

- [ ] **Step 2: Run tests to verify failure**

  Run the focused DB test file and confirm current triggers/RPCs do not satisfy the matrix.

- [ ] **Step 3: Implement transaction and idempotency**

  Lock the proposal row, detect existing `proposta_id` linkage before insert, create the obra only for `Obra`, persist linkage, and leave service types as approved/contracted without creating contracts.

- [ ] **Step 4: Disable conflicting legacy behavior safely**

  Adjust the old acceptance trigger so it delegates to the new idempotent path instead of creating duplicate obras, preserving compatibility for legacy proposals.

- [ ] **Step 5: Run tests to verify pass**

  Re-run the approval matrix and legacy acceptance tests.

- [ ] **Step 6: Commit**

  Commit with `feat: converter proposta aprovada em obra de forma idempotente`.

### Task 4: Atualizar criação, editor e listagem de propostas

**Files:**
- Modify: `src/components/propostas/nova-proposta-orcamento-dialog.tsx`
- Modify: `src/routes/_app/comercial.propostas.tsx`
- Modify: `src/hooks/use-proposta-editor.ts`
- Modify: `src/components/propostas/editor-proposta-comercial.tsx`
- Modify: `src/lib/propostas/proposta-editor-adapter.ts`
- Test: `tests/proposta-criacao.test.mjs`, `tests/propostas-rota-unica.test.mjs`, `tests/editor-proposta-comercial.test.mjs`

**Interfaces:**
- The creation dialog calls `criar_proposta_manual` by default and keeps a clearly labeled legacy `A partir de orçamento` path.
- The editor exposes `tipoProposta`, commercial items, and optional technical budget; it never blocks on missing obras for manual mode.
- The list displays origin/classification and exposes `Converter em obra` only when status/type permit it.

- [ ] **Step 1: Write failing UI/static tests**

  Assert absence of the “no obras” blocker in manual mode, presence of client/type fields, correct RPC selection, and conditional conversion action.

- [ ] **Step 2: Run focused tests and verify failure**

  Run `node --test tests/proposta-criacao.test.mjs tests/propostas-rota-unica.test.mjs tests/editor-proposta-comercial.test.mjs`.

- [ ] **Step 3: Implement manual-first creation**

  Load clients directly, create a manual draft, open the same editor, and preserve existing duplicate/from-budget actions.

- [ ] **Step 4: Implement editor and conversion UX**

  Add Reforma to the selector, separate commercial items from optional technical source, show a confirmation form for conversion, and invalidate proposal/obra queries after success.

- [ ] **Step 5: Run tests and build**

  Run the focused tests and `npm run build`; expected PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

  Commit with `feat: criar propostas comerciais sem obra previa`.

### Task 5: Regression, documentation and delivery

**Files:**
- Modify: `progress.md`
- Test: `tests/e2e/propostas-editor-unico.spec.ts`
- Possibly modify: `README`/release notes only if the repository convention requires it.

**Interfaces:**
- End-to-end path: client → manual proposal → publish → approve Obra → conversion form → one obra; parallel path for Reforma ends without obra.

- [ ] **Step 1: Add/adjust E2E scenarios**

  Cover manual proposal without existing obra, `Obra` approval/conversion, and `Reforma` approval without obra; use stable data-testid selectors.

- [ ] **Step 2: Run full validation**

  Run `npm test`, `npm run build`, and the configured Playwright suite; record any environment-limited checks explicitly.

- [ ] **Step 3: Update `progress.md`**

  Record the new flow, migration name, tests, compatibility behavior and any required Supabase SQL/deploy action.

- [ ] **Step 4: Open PR**

  Use a Portuguese PR description with `Closes #<issue>`, summary, validation, DB migration and deployment impact.

- [ ] **Step 5: Merge and publish only after approval**

  Do not merge directly to `main`; after explicit approval, merge the PR, apply the migration, deploy Cloudflare and smoke-test the online proposal flow.

