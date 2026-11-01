# Cadastro e Listagem de Empreiteiros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar `/prestadores` no cadastro mestre de empreiteiros e retirar da rota a interface legada de serviços.

**Architecture:** A tabela existente `fornecedores` permanece como fonte única, filtrada por `classificacao = 'terceirizado'`. Regras de normalização, filtro e payload ficam em um módulo puro testável; um componente dedicado implementa listagem e formulário, e a rota apenas fornece permissões e renderiza o painel.

**Tech Stack:** React 19, TanStack Query, React Hook Form, Zod, Supabase, Tailwind CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-01-cadastro-listagem-empreiteiros-design.md`

## Global Constraints

- Não criar tabela, coluna ou migration destrutiva; é permitida a correção de RLS necessária para aplicar a permissão especificada.
- Não excluir dados nem converter serviços legados.
- Novos registros usam `classificacao = 'terceirizado'`.
- `/contratos-empreiteiros` continua responsável por serviços e medições.
- A entrega termina em commit local, sem push, merge ou deploy.

## Review Focus

- Fornecedor de materiais não pode aparecer na listagem de empreiteiros.
- Troca entre PF e PJ deve limpar o documento incompatível no payload.
- Busca deve funcionar com acentos, documento formatado e especialidade.
- Usuário sem `admin`/`compras` não pode receber controles de gravação.
- Registros inativos devem continuar visíveis e editáveis por usuários autorizados.

---

### Task 1: Regras de domínio do cadastro

**Files:**

- Create: `src/lib/empreiteiros.ts`
- Create: `tests/empreiteiros.test.mjs`

**Interfaces:**

- Produces: `Empreiteiro`, `EmpreiteiroFormValues`, `empreiteiroSchema`, `criarEmpreiteiroPayload(values)` e `filtrarEmpreiteiros(items, busca, status)`.

- [ ] Escrever testes para payload PF/PJ, classificação fixa, normalização de vazios e busca sem acentos.
- [ ] Rodar `node --test tests/empreiteiros.test.mjs` e confirmar falha pela ausência do módulo.
- [ ] Implementar as funções e tipos mínimos.
- [ ] Rodar o teste focado e confirmar sucesso.

### Task 2: Painel de cadastro e rota sem serviços legados

**Files:**

- Create: `src/components/prestadores/empreiteiros-cadastro-panel.tsx`
- Modify: `src/routes/_app/prestadores.tsx`
- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes: interfaces e funções da Task 1; tabela Supabase `fornecedores`.
- Produces: listagem com busca/filtro, formulário de criação/edição e rota dedicada apenas ao cadastro.

- [ ] Criar o painel com query filtrada por `terceirizado`, busca, filtro de situação, tabela responsiva e diálogo de formulário.
- [ ] Gravar via insert/update usando `criarEmpreiteiroPayload` e invalidar as queries `empreiteiros` e `fornecedores-terceirizados-contratos`.
- [ ] Substituir `PrestadoresServicosPanel` por `EmpreiteirosCadastroPanel` e aplicar permissão `admin`/`compras`.
- [ ] Atualizar `PROGRESS.md` registrando a separação e preservação dos dados legados.
- [ ] Rodar teste focado, suíte completa, ESLint focado, `git diff --check` e `npm run build`.
- [ ] Revisar o diff completo e corrigir achados importantes.
- [ ] Criar commit `feat(empreiteiros): adicionar cadastro e listagem dedicada`.

### Correções da revisão independente

- [ ] Restringir avaliação a inteiros de 1 a 5 ou nulo.
- [ ] Filtrar o seletor de contratos por `classificacao = 'terceirizado'` e integrar sua chave de cache.
- [ ] Remover a policy ampla `forn_write`, restringir terceirizados a `admin`/`compras` e preservar as permissões dos fornecedores comuns.
