# Prompt para implementar Medições de Obras com motor compartilhado

Copie todo o texto abaixo para a IA que executará a melhoria.

---

Você está trabalhando no repositório **ObrasFlow**. Sua missão é implementar, por fases e com segurança, a evolução de Medição de Obras usando o motor compartilhado com Contratos de Empreiteiros, sem misturar contas a receber com contas a pagar.

## Fontes obrigatórias

Antes de alterar qualquer arquivo, leia integralmente:

1. `AGENTS.md` e qualquer `AGENTS.md` aplicável às pastas tocadas.
2. `docs/superpowers/specs/2026-10-31-medicoes-motor-compartilhado-design.md`.
3. `docs/superpowers/plans/2026-10-31-medicoes-motor-compartilhado.md`.
4. `PROGRESS.md`.

O design define o produto. O plano define a ordem, os arquivos, interfaces, testes e commits. Não substitua decisões por suposições silenciosas.

## Método obrigatório

- Use `superpowers:subagent-driven-development` se houver subagentes; caso contrário use `superpowers:executing-plans`.
- Execute **uma Task por vez**, na ordem do plano.
- Para cada Task: crie issue, branch própria a partir da `main` atualizada, escreva o teste falhando, confirme RED, implemente o mínimo, confirme GREEN, rode verificações proporcionais, revise o diff, faça commit e abra PR em português.
- Não misture Tasks independentes no mesmo PR, exceto os agrupamentos explicitamente recomendados pelo plano e aprovados pelo usuário.
- Não faça merge sem autorização explícita e checks verdes.
- Após merge, acompanhe o deploy e faça smoke test online.
- Atualize `PROGRESS.md` ao fim de cada fase publicável com issue, PR, SHA, migration, testes, deploy, validação e pendências.

## Regras que nunca podem ser violadas

1. Medição de Obras gera apenas **conta a receber**.
2. Medição de Empreiteiro gera apenas **conta a pagar**.
3. Rascunho, devolvida ou em conferência não alteram progresso nem financeiro.
4. Aprovação/cancelamento/aceite/faturamento acontecem por RPC transacional, idempotente e auditada.
5. Valores novos são inteiros em centavos.
6. Nenhum item ultrapassa 100% ou saldo contratado.
7. Valores aprovados são imutáveis; correção cria versão ou estorno auditado.
8. Link público nunca consulta tabelas técnicas diretamente e nunca expõe custo interno, BDI, composição, salário ou fornecedor.
9. A fonte comercial é o escopo materializado da proposta aceita e sua revisão congelada; ambiguidade bloqueia a criação.
10. Migration é aditiva, testada em banco efêmero, idempotente e acompanhada de rollback.
11. Preserve o relatório e as tabelas legadas como fallback até a auditoria final.
12. Não faça refatorações, formatações ou limpezas fora do escopo.

## Decisões aprovadas

- Manter Medição de Obras e Medição de Empreiteiros como módulos separados.
- Compartilhar núcleo de cálculos, componentes, evidências, relatórios e timeline por adaptadores.
- Aceite do cliente é configurável por contrato/proposta e opcional por padrão.
- Quando o aceite for obrigatório, a conta a receber só nasce depois do aceite.
- Primeira entrega moderniza Medição de Obras; a UI de Empreiteiros permanece estável e migra visualmente em PR posterior.
- Devolução mantém o mesmo boletim, incrementa versão e preserva versões publicadas.
- Avanço físico usa pesos do cronograma; sem pesos, usa valor comercial e identifica o resultado como estimativa financeira.
- Evidências são opcionais por padrão, configuráveis por boletim/etapa/atividade.
- Comentários têm audiência explícita e tornam-se imutáveis após aprovação.
- Perfis: `engenharia`/`diretor`/`admin` na técnica; `diretor`/`admin` na comercial; `financeiro_civil`/`diretor`/`admin` no faturamento.

## Segurança de execução

- Antes de qualquer migration, faça auditoria somente leitura das tabelas e volumes afetados e registre contagens/somas sem dados pessoais.
- Não apague dados históricos.
- Não use `git reset --hard`, `git checkout --` destrutivo ou force push.
- Preserve alterações de outros agentes/usuários.
- Se detectar mudanças concorrentes, atualize a branch e reavalie antes de editar.
- Se uma decisão necessária não estiver no design/plano e puder mudar dados, fluxo financeiro, segurança ou UX central, pare e pergunte ao usuário.
- Se o problema for local e reversível, escolha a solução mínima e registre a decisão no PR.

## Qualidade mínima por PR

- Teste focado RED/GREEN.
- `git diff --check`.
- ESLint dos arquivos alterados sem reformatação em massa.
- Testes relacionados.
- `node --test tests/*.test.mjs` e `npm run build` antes de marcar uma fase completa.
- Migration testada em PGlite quando aplicável.
- Revisão independente do diff antes do merge.
- Smoke test online após deploy, incluindo console sem erros.

## Ordem de execução

Siga as 12 Tasks e a sequência de PRs do plano:

1. Fundação e correção de progresso.
2. Schema/RPCs v2.
3. Central e editor.
4. Evidências e relatório.
5. Mapa e indicadores.
6. Portal do Cliente.
7. Migração e rollout.
8. Em PR futuro, convergência visual de Empreiteiros.

Ao final de cada PR, informe ao usuário:

- o que mudou;
- arquivos principais;
- testes e resultados;
- migration/rollback, se houver;
- riscos ou pendências;
- URL do PR;
- se está pronto para merge ou qual decisão ainda falta.

Comece verificando o estado atual da `main`, o worktree, as issues/PRs existentes e as mudanças registradas em `PROGRESS.md`. Depois execute apenas a primeira Task ainda não concluída.
