# Itens comerciais em proposta manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma proposta manual tenha itens comerciais editáveis, com cálculo automático e persistência na fotografia comercial publicada.

**Architecture:** O editor mantém uma lista local de itens manuais e a envia junto da configuração/fotografia ao salvar ou publicar. A migration normaliza esses itens no JSON comercial e recalcula o valor da proposta; propostas originadas de orçamento continuam usando o fluxo existente.

**Tech Stack:** React, TypeScript, Supabase/PostgreSQL, PGlite tests.

## Global Constraints

- Não alterar custos, insumos ou composições técnicas de propostas baseadas em orçamento.
- Quantidade e valor unitário devem ser números não negativos; total da linha é calculado no cliente e no servidor.
- Uma proposta enviada/aceita continua congelada.

## Review Focus

- Adicionar, editar e remover itens deve atualizar o total global.
- Valores decimais brasileiros e quantidade zero devem ser tratados sem NaN.
- Salvar rascunho e publicar devem persistir a mesma lista de itens.
- Reabrir uma proposta manual deve reconstruir os itens salvos.
- Fluxo legado de orçamento não pode perder etapas ou preços.

### Task 1: Modelo e persistência dos itens manuais

**Files:**
- Modify: `supabase/migrations/20261113120000_proposta_independente_obra.sql`
- Modify: `src/lib/proposta-orcamento.functions.ts`
- Test: `tests/propostas-editor-db.test.mjs`

- [ ] Escrever testes para salvar/publicar itens manuais e recalcular valor total.
- [ ] Alterar a fotografia manual para armazenar `itens` e uma etapa comercial editável.
- [ ] Recalcular `propostas.valor_total` no servidor.
- [ ] Executar testes focados.

### Task 2: Editor inline

**Files:**
- Modify: `src/components/propostas/editor-proposta-comercial.tsx`
- Modify: `src/hooks/use-proposta-editor.ts`
- Test: `tests/propostas-rota-unica.test.mjs`

- [ ] Adicionar estado de itens manuais e controles de inclusão/remoção/edição.
- [ ] Enviar a fotografia atualizada ao salvar/publicar.
- [ ] Mostrar total global calculado e estado vazio orientando a inclusão do primeiro item.
- [ ] Executar testes e build.

### Task 3: Documentação e verificação

**Files:**
- Modify: `PROGRESS.md`

- [ ] Registrar o novo fluxo e a validação.
- [ ] Executar `node --test tests/*.test.mjs` e `npm run build`.
- [ ] Revisar o diff e preparar branch para PR.
