# Cadastro de Empreiteiros no Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar explícito o acesso ao cadastro de empreiteiros e deixar a busca do menu legível.

**Architecture:** Reaproveitar a rota `/prestadores` e alterar somente a apresentação do item de navegação e as classes visuais do campo de busca. Nenhuma rota, persistência ou migration será criada.

**Tech Stack:** React, TypeScript, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-01-cadastro-empreiteiros-menu-design.md`

## Global Constraints

- Manter `/prestadores` como destino do cadastro.
- Manter `/contratos-empreiteiros` como item separado logo abaixo.
- Não criar tela, rota, tabela ou migration.
- Preservar posição e dimensões atuais da busca.

## Review Focus

- O rótulo deve indicar inequivocamente **Cadastro de empreiteiros** e continuar apontando para `/prestadores`.
- **Contratos de empreiteiros** deve permanecer no mesmo grupo e em item separado.
- Placeholder, lupa e texto digitado devem ter contraste sobre o fundo branco.
- O foco do teclado deve continuar visível.
- A alteração não pode remover a busca tolerante a acentos nem os grupos persistentes.

---

### Task 1: Clareza do grupo Empreiteiros e da busca

**Files:**
- Modify: `tests/navigation-menu.test.mjs:12-33,72-88`
- Modify: `src/lib/navigation-menu.ts:80-90`
- Modify: `src/components/layout/app-sidebar.tsx:228-239`
- Modify: `PROGRESS.md`
- Create: `docs/superpowers/specs/2026-11-01-cadastro-empreiteiros-menu-design.md`
- Create: `docs/superpowers/plans/2026-11-01-cadastro-empreiteiros-menu.md`

**Interfaces:**
- Consumes: `getNavigationGroups("civil")` e a rota existente `/prestadores`.
- Produces: item com `label: "Cadastro de empreiteiros"`, seguido por `label: "Contratos de empreiteiros"`, e busca com classes explícitas de contraste.

- [ ] **Step 1: Escrever os testes que exigem os novos rótulos e contraste**

Adicionar asserções que localizam o grupo `empreiteiros`, verificam a ordem/rótulos/destinos e exigem no código da sidebar `bg-white`, `text-slate-900`, `placeholder:text-slate-500` e lupa `text-slate-500`.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `node --test tests/navigation-menu.test.mjs`
Expected: FAIL porque os rótulos e as classes atuais ainda são genéricos e têm baixo contraste.

- [ ] **Step 3: Implementar a alteração mínima**

Em `src/lib/navigation-menu.ts`, usar exatamente **Cadastro de empreiteiros** para `/prestadores` e **Contratos de empreiteiros** para `/contratos-empreiteiros`. Em `app-sidebar.tsx`, manter o campo atual, aplicar fundo branco, texto `slate-900`, placeholder/lupa `slate-500`, borda neutra e foco visível.

- [ ] **Step 4: Executar o teste focado e confirmar sucesso**

Run: `node --test tests/navigation-menu.test.mjs`
Expected: todos os testes do arquivo aprovados.

- [ ] **Step 5: Atualizar o progresso e executar verificações finais**

Registrar a melhoria em `PROGRESS.md`, executar `node --test tests/*.test.mjs`, ESLint focado nos arquivos TypeScript alterados e `npm run build`.

- [ ] **Step 6: Commitar a entrega**

```bash
git add PROGRESS.md docs/superpowers/specs/2026-11-01-cadastro-empreiteiros-menu-design.md docs/superpowers/plans/2026-11-01-cadastro-empreiteiros-menu.md tests/navigation-menu.test.mjs src/lib/navigation-menu.ts src/components/layout/app-sidebar.tsx
git commit -m "fix(menu): destacar cadastro de empreiteiros e busca"
```
