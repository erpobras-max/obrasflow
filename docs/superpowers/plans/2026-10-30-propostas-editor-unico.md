# Propostas Comerciais com Editor Único — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir progressivamente o fluxo antigo de propostas pelo Editor Comercial persistente, originado obrigatoriamente de uma revisão de orçamento e capaz de excluir definitivamente apenas rascunhos.

**Architecture:** Regras determinísticas de configuração, fotografia e adaptação ficam em funções puras TypeScript. O ciclo de vida e a exclusão ficam em RPCs transacionais `SECURITY DEFINER`; a rota React passa a orquestrar hooks/componentes focados e mantém compatibilidade de leitura com propostas legadas. Estruturas antigas do banco permanecem durante a transição, mas deixam de ter entrada na interface.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Supabase/PostgreSQL, PGlite, Node Test Runner, Playwright, Vite.

**Spec:** `docs/superpowers/specs/2026-10-30-propostas-editor-unico-design.md`

## Global Constraints

- Issue obrigatória: `#200`; branch: `fix/200-consolidar-propostas-editor`.
- Não misturar alterações com contratos de empreiteiros nem alterar seus arquivos/migrations.
- Toda proposta nova exige obra, orçamento e `orcamento_revisao_id` válidos.
- Revisão `enviada` ou proposta `aceita` é imutável; publicação transforma o próprio rascunho em `enviada`.
- Exclusão definitiva somente para `rascunho`; demais status permanecem para histórico.
- Fotografia comercial nunca contém custo interno, BDI, insumos, coeficientes ou margem.
- Tabelas e dados legados permanecem disponíveis para leitura e rollback.
- Nenhuma PR é mesclada nem publicada sem autorização explícita do responsável.

## Review Focus

- Configuração nula, parcial ou de versão antiga deve ser normalizada sem `.includes()` em `undefined` — coberto na Task 1.
- Dois cliques/sessões concorrentes não podem criar dois rascunhos comuns para a mesma revisão — coberto na Task 2.
- Fotografia manipulada pelo navegador não pode gravar campos técnicos proibidos — coberto na Task 2.
- Proposta legada com múltiplas revisões possíveis deve exigir escolha explícita — coberto na Task 3.
- Falha de permissão ou vínculo na exclusão deve manter a linha visível e explicar o motivo — coberto nas Tasks 2 e 7.

---

### Task 1: Normalização segura da configuração comercial

**Files:**
- Modify: `src/lib/proposta-orcamento.functions.ts:25-130`
- Modify: `src/components/propostas/editor-proposta-comercial.tsx:38-171`
- Test: `tests/editor-proposta-comercial.test.mjs`

**Interfaces:**
- Consumes: `ConfiguracaoPropostaComercial`, `configuracaoPropostaComercialPadrao` existentes.
- Produces: `normalizarConfiguracaoProposta(valor?: Partial<ConfiguracaoPropostaComercial> | null): ConfiguracaoPropostaComercial`; `EditorPropostaComercial` inicializa e ressincroniza estado somente com essa função.

- [x] **Step 1: Escrever testes falhos de normalização**

Adicionar casos que chamem `normalizarConfiguracaoProposta(undefined)`, configuração básica sem arrays e configuração com `etapasOcultas: null`; afirmar defaults completos, arrays vazios, mapas vazios e preservação de textos fornecidos.

- [x] **Step 2: Executar o teste e confirmar a regressão**

Run: `node --test tests/editor-proposta-comercial.test.mjs`

Expected: FAIL porque `normalizarConfiguracaoProposta` não existe.

- [x] **Step 3: Implementar a função pura**

Mesclar com `configuracaoPropostaComercialPadrao`; normalizar arrays com `Array.isArray`, mapas com objeto simples e booleanos/textos pelos tipos esperados. Alterar o default de `criarFotografiaProposta` para usar a configuração comercial completa.

- [x] **Step 4: Corrigir a inicialização do editor**

Trocar o import de `configuracaoPropostaPadrao` pela função normalizadora, adicionar `configuracaoInicial?: Partial<ConfiguracaoPropostaComercial> | null` às props e ressincronizar o estado quando mudar a revisão aberta. Manter `.includes()` apenas sobre arrays já normalizados.

- [x] **Step 5: Executar testes e lint focados**

Run: `node --test tests/editor-proposta-comercial.test.mjs tests/proposta-orcamento.test.mjs`

Expected: todos PASS e reprodução do erro `Cannot read properties of undefined (reading 'includes')` coberta.

Run: `npx eslint src/lib/proposta-orcamento.functions.ts src/components/propostas/editor-proposta-comercial.tsx`

Expected: exit 0.

- [x] **Step 6: Commit**

```bash
git add src/lib/proposta-orcamento.functions.ts src/components/propostas/editor-proposta-comercial.tsx tests/editor-proposta-comercial.test.mjs tests/proposta-orcamento.test.mjs
git commit -m "fix(propostas): normalizar configuracao do editor comercial"
```

### Task 2: Ciclo de vida transacional e exclusão de rascunhos

**Files:**
- Create: `supabase/migrations/20261030180000_propostas_editor_unico.sql`
- Create: `tests/propostas-editor-db.test.mjs`
- Modify: `src/integrations/supabase/types.ts` somente se a geração local estiver disponível; caso contrário documentar a pendência e tipar o adaptador sem editar o arquivo gerado manualmente.

**Interfaces:**
- Consumes: `orcamento_revisoes.fotografia`, `propostas.orcamento_revisao_id`, `proposta_revisoes` e papéis atuais.
- Produces:
  - `public.criar_proposta_de_revisao(p_orcamento_revisao_id uuid, p_configuracao jsonb, p_fotografia jsonb, p_duplicar boolean default false) RETURNS uuid`;
  - `public.salvar_rascunho_proposta(p_proposta_id uuid, p_configuracao jsonb, p_fotografia jsonb) RETURNS uuid`;
  - `public.publicar_rascunho_proposta(p_proposta_id uuid, p_configuracao jsonb, p_fotografia jsonb) RETURNS uuid`;
  - `public.excluir_proposta_rascunho(p_proposta_id uuid) RETURNS boolean`;
  - `public.sanitizar_fotografia_proposta(p_valor jsonb) RETURNS jsonb` privada ao papel authenticated.

- [x] **Step 1: Criar banco mínimo e testes SQL falhos**

Em PGlite, criar papéis, enums e tabelas mínimas de cliente, obra, orçamento, revisões, propostas, revisões de proposta, itens, contratos e cronogramas. Testar:

- criação comum retorna rascunho existente na repetição;
- `p_duplicar=true` cria variante distinta;
- salvar atualiza apenas revisão `rascunho`;
- publicar muda a mesma linha e `propostas.status` para `enviada`;
- quando não há rascunho e a última revisão já não está enviada/aceita, salvar inicia o próximo número; revisão enviada deve ser rejeitada ou expirada antes de uma nova negociação;
- sanitização remove recursivamente chaves de custo/BDI/insumo/coeficiente/margem;
- exclusão remove rascunho e confirma ausência;
- exclusão rejeita `enviada`, `aceita`, `rejeitada` e `expirada`;
- financeiro pode criar/salvar/publicar, mas somente admin/diretor pode excluir;
- duas criações comuns para a mesma revisão convergem no mesmo rascunho.

- [x] **Step 2: Executar e confirmar falha**

Run: `node --test tests/propostas-editor-db.test.mjs`

Expected: FAIL porque a migration/RPCs não existem.

- [x] **Step 3: Implementar schema complementar**

Adicionar `updated_at` e `enviada_at` a `proposta_revisoes`, com trigger de atualização. Usar bloqueio transacional por revisão na criação comum para impedir duplicata concorrente; a duplicação explícita ignora a reutilização do rascunho.

- [x] **Step 4: Implementar sanitização e RPCs**

Todas as funções usam `SECURITY DEFINER SET search_path = public`, validam `auth.uid()`, papel, status e origem. `salvar` atualiza o rascunho atual ou cria o próximo número somente se a revisão anterior estiver `rejeitada`/`expirada`; nunca abre novo rascunho sobre uma revisão ainda `enviada` ou `aceita`. `salvar`/`publicar` aplicam `sanitizar_fotografia_proposta` no servidor. `publicar` atualiza a linha rascunho existente, nunca insere uma cópia silenciosa. `excluir` verifica `rascunho`, executa em uma transação e confirma `FOUND`.

- [x] **Step 5: Restringir permissões e documentar rollback no SQL**

Revogar execução pública; conceder somente a `authenticated`. Incluir bloco de rollback comentado para funções, trigger e colunas novas, sem remover tabelas/dados legados.

- [x] **Step 6: Executar os testes SQL**

Run: `node --test tests/propostas-editor-db.test.mjs tests/orcamento-analitico-db.test.mjs`

Expected: todos PASS.

- [x] **Step 7: Commit**

```bash
git add supabase/migrations/20261030180000_propostas_editor_unico.sql tests/propostas-editor-db.test.mjs src/integrations/supabase/types.ts
git commit -m "feat(propostas): adicionar ciclo de vida transacional de revisoes"
```

### Task 3: Adaptador de dados do editor e compatibilidade legada

**Files:**
- Create: `src/lib/propostas/proposta-editor.types.ts`
- Create: `src/lib/propostas/proposta-editor-adapter.ts`
- Create: `tests/proposta-editor-adapter.test.mjs`
- Modify: `src/components/propostas/editor-proposta-comercial.tsx:47-81`

**Interfaces:**
- Consumes: fotografia de `proposta_revisoes`, fotografia de `orcamento_revisoes`, linhas analíticas e `propostas_itens`.
- Produces:
  - `PropostaEditorData`, `PropostaRevisaoResumo` e `PropostaLegadaResolucao` em arquivo de tipos;
  - `adaptarFotografiaParaEditor(fotografia: unknown, contexto: ContextoProposta): PropostaEditorData`;
  - `resolverCandidatasLegado(revisoes: RevisaoOrcamentoResumo[]): { tipo: 'nenhuma' | 'unica' | 'multipla'; revisaoId?: string }`;
  - `adaptarItensLegados(itens: ItemPropostaLegado[]): EtapaEditor[]`.

- [x] **Step 1: Escrever testes falhos do adaptador**

Cobrir fotografia nova, itens legados, ausência de origem, uma candidata automática e múltiplas candidatas exigindo escolha. Afirmar valores em centavos, ordem de etapas e ausência de campos internos no resultado.

- [x] **Step 2: Executar e confirmar falha**

Run: `node --test tests/proposta-editor-adapter.test.mjs`

Expected: FAIL por módulos inexistentes.

- [x] **Step 3: Implementar tipos e funções puras**

Mover `PropostaEditorData` do componente para o arquivo de tipos. O adaptador não consulta Supabase; recebe dados já carregados e retorna união discriminada para estados `pronta`, `escolher_revisao` ou `sem_origem`.

- [x] **Step 4: Executar testes e lint**

Run: `node --test tests/proposta-editor-adapter.test.mjs tests/editor-proposta-comercial.test.mjs`

Expected: PASS.

Run: `npx eslint src/lib/propostas/proposta-editor.types.ts src/lib/propostas/proposta-editor-adapter.ts src/components/propostas/editor-proposta-comercial.tsx`

Expected: exit 0.

- [x] **Step 5: Commit**

```bash
git add src/lib/propostas src/components/propostas/editor-proposta-comercial.tsx tests/proposta-editor-adapter.test.mjs
git commit -m "refactor(propostas): isolar adaptacao do editor e legado"
```

### Task 4: Hook de carregamento, rascunho, publicação e histórico

**Files:**
- Create: `src/hooks/use-proposta-editor.ts`
- Create: `src/components/propostas/historico-revisoes-proposta.tsx`
- Modify: `src/components/propostas/editor-proposta-comercial.tsx:76-208,774-808`
- Test: `tests/proposta-editor-source.test.mjs`

**Interfaces:**
- Consumes: RPCs da Task 2 e adaptadores da Task 3.
- Produces: `usePropostaEditor(propostaId: string | null)` retornando `{ estado, editorData, configuracao, revisoes, salvarRascunho, publicarRascunho, selecionarRevisaoLegada, abrirRevisaoHistorica, isPending }`.

- [x] **Step 1: Escrever teste estrutural falho**

Verificar que o hook consulta `proposta_revisoes` ordenado por número, restaura `configuracao`, chama `salvar_rascunho_proposta`/`publicar_rascunho_proposta` e invalida `['propostas']`, `['proposta-editor', propostaId]` e `['proposta-revisoes', propostaId]`. Verificar que o editor não contém histórico simulado.

- [x] **Step 2: Executar e confirmar falha**

Run: `node --test tests/proposta-editor-source.test.mjs`

Expected: FAIL porque hook/componente ainda não existem.

- [x] **Step 3: Implementar o hook com estados explícitos**

Carregar proposta, cliente, revisão ativa e histórico; usar adaptador legado somente quando não houver revisão. Não escolher automaticamente entre múltiplas revisões. Propagar mensagens das RPCs sem mascará-las com sucesso local.

- [x] **Step 4: Implementar histórico real**

Extrair o diálogo para `HistoricoRevisoesProposta`; apresentar número, status, data, valor e ação de visualizar/imprimir a fotografia congelada. Revisões históricas são somente leitura.

- [x] **Step 5: Conectar o editor**

Receber configuração persistida e lista de revisões pelas props; remover toasts de sucesso falsos e histórico construído do estado atual. Desabilitar edição fora do rascunho e manter impressão disponível.

- [x] **Step 6: Executar testes e lint**

Run: `node --test tests/proposta-editor-source.test.mjs tests/proposta-editor-adapter.test.mjs tests/editor-proposta-comercial.test.mjs`

Expected: PASS.

Run: `npx eslint src/hooks/use-proposta-editor.ts src/components/propostas/historico-revisoes-proposta.tsx src/components/propostas/editor-proposta-comercial.tsx`

Expected: exit 0.

- [x] **Step 7: Commit**

```bash
git add src/hooks/use-proposta-editor.ts src/components/propostas/historico-revisoes-proposta.tsx src/components/propostas/editor-proposta-comercial.tsx tests/proposta-editor-source.test.mjs
git commit -m "feat(propostas): persistir editor e historico de revisoes"
```

### Task 5: Criação obrigatória a partir de obra e revisão

**Files:**
- Create: `src/components/propostas/nova-proposta-orcamento-dialog.tsx`
- Create: `src/lib/propostas/proposta-criacao.ts`
- Create: `tests/proposta-criacao.test.mjs`
- Modify: `src/routes/_app/comercial.propostas.tsx:47-157,482-519`

**Interfaces:**
- Consumes: `criar_proposta_de_revisao`, `criarFotografiaProposta`, obras → orçamentos → revisões.
- Produces: `NovaPropostaOrcamentoDialog` com `onCriada(propostaId: string): void`; `validarSelecaoNovaProposta(selecao): ResultadoSelecao`; ação explícita `duplicar=true` somente a partir de uma proposta/revisão já escolhida.

- [ ] **Step 1: Escrever testes falhos de seleção**

Cobrir ausência de obra, obra sem orçamento, orçamento sem revisão, seleção válida, rascunho existente e duplicação explícita. Afirmar que cliente/título/valor vêm da obra e da fotografia, não de campos livres.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/proposta-criacao.test.mjs`

Expected: FAIL por módulo inexistente.

- [ ] **Step 3: Implementar validação pura e diálogo encadeado**

Consultar somente obras com orçamento; ao escolher obra, listar seus orçamentos; ao escolher orçamento, listar revisões por número/data. Confirmar chama a RPC com configuração normalizada e fotografia comercial sanitizável, então abre o ID retornado.

- [ ] **Step 4: Implementar tratamento de rascunho existente e duplicação**

Quando a RPC comum retornar proposta existente, informar e abrir o rascunho. Expor `Duplicar proposta` apenas como ação consciente em proposta existente, com confirmação e `p_duplicar=true`.

- [ ] **Step 5: Conectar à listagem**

O botão `Nova proposta` abre somente esse diálogo. Remover o botão `Abrir Editor Comercial` que seleciona a primeira linha arbitrariamente. Manter deep link `?propostaId=` abrindo o editor correto.

- [ ] **Step 6: Executar testes e lint**

Run: `node --test tests/proposta-criacao.test.mjs tests/proposta-editor-source.test.mjs`

Expected: PASS.

Run: `npx eslint src/components/propostas/nova-proposta-orcamento-dialog.tsx src/lib/propostas/proposta-criacao.ts src/routes/_app/comercial.propostas.tsx`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/propostas/nova-proposta-orcamento-dialog.tsx src/lib/propostas/proposta-criacao.ts src/routes/_app/comercial.propostas.tsx tests/proposta-criacao.test.mjs
git commit -m "feat(propostas): criar proposta somente a partir do orcamento"
```

### Task 6: Remover o modo antigo da interface

**Files:**
- Modify: `src/routes/_app/comercial.propostas.tsx:1-1080`
- Delete: `src/components/propostas/proposta-impressao.tsx`
- Delete: `src/components/propostas/catalogo-propostas.tsx`
- Create: `tests/propostas-rota-unica.test.mjs`

**Interfaces:**
- Consumes: `NovaPropostaOrcamentoDialog` da Task 5 e `usePropostaEditor` da Task 4.
- Produces: rota enxuta com listagem, editor único e ações comerciais; nenhum consumidor dos componentes antigos.

- [ ] **Step 1: Escrever teste estrutural falho**

Ler a rota como texto e afirmar ausência de `PropostaFormDialog`, `PropostaImpressao`, `CatalogoPropostas`, `setEditTarget`, `setPrintTarget`, `react-hook-form` e botões antigos; afirmar presença de `NovaPropostaOrcamentoDialog`, `usePropostaEditor` e abertura do editor pelo título/ação.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/propostas-rota-unica.test.mjs`

Expected: FAIL porque o modo antigo ainda está embutido/importado.

- [ ] **Step 3: Remover imports, estados, diálogo e formulário antigos**

Excluir o `PropostaFormDialog` inline e toda lógica de catálogo/itens manuais. Preservar filtros, tabela, aceite/rejeição, obra, contrato e exclusão.

- [ ] **Step 4: Remover componentes sem consumidores**

Confirmar com `rg "PropostaImpressao|CatalogoPropostas" src`; se somente os próprios arquivos restarem, removê-los. A impressão passa exclusivamente por `EditorPropostaComercial`.

- [ ] **Step 5: Executar testes e lint**

Run: `node --test tests/propostas-rota-unica.test.mjs tests/proposta-criacao.test.mjs tests/proposta-editor-source.test.mjs`

Expected: PASS.

Run: `npx eslint src/routes/_app/comercial.propostas.tsx src/components/propostas`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A src/routes/_app/comercial.propostas.tsx src/components/propostas tests/propostas-rota-unica.test.mjs
git commit -m "refactor(propostas): remover formulario e impressao antigos"
```

### Task 7: Exclusão confirmada, diagnóstico da PROP-2026-0008 e proteção por status

**Files:**
- Modify: `src/routes/_app/comercial.propostas.tsx`
- Modify: `src/hooks/use-proposta-editor.ts` ou criar `src/hooks/use-excluir-proposta.ts` se a rota ficar maior que o padrão local.
- Modify: `tests/propostas-rota-unica.test.mjs`
- Create: `scripts/diagnosticar_proposta_0008.sql`

**Interfaces:**
- Consumes: `excluir_proposta_rascunho` da Task 2.
- Produces: `excluirProposta(id: string): Promise<void>` sem remoção otimista; script somente leitura que lista proposta, status, revisões, obra, contratos, cronogramas e políticas/vínculos relevantes.

- [ ] **Step 1: Ampliar teste falho da rota**

Afirmar que a exclusão usa `rpc('excluir_proposta_rascunho')`, não possui `onMutate` removendo cache, mostra loading e só invalida `['propostas']` após sucesso. Afirmar que o botão de lixeira só aparece para rascunho e admin/diretor.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/propostas-rota-unica.test.mjs`

Expected: FAIL porque a rota ainda usa sequência de deletes e remoção otimista.

- [ ] **Step 3: Implementar exclusão confirmada**

Substituir toda sequência atual pela RPC. Manter a linha durante a requisição, impedir clique duplo e exibir mensagem devolvida pelo banco em falha.

- [ ] **Step 4: Criar diagnóstico somente leitura**

O script recebe/localiza `PROP-2026-0008` e retorna os vínculos sem excluir ou atualizar nada. Executá-lo no Supabase somente na fase de publicação autorizada; registrar a causa encontrada na Issue #200 antes de chamar a RPC em produção.

- [ ] **Step 5: Executar testes e lint**

Run: `node --test tests/propostas-rota-unica.test.mjs tests/propostas-editor-db.test.mjs`

Expected: PASS.

Run: `npx eslint src/routes/_app/comercial.propostas.tsx src/hooks/use-proposta-editor.ts`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_app/comercial.propostas.tsx src/hooks/use-proposta-editor.ts tests/propostas-rota-unica.test.mjs scripts/diagnosticar_proposta_0008.sql
git commit -m "fix(propostas): confirmar exclusao definitiva de rascunhos"
```

### Task 8: Aceite, histórico e transições coerentes

**Files:**
- Modify: `supabase/migrations/20261030180000_propostas_editor_unico.sql`
- Modify: `src/routes/_app/comercial.propostas.tsx`
- Modify: `src/components/propostas/historico-revisoes-proposta.tsx`
- Modify: `tests/propostas-editor-db.test.mjs`
- Modify: `tests/propostas-rota-unica.test.mjs`

**Interfaces:**
- Consumes: estados de proposta/revisão da Task 2.
- Produces: transições sincronizadas `rascunho → enviada → aceita|rejeitada|expirada`; histórico sempre correspondente ao status vigente.

- [ ] **Step 1: Escrever testes falhos de transição**

Testar que aceitar/rejeitar/expirar uma proposta atualiza também sua revisão ativa; aceitar rascunho é rejeitado; revisão ainda enviada bloqueia um novo rascunho; rejeitada/expirada permite iniciar o próximo número; proposta aceita não pode ganhar novo rascunho nem ser excluída; revisão enviada permanece visualizável e imprimível.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/propostas-editor-db.test.mjs tests/propostas-rota-unica.test.mjs`

Expected: FAIL nas transições ainda não sincronizadas.

- [ ] **Step 3: Implementar transição atômica**

Adicionar RPC `public.alterar_status_proposta_editor(p_proposta_id uuid, p_status text) RETURNS boolean`, permitindo apenas `enviada → aceita|rejeitada|expirada`, atualizando proposta e revisão enviada ativa na mesma transação. Conectar os botões da listagem à RPC.

- [ ] **Step 4: Ajustar histórico e bloqueios do editor**

Usar status da revisão selecionada; edição somente em rascunho, impressão em qualquer status e ações comerciais somente quando a transição for válida.

- [ ] **Step 5: Executar testes e lint**

Run: `node --test tests/propostas-editor-db.test.mjs tests/propostas-rota-unica.test.mjs tests/editor-proposta-comercial.test.mjs`

Expected: PASS.

Run: `npx eslint src/routes/_app/comercial.propostas.tsx src/components/propostas/historico-revisoes-proposta.tsx`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261030180000_propostas_editor_unico.sql src/routes/_app/comercial.propostas.tsx src/components/propostas/historico-revisoes-proposta.tsx tests/propostas-editor-db.test.mjs tests/propostas-rota-unica.test.mjs
git commit -m "feat(propostas): sincronizar status e historico comercial"
```

### Task 9: Verificação integrada, documentação e preparação da PR

**Files:**
- Create: `tests/e2e/propostas-editor-unico.spec.ts`
- Modify: `PROGRESS.md`
- Modify: `docs/superpowers/plans/2026-10-30-propostas-editor-unico.md` marcando somente passos efetivamente concluídos.

**Interfaces:**
- Consumes: fluxo completo das Tasks 1–8.
- Produces: evidência de aceite, documentação operacional e branch pronta para revisão.

- [ ] **Step 1: Criar cenário Playwright autenticado ou fixture controlada**

Cobrir: abrir proposta sem erro no console; criar por obra/orçamento/revisão; salvar e recarregar rascunho; publicar como enviada; abrir histórico; imprimir pelo editor; ausência do formulário/impressão antigos; excluir um rascunho e confirmar que não retorna. Se o ambiente não fornecer autenticação automatizável, manter o cenário marcado por variável de credencial e executar manualmente o mesmo roteiro no preview.

- [ ] **Step 2: Rodar toda a suíte unitária/SQL**

Run: `node --test tests/*.test.mjs`

Expected: todos PASS.

- [ ] **Step 3: Rodar lint e build**

Run: `npm run lint`

Expected: exit 0 ou somente avisos preexistentes documentados, sem novos erros.

Run: `npm run build`

Expected: build Vite/Nitro concluído e patch Cloudflare aplicado.

- [ ] **Step 4: Rodar E2E/preview focado**

Run: `npx playwright test tests/e2e/propostas-editor-unico.spec.ts --project=chromium`

Expected: PASS; se depender de credenciais externas, anexar evidência do roteiro manual equivalente e não declarar automação aprovada.

- [ ] **Step 5: Atualizar `PROGRESS.md`**

Registrar Issue/branch, mudança para editor único, migration/RPCs, compatibilidade legada, causa da `PROP-2026-0008`, comandos e resultados reais. Não afirmar deploy antes do workflow de produção concluir.

- [ ] **Step 6: Commit final de evidências**

```bash
git add tests/e2e/propostas-editor-unico.spec.ts PROGRESS.md docs/superpowers/plans/2026-10-30-propostas-editor-unico.md
git commit -m "docs(propostas): registrar validacao do editor unico"
```

- [ ] **Step 7: Revisar a branch antes da PR**

Run: `git diff --check origin/main...HEAD`

Expected: sem whitespace errors.

Run: `git log --oneline origin/main..HEAD`

Expected: commits pequenos correspondentes às Tasks 1–9.

- [ ] **Step 8: Abrir PR sem mesclar**

Título sugerido: `feat(propostas): consolidar fluxo no editor comercial`

Descrição: `Closes #200`, resumo, validações executadas, migration `20261030180000_propostas_editor_unico.sql`, diagnóstico da `PROP-2026-0008`, impacto de publicação e rollback. Aguardar autorização explícita antes de merge/deploy.
