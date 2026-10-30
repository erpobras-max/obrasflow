# Medições Separadas e Contratos de Empreiteiros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar a medição do cliente da medição de terceiros e entregar contratos de empreiteiros com vários itens, medições acumuladas, ajustes, retenções, evidências e integração transacional com contas a pagar.

**Architecture:** O fluxo atual de `/medicoes` permanece responsável por avanço e contas a receber. O novo módulo adiciona cabeçalhos de contrato e boletim sobre `servicos_terceirizados` e `medicoes_terceirizados`, preservando IDs e vínculos legados; regras monetárias e aprovação ficam no banco, enquanto React/TanStack oferece lista, importação e edição responsiva atrás de feature flag.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router/Query, Supabase/PostgreSQL/RLS, Zod, R2, XLSX, Node test runner, PGlite e Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-medicoes-separadas-contratos-empreiteiros-design.md`

## Global Constraints

- Seguir `AGENTS.md`: Issue antes de código, branch própria, PR em português e nenhuma mesclagem sem autorização explícita.
- Não excluir nem renomear tabelas, registros ou rotas legadas nesta entrega.
- Medição da Obra gera conta a receber; Medição de Empreiteiro gera conta a pagar. Nunca cruzar os efeitos.
- Valores do novo domínio usam centavos inteiros; totais críticos são recalculados no banco.
- Itens importados são fotografias independentes; editar contrato nunca altera orçamento/proposta de origem.
- Rascunhos não consomem saldo; somente medições aprovadas/pagas entram no acumulado.
- Aprovação e cancelamento são transacionais e idempotentes.
- A medição possui uma única aprovação por alçada configurável; a aprovação congela o boletim e cria a conta a pagar.
- Ajustes percentuais incidem independentemente sobre o bruto atual, nunca em cascata.
- Quantidade usa 6 casas, percentual 4 casas, centavos inteiros e arredondamento decimal meio para cima.
- Anexos usam R2 e o relatório público expõe somente dados sanitizados.
- O novo módulo fica atrás de `VITE_CONTRATOS_EMPREITEIROS_V1` até a validação dos dados migrados.

## Review Focus

- Aprovações simultâneas da mesma medição não podem criar duas contas a pagar; coberto na Task 6.
- Quantidade, percentual ou valor que ultrapasse o saldo após outra aprovação concorrente deve ser recusado; coberto nas Tasks 2 e 6.
- Backfill não pode agrupar contratos legados diferentes nem quebrar `conta_pagar_id`; coberto na Task 1.
- Cancelamento de medição paga deve ser bloqueado e cancelamento de conta aberta deve ser atômico; coberto na Task 5.
- Token público expirado/revogado e anexo de outro contrato não podem retornar dados; coberto na Task 7.

---

### Task 1: Governança, backup e schema aditivo compatível

**Files:**
- Create: `backups/issue-199/README.md`
- Create: `backups/issue-199/manifest.sha256`
- Create: `supabase/migrations/20261031000000_contratos_empreiteiros.sql`
- Create: `tests/contratos-empreiteiros-db.test.mjs`

**Interfaces:**
- Consumes: `servicos_terceirizados`, `medicoes_terceirizados`, `contas_pagar`, `obras`, `fornecedores`, `has_role` e padrões RLS existentes.
- Produces: cabeçalhos, ajustes, aditivos, anexos, retenções, links, auditoria, alçada por perfil, FKs compatíveis, backfill um-para-um e seção de rollback documentada.

- [x] **Step 1: Verificar Issues existentes no GitHub** e, se não houver uma que cubra este design, criar uma Issue em português com critérios de aceite; criar `feat/199-contratos-empreiteiros` a partir de `main` sem alterar `main` diretamente.
- [x] **Step 2: Criar backup recuperável** dos arquivos afetados e registrar Issue, commit-base, data, hashes e instruções de restauração, sem incluir `.env`, tokens ou dados de produção.
- [ ] **Step 3: Escrever testes PGlite inicialmente falhos** para tabelas/constraints, FKs, índices únicos, RLS, backfill um contrato por serviço, um cabeçalho por medição, mapeamento explícito de todos os status e preservação de `conta_pagar_id`.
- [ ] **Step 4: Executar** `node --test tests/contratos-empreiteiros-db.test.mjs` e confirmar falha pela ausência do schema novo.
- [ ] **Step 5: Implementar a migration aditiva** com as tabelas e extensões da especificação, usando `bigint` para centavos, `numeric` para quantidade/percentual, checks de status e `updated_at`.
- [ ] **Step 6: Implementar backfill idempotente** sem agrupar por obra/fornecedor: cada `servicos_terceirizados` sem cabeçalho recebe contrato legado próprio e cada `medicoes_terceirizados` sem cabeçalho recebe boletim próprio.
- [ ] **Step 7: Aplicar RLS e grants** conforme a matriz de permissões, restringindo operações de aprovação às RPCs seguras.
- [ ] **Step 8: Executar o teste de banco** e verificar rollback/reaplicação somente no banco efêmero.
- [ ] **Step 9: Commitar** migration, teste e backup com `feat: criar base de contratos de empreiteiros`.

### Task 2: Domínio de cálculo e validação

**Files:**
- Create: `src/lib/contratos-empreiteiros.schema.ts`
- Create: `src/lib/contratos-empreiteiros.ts`
- Create: `tests/contratos-empreiteiros.test.mjs`

### Task 3: Consultas, importação e mutações do contrato

**Files:**
- Create: `src/lib/contratos-empreiteiros.functions.ts`
- Create: `src/lib/contratos-empreiteiros-importacao.ts`
- Create: `tests/contratos-empreiteiros-importacao.test.mjs`
- Modify: `src/integrations/supabase/types.ts`

### Task 4: Lista, detalhe e navegação de contratos

**Files:**
- Create: `src/routes/_app/contratos-empreiteiros.tsx`
- Create: `src/routes/_app/contratos-empreiteiros.$contratoId.tsx`
- Create: `src/components/contratos-empreiteiros/contratos-lista.tsx`
- Create: `src/components/contratos-empreiteiros/contrato-resumo.tsx`
- Create: `src/components/contratos-empreiteiros/contrato-status-badge.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/routes/_app/prestadores.tsx`
- Test: `tests/e2e/contratos-empreiteiros-navegacao.spec.ts`

### Task 5: Editor, aprovação e aditivos do contrato

**Files:**
- Create: `src/components/contratos-empreiteiros/contrato-editor.tsx`
- Create: `src/components/contratos-empreiteiros/importar-orcamento-dialog.tsx`
- Create: `src/components/contratos-empreiteiros/importar-excel-dialog.tsx`
- Create: `src/components/contratos-empreiteiros/aditivo-dialog.tsx`
- Create: `src/components/contratos-empreiteiros/alcada-aprovacao-dialog.tsx`
- Modify: `supabase/migrations/20261031000000_contratos_empreiteiros.sql`
- Modify: `tests/contratos-empreiteiros-db.test.mjs`
- Test: `tests/e2e/contrato-empreiteiro-editor.spec.ts`

### Task 6: Boletim de medição e integração transacional com contas a pagar

**Files:**
- Create: `src/routes/_app/contratos-empreiteiros.$contratoId.medicoes.$medicaoId.tsx`
- Create: `src/components/contratos-empreiteiros/medicao-editor.tsx`
- Create: `src/components/contratos-empreiteiros/medicao-resumo.tsx`
- Create: `src/components/contratos-empreiteiros/ajustes-medicao-dialog.tsx`
- Modify: `supabase/migrations/20261031000000_contratos_empreiteiros.sql`
- Modify: `tests/contratos-empreiteiros-db.test.mjs`
- Test: `tests/e2e/medicao-empreiteiro.spec.ts`

### Task 7: Evidências, retenções e relatório compartilhável

**Files:**
- Create: `src/components/contratos-empreiteiros/medicao-anexos.tsx`
- Create: `src/components/contratos-empreiteiros/medicao-relatorio.tsx`
- Create: `src/components/contratos-empreiteiros/retencoes-panel.tsx`
- Create: `src/routes/medicao-empreiteiro.$token.tsx`
- Create: `src/lib/medicao-empreiteiro-publica.functions.ts`
- Modify: `supabase/migrations/20261031000000_contratos_empreiteiros.sql`
- Modify: `tests/contratos-empreiteiros-db.test.mjs`
- Test: `tests/e2e/medicao-empreiteiro-relatorio.spec.ts`

### Task 8: Regressão da Medição da Obra e compatibilidade financeira

**Files:**
- Modify: `src/routes/_app/medicoes.tsx`
- Modify: `src/components/medicoes/medicao-relatorio.tsx`
- Modify: `src/routes/_app/financeiro.tsx`
- Create: `tests/medicoes-separacao.test.mjs`
- Test: `tests/e2e/medicoes-separadas.spec.ts`

### Task 9: Aceitação, documentação e preparação de rollout

**Files:**
- Modify: `.env.example`
- Modify: `PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-10-30-medicoes-separadas-contratos-empreiteiros.md`
- Create: `docs/CONTRATOS_EMPREITEIROS_OPERACAO.md`

