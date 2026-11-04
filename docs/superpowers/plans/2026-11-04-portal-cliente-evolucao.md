# Portal do Cliente — Evolução Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar proposta comercial, decisões do cliente, cronograma visual e links de cobrança no Portal do Cliente com isolamento por obra.

**Architecture:** Uma migration aditiva cria o registro de solicitações cliente/equipe e RPCs que retornam apenas uma fotografia comercial sanitizada e dados vinculados à obra do usuário autenticado. As novas rotas do portal usam essas RPCs e as telas existentes de cronograma/financeiro passam a mostrar apenas ações suportadas pelos dados já cadastrados.

**Tech Stack:** React 19, TanStack Router/Query, Supabase/PostgreSQL/RLS, TypeScript, Tailwind/shadcn.

**Spec:** `docs/superpowers/specs/2026-11-04-portal-cliente-evolucao-design.md`

## Global Constraints

- Nunca expor custos, BDI, insumos ou composição técnica no portal.
- O cliente só lê/escreve itens associados às suas próprias obras.
- Usar migration aditiva e rollback documentado.
- Cobrança é somente um link previamente cadastrado; não simular integração bancária.

## Review Focus

- Tentativa de acessar proposta/solicitação de obra de outro cliente deve retornar vazio/erro de permissão.
- Fotografia comercial contendo chaves internas de custo não pode aparecer no resultado da RPC.
- Uma resposta já enviada não pode ser substituída pelo cliente.
- Ausência de cronograma, proposta ou URL de pagamento deve resultar em estado vazio legível.
- Vínculos legados de proposta/obra devem usar somente revisão aceita e nunca uma revisão em rascunho.

### Task 1: Camada de dados segura para proposta e decisões

**Files:**
- Create: `supabase/migrations/20261104000000_portal_cliente_evolucao.sql`
- Create: `supabase/rollbacks/20261104000000_portal_cliente_evolucao.sql`
- Test: `tests/portal-cliente-evolucao-db.test.mjs`

- [ ] Escrever testes PGlite para o escopo de obra, sanitização comercial e resposta imutável.
- [ ] Executar o teste e confirmar falha por objetos ausentes.
- [ ] Criar tabela de solicitações, políticas/RPCs de leitura e resposta, e RPC de proposta comercial sanitizada.
- [ ] Executar os testes focados e confirmar aprovação.
- [ ] Commitar migration, rollback e testes.

### Task 2: Proposta e central de decisões no portal

**Files:**
- Create: `src/routes/portal/proposta.tsx`
- Create: `src/routes/portal/decisoes.tsx`
- Modify: `src/routes/portal.tsx`
- Test: `tests/portal-cliente-evolucao-source.test.mjs`

- [ ] Escrever testes de fonte para rotas, chamadas RPC e ausência de campos internos de custo.
- [ ] Executar os testes e confirmar falha por rotas ausentes.
- [ ] Implementar telas somente leitura, resposta autenticada e itens vazios.
- [ ] Adicionar as entradas de navegação sem remover as páginas atuais.
- [ ] Executar os testes focados e commit.

### Task 3: Cronograma visual e ação financeira condicionada

**Files:**
- Modify: `src/components/cronograma-proprietario.tsx`
- Modify: `src/routes/portal/financeiro.tsx`
- Test: `tests/portal-cliente-evolucao-source.test.mjs`

- [ ] Escrever testes para estados sem etapas/URL e para a exibição exclusiva de link já existente.
- [ ] Executar teste em vermelho.
- [ ] Acrescentar linha do tempo visual e botão de pagamento condicional, sem gerar cobranças.
- [ ] Executar testes focados, suíte e build; atualizar `PROGRESS.md`; commit.
