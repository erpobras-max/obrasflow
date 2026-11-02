# Cockpit Integrado de Resultado da Obra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um cockpit financeiro por obra que consolide orçamento, compras, contratos, medições e financeiro, calcule projeção de custo e margem e permita rastrear cada valor até a origem.

**Architecture:** Uma RPC de leitura retorna linhas normalizadas e auditáveis por obra/etapa/origem, respeitando RLS e sem duplicar dados operacionais. Um motor TypeScript puro agrega valores em centavos, deduplica vínculos e calcula BAC, EV, IDC, cenários EAC, margens, saúde e alertas; componentes React reutilizam o mesmo resultado na nova aba do Financeiro e no atalho da lista de Obras.

**Tech Stack:** PostgreSQL/Supabase RLS, TypeScript, React 19, TanStack Query/Router, Recharts, PGlite, Node test runner, Vite/Nitro/Cloudflare.

**Spec:** `docs/superpowers/specs/2026-11-02-cockpit-resultado-obra-design.md`

## Global Constraints

- Valores monetários são inteiros em centavos; não usar `number` em reais no domínio.
- Não alterar nem excluir valores de orçamento, compras, contratos, medições ou financeiro.
- Transferências internas não entram em receita, custo ou margem.
- Conta financeira gerada por pedido/medição não pode duplicar o compromisso/realizado da origem.
- `orcamento_etapas.id` da revisão analítica corrente é a etapa canônica.
- Associação textual somente quando houver correspondência única dentro da mesma obra; ambiguidades vão para **Sem apropriação**.
- Ausência de dado é `null`/estado sem dados, nunca zero inventado.
- O DRE e as seis abas financeiras atuais continuam funcionando sem mudança de regra.
- Cockpit completo restrito a admin, diretor, financeiro e financeiro civil; cliente e engenharia não recebem os dados crus.
- Migration somente aditiva/de leitura e acompanhada de rollback explícito.

## Review Focus

- Uma conta a pagar vinculada a uma medição ou pedido deve aparecer uma única vez no total, preservando realizado e pago.
- Pedido legado sem quantidade recebida confiável deve aparecer como dado parcial, nunca como saldo estimado silenciosamente.
- Obra sem orçamento, sem receita ou sem avanço físico deve carregar com estados explicativos e não gerar IDC/EAC falso.
- Consulta de mês passado deve rotular compromissos como posição atual e não sugerir snapshot histórico inexistente.
- Etapa textual ambígua ou ausente deve ficar em **Sem apropriação** e os totais consolidados ainda devem fechar exatamente.

---

### Task 1: Motor de domínio do resultado da obra

**Files:**

- Create: `src/lib/resultado-obra.ts`
- Create: `tests/resultado-obra.test.mjs`

**Interfaces:**

- Consumes: linhas normalizadas da RPC definida na Task 2.
- Produces: `ResultadoObraLinha`, `ResultadoObraFiltros`, `ResultadoObraEtapa`, `ResultadoObraResumo`, `calcularResultadoObra(linhas, filtros)` e `classificarSaudeResultado(desvioPercentual)`.

- [ ] **Step 1: Escrever testes falhando para agregação e centavos**

Cobrir `calcularResultadoObra` com duas etapas e **Sem apropriação**, afirmando:

- `bacCentavos` é a soma exata do orçamento;
- realizado, pago e compromisso fecham com a soma das etapas;
- `margemPrevistaCentavos = receitaContratadaCentavos - bacCentavos`;
- valores ausentes permanecem `null`.

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `node --test tests/resultado-obra.test.mjs`

Expected: FAIL por módulo/funções ausentes.

- [ ] **Step 3: Criar tipos e agregador mínimo**

Implementar em `src/lib/resultado-obra.ts`:

```ts
export type ResultadoObraOrigem =
  | "orcamento"
  | "receita"
  | "pedido"
  | "contrato"
  | "conta_pagar"
  | "conta_receber"
  | "avanco";

export interface ResultadoObraLinha {
  obraId: string;
  obraNome: string;
  etapaId: string | null;
  etapaNome: string | null;
  origem: ResultadoObraOrigem;
  origemId: string;
  origemVinculoId: string | null;
  descricao: string;
  dataReferencia: string | null;
  valorOrcadoCentavos: number;
  valorReceitaCentavos: number;
  valorComprometidoCentavos: number;
  valorRealizadoCentavos: number;
  valorPagoCentavos: number;
  avancoFisicoPercentual: number | null;
  legadoSemSaldo: boolean;
}

export function calcularResultadoObra(
  linhas: ResultadoObraLinha[],
  filtros: ResultadoObraFiltros,
): ResultadoObraResumo;
```

- [ ] **Step 4: Escrever testes falhando de deduplicação e transferência**

Adicionar casos onde uma `conta_pagar` possui `origemVinculoId` igual ao pedido/medição e garantir que não aumenta novamente o compromisso, mas seu `valorPagoCentavos` alimenta o pago. Garantir que nenhuma origem `transferencia` seja aceita pelo tipo/normalizador.

- [ ] **Step 5: Implementar deduplicação por vínculo explícito**

Priorizar IDs persistidos. Não deduplicar por descrição, valor ou data. Linha sem vínculo permanece separada e gera alerta de qualidade.

- [ ] **Step 6: Escrever testes falhando para IDC e EAC**

Cobrir:

- cenário contratual `max(BAC, realizado + compromisso remanescente)`;
- cenário por desempenho somente com avanço >= 5% e realizado >= 1% do BAC;
- `EV = BAC × avanço` e `IDC = EV / realizado`;
- EAC principal como maior cenário válido;
- ausência de avanço confiável retorna IDC/EAC de desempenho `null`.

- [ ] **Step 7: Implementar projeções, margens e saúde**

Usar defaults: saudável até 5%, atenção >5% e <=10%, crítico >10%; margem crítica abaixo de 10% da receita.

- [ ] **Step 8: Escrever e passar testes de alertas e período**

Cobrir sem orçamento, sem receita, compromisso legado parcial, etapa ausente, título vencido relevante e `compromissoEhPosicaoAtual=true` ao consultar mês passado.

Run: `node --test tests/resultado-obra.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/resultado-obra.ts tests/resultado-obra.test.mjs
git commit -m "feat(financeiro): criar motor de resultado por obra"
```

### Task 2: Consulta consolidada, apropriação e RLS

**Files:**

- Create: `supabase/migrations/20261102000000_resultado_obra_cockpit.sql`
- Create: `supabase/rollbacks/20261102000000_resultado_obra_cockpit.sql`
- Create: `tests/resultado-obra-db.test.mjs`

**Interfaces:**

- Consumes: tabelas operacionais existentes e etapa canônica `orcamento_etapas.id`.
- Produces: tabela `resultado_obra_apropriacoes` e RPC `obter_resultado_obra(p_obra_id uuid, p_data_inicio date, p_data_fim date, p_regime text)` com colunas mapeáveis para `ResultadoObraLinha`.

- [ ] **Step 1: Criar fixture PGlite mínima e teste falhando da migration**

Criar tabelas mínimas para obras, orçamento analítico, propostas/revisões, pedidos dos dois fluxos, contratos/aditivos/medições, contas financeiras, cronograma e papéis. Afirmar que migration cria tabela, índices, constraints, RLS, RPC e grants apenas de leitura.

- [ ] **Step 2: Executar teste e confirmar RED**

Run: `node --test tests/resultado-obra-db.test.mjs`

Expected: FAIL porque migration não existe.

- [ ] **Step 3: Criar apropriação explícita e rollback**

`resultado_obra_apropriacoes` contém `id`, `obra_id`, `origem_tipo`, `origem_id`, `orcamento_etapa_id`, `created_by`, `created_at`, `updated_at`, unique `(origem_tipo, origem_id)` e FKs restritivas. RLS permite leitura conforme obra e escrita somente a admin/diretor/financeiro.

- [ ] **Step 4: Escrever teste falhando da etapa canônica**

Semear correspondência por ID, correspondência textual única e duas etapas homônimas. Afirmar que somente ID e correspondência única são apropriados; ambiguidade retorna `etapa_id = null`.

- [ ] **Step 5: Implementar normalização por fonte na RPC**

Retornar uma linha por origem/registro, com os nomes snake_case equivalentes a `ResultadoObraLinha`, `legado_sem_saldo` e metadados mínimos para montar URL de origem.

- [ ] **Step 6: Escrever teste falhando dos dois fluxos de compras**

Novo fluxo usa `qtd_recebida` para saldo. Legado com vínculo financeiro confiável calcula realizado/pago; sem saldo por item retorna compromisso bruto e `legado_sem_saldo=true`.

- [ ] **Step 7: Implementar compras, contratos e contas sem dupla contagem**

Preservar `origem_vinculo_id` nas linhas de conta. Registros cancelados não retornam. Transferências não fazem parte da RPC.

- [ ] **Step 8: Escrever testes de receita, regime e período**

Validar precedência: revisão aceita + aditivos, contrato ativo + aditivos, valor da obra e contas a receber. Validar que caixa usa liquidado/data de liquidação; competência usa obrigação/data de competência ou fallback sinalizado.

- [ ] **Step 9: Implementar receita e filtro temporal**

Não somar fontes de prioridade inferior. Retornar `receita_fonte` em metadados.

- [ ] **Step 10: Escrever testes negativos de RLS**

Admin/financeiro acessam; cliente e engenharia recebem zero linhas/erro autorizado; usuário sem acesso à obra não recebe dados. Garantir que a função não contorna RLS.

- [ ] **Step 11: Implementar policies/grants e validar rollback**

Rollback remove RPC/tabela/policies criadas sem tocar tabelas operacionais. Reaplicar migration após rollback deve funcionar.

Run: `node --test tests/resultado-obra-db.test.mjs`

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add supabase/migrations/20261102000000_resultado_obra_cockpit.sql supabase/rollbacks/20261102000000_resultado_obra_cockpit.sql tests/resultado-obra-db.test.mjs
git commit -m "feat(financeiro): consolidar fontes do resultado por obra"
```

### Task 3: Hook de dados e estado compartilhável na URL

**Files:**

- Create: `src/hooks/use-resultado-obras.ts`
- Create: `src/lib/resultado-obra-filtros.ts`
- Create: `tests/resultado-obra-filtros.test.mjs`

**Interfaces:**

- Consumes: RPC da Task 2 e `calcularResultadoObra` da Task 1.
- Produces: `parseResultadoObraSearch(search)`, `serializarResultadoObraSearch(filtros)` e `useResultadoObras(filtros)`.

- [ ] **Step 1: Escrever testes falhando dos parâmetros da URL**

Cobrir `tab=resultado`, UUID de obra válido/inválido, `regime=caixa|competencia`, período completo/incompleto e defaults `competencia`/`obra_inteira`.

- [ ] **Step 2: Implementar parser e serializador puros**

Parâmetros inválidos voltam aos defaults sem lançar exceção. Datas usam `YYYY-MM-DD`.

- [ ] **Step 3: Escrever teste de contrato do hook**

Verificar por leitura do fonte que a query key inclui obra, regime e datas; que chama `obter_resultado_obra`; que mapeia snake_case; e que passa as linhas ao motor.

- [ ] **Step 4: Implementar `useResultadoObras`**

Usar TanStack Query, abortar/invalidar corretamente por filtro e retornar loading, error, refetch e resultado. Nenhuma consulta N+1 por etapa.

- [ ] **Step 5: Executar testes**

Run: `node --test tests/resultado-obra-filtros.test.mjs tests/resultado-obra.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-resultado-obras.ts src/lib/resultado-obra-filtros.ts tests/resultado-obra-filtros.test.mjs
git commit -m "feat(financeiro): integrar filtros e consulta do cockpit"
```

### Task 4: Interface executiva e detalhamento por etapa

**Files:**

- Create: `src/components/financeiro/resultado-obras-cockpit.tsx`
- Create: `src/components/financeiro/resultado-obra-kpis.tsx`
- Create: `src/components/financeiro/resultado-obra-etapas.tsx`
- Create: `src/components/financeiro/resultado-obra-graficos.tsx`
- Create: `src/components/financeiro/resultado-obra-detalhes-sheet.tsx`
- Create: `tests/resultado-obras-ui.test.mjs`

**Interfaces:**

- Consumes: `useResultadoObras`, tipos da Task 1 e callbacks que atualizam filtros da URL.
- Produces: `ResultadoObrasCockpit({ filtros, onFiltrosChange })` e componentes visuais somente de apresentação.

- [ ] **Step 1: Escrever teste falhando do contrato visual**

Por leitura dos fontes, exigir os oito KPIs, textos **Não informado**, **Sem apropriação**, **posição atual**, estados loading/error/refetch/sem orçamento/dados parciais e ausência de botões de mutação financeira.

- [ ] **Step 2: Criar container, filtros e estados de dados**

Filtros: obra, período, datas quando aplicável e Caixa/Competência. Exibir faixa de qualidade com contagem/valor sem etapa, sem origem e fallback de competência.

- [ ] **Step 3: Criar KPIs com fórmulas explicáveis**

Cada card mostra tooltip com fonte/fórmula; `null` renderiza **Não informado**. EAC permite alternar visualmente entre contratual e desempenho sem mudar o principal conservador.

- [ ] **Step 4: Criar tabela expansível por etapa**

Colunas do spec, linha **Sem apropriação**, classificação de saúde e expansão que envia etapa ao sheet de detalhes.

- [ ] **Step 5: Criar gráficos e sheet de rastreabilidade**

Recharts compara Orçado/Comprometido/Realizado/EAC e curva acumulada quando houver datas. Sheet agrupa origens e oferece links internos derivados de metadados, sem edição.

- [ ] **Step 6: Criar alertas acionáveis**

Clique aplica filtro/etapa e abre detalhes. Não renderizar alerta genérico sem destino.

- [ ] **Step 7: Executar teste e build de componente**

Run: `node --test tests/resultado-obras-ui.test.mjs tests/resultado-obra.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/financeiro/resultado-obra-*.tsx src/components/financeiro/resultado-obras-cockpit.tsx tests/resultado-obras-ui.test.mjs
git commit -m "feat(financeiro): adicionar cockpit visual por obra"
```

### Task 5: Integração no Financeiro e na lista de Obras

**Files:**

- Modify: `src/routes/_app/financeiro.tsx`
- Modify: `src/routes/_app/obras.tsx`
- Modify: `tests/resultado-obras-ui.test.mjs`

**Interfaces:**

- Consumes: `ResultadoObrasCockpit` e parser/serializador da Task 3.
- Produces: aba `resultado` e navegação `/financeiro?tab=resultado&obra=<uuid>`.

- [ ] **Step 1: Acrescentar testes falhando de integração de rota**

Exigir `validateSearch`, sétima aba **Resultado das Obras**, sincronização de filtros com query string e botão **Resultado** na linha da obra. Garantir que as abas existentes permanecem presentes.

- [ ] **Step 2: Integrar `validateSearch` e aba no Financeiro**

Converter lista de abas para layout responsivo/rolável em telas pequenas. `activeTab` inicia pela URL e mudanças atualizam a URL sem reload.

- [ ] **Step 3: Integrar ação na lista de Obras**

Adicionar botão com permissão financeira compatível; navegação apenas, sem duplicar consultas ou UI.

- [ ] **Step 4: Executar testes focados**

Run: `node --test tests/resultado-obras-ui.test.mjs tests/resultado-obra-filtros.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_app/financeiro.tsx src/routes/_app/obras.tsx tests/resultado-obras-ui.test.mjs
git commit -m "feat(financeiro): integrar resultado por obra às rotas"
```

### Task 6: Documentação, validação integral e preparação de publicação

**Files:**

- Modify: `PROGRESS.md`
- Modify: `docs/superpowers/specs/2026-11-02-cockpit-resultado-obra-design.md` somente se a implementação exigir registrar decisão compatível.

**Interfaces:**

- Consumes: todas as tasks anteriores.
- Produces: entrega verificável, migration pronta para produção e histórico atualizado.

- [ ] **Step 1: Atualizar `PROGRESS.md`**

Registrar fontes, fórmulas, limitações de legado, permissões, migration/rollback e evidências reais de validação.

- [ ] **Step 2: Executar verificações focadas**

Run:

```bash
node --test tests/resultado-obra.test.mjs tests/resultado-obra-db.test.mjs tests/resultado-obra-filtros.test.mjs tests/resultado-obras-ui.test.mjs
npx eslint src/lib/resultado-obra.ts src/lib/resultado-obra-filtros.ts src/hooks/use-resultado-obras.ts src/components/financeiro/resultado-obra-*.tsx src/components/financeiro/resultado-obras-cockpit.tsx
git diff --check
```

Expected: todos aprovados, sem erros.

- [ ] **Step 3: Executar suíte e build completos**

Run:

```bash
node --test tests/*.test.mjs
npm run build
```

Expected: zero falhas e build Nitro/Cloudflare concluído.

- [ ] **Step 4: Validar visualmente**

Em desktop e mobile, validar obra completa, sem orçamento, sem receita, dados parciais, caixa/competência, mês passado com **posição atual**, expansão por etapa e links de origem.

- [ ] **Step 5: Revisão independente final**

Revisar diff contra o spec, corrigir achados Critical/Important com novo ciclo RED/GREEN e repetir as verificações afetadas.

- [ ] **Step 6: Commit de documentação**

```bash
git add PROGRESS.md docs/superpowers/specs/2026-11-02-cockpit-resultado-obra-design.md docs/superpowers/plans/2026-11-02-cockpit-resultado-obra.md
git commit -m "docs(financeiro): registrar cockpit de resultado por obra"
```

- [ ] **Step 7: Integração e publicação já autorizadas**

Após todas as provas verdes: atualizar `main`, mesclar a branch sem sobrescrever alterações alheias, aplicar a migration no Supabase, push para `origin/main`, aguardar Security/Deploy Cloudflare e validar `/financeiro?tab=resultado` online. Não declarar conclusão antes dos dois workflows e da validação online.
