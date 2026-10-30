# Propostas comerciais com editor único — Issue #200

## Intenção

Eliminar a mistura entre o formulário/impressão antigos e o novo Editor Comercial. Toda proposta nova deve nascer de uma obra que possua orçamento e revisão publicável, ser configurada no editor único e conservar rascunhos e revisões imutáveis. Propostas legadas continuam acessíveis durante a transição, sem exclusão automática de dados.

## Objetivos

- Usar o Editor Comercial como única interface para criar, editar, visualizar e imprimir propostas.
- Corrigir o erro ao abrir o editor causado por configuração comercial incompleta.
- Fazer `Salvar rascunho` e `Publicar nova revisão` persistirem dados reais.
- Exigir obra, orçamento e revisão de orçamento como origem de toda proposta nova.
- Preservar propostas antigas por adaptação progressiva.
- Tornar a exclusão definitiva, atômica e auditável, com erro compreensível quando bloqueada.
- Manter as ações comerciais já úteis: aceitar, rejeitar, gerar/ver contrato e abrir obra.

## Não objetivos

- Não redesenhar orçamento, contratos de clientes ou contratos de empreiteiros.
- Não apagar imediatamente tabelas legadas como `propostas_itens` ou catálogos antigos.
- Não migrar em massa todas as propostas antigas durante a publicação inicial.
- Não alterar proposta aceita; ela permanece congelada e uma nova negociação exige duplicação/nova proposta.

## Restrições

- O repositório exige Issue, branch própria, PR e autorização antes do merge.
- A Issue correspondente é a #200 e a branch é `fix/200-consolidar-propostas-editor`.
- O trabalho deve ficar isolado da branch usada pela implementação de contratos de empreiteiros.
- Dados de custo interno, insumos, coeficientes, BDI e margem não podem aparecer no documento do cliente.
- Alterações de banco devem ser reversíveis e compatíveis com propostas existentes.

## Abordagens consideradas

### 1. Substituição progressiva — escolhida

Manter a tabela/listagem de propostas, trocar todas as entradas pelo editor novo e adaptar propostas antigas quando forem abertas. As estruturas legadas permanecem temporariamente apenas para leitura/compatibilidade. Tem menor risco, permite rollback e evita migração destrutiva.

### 2. Substituição total imediata — rejeitada

Migrar todas as propostas e eliminar o fluxo e estruturas antigas em uma única publicação. Simplificaria o estado final mais cedo, mas aumentaria o risco de perda, inconsistência e indisponibilidade para propostas antigas.

## Fluxo final da interface

### Listagem `/comercial/propostas`

A listagem continua sendo a tela inicial e conserva filtros, número, título, cliente, status, validade e valor. O título e a ação principal abrem o Editor Comercial.

As ações por proposta serão:

- abrir editor;
- aceitar ou rejeitar, quando permitido;
- abrir obra e gerar/ver contrato após aceite;
- excluir, conforme permissão.

Serão removidos da tela:

- formulário antigo `PropostaFormDialog`;
- impressão antiga `PropostaImpressao`;
- botão de lápis do formulário antigo;
- botão de impressão antigo;
- catálogo antigo de propostas e seu diálogo;
- botão genérico que abre arbitrariamente a primeira proposta da lista.

### Nova proposta

O botão `Nova proposta` abre um seletor curto, não um editor paralelo. O usuário escolhe:

1. obra;
2. orçamento da obra;
3. revisão publicada/congelada do orçamento.

Somente obras com orçamento e revisão válidos ficam disponíveis. Após confirmar, o sistema cria o cabeçalho da proposta em rascunho, liga `orcamento_revisao_id` e abre imediatamente o Editor Comercial. Cliente, obra, etapas, atividades, quantidades e preços vêm da fotografia da revisão escolhida.

Se já existir rascunho ativo para a mesma obra e revisão, a interface deve oferecer abrir o rascunho existente em vez de criar uma duplicata acidental.

O fluxo normal não cria duas propostas para a mesma obra e revisão. Quando houver necessidade de uma variante comercial, o usuário usa uma ação explícita `Duplicar proposta`; a cópia recebe identidade própria e pode manter a mesma revisão de orçamento como origem.

## Editor Comercial

O editor inicializa sempre com `configuracaoPropostaComercialPadrao`, mesclada com a configuração persistida da revisão atual. Arrays e mapas obrigatórios são normalizados mesmo para fotografias antigas ou incompletas.

O editor mantém:

- pré-visualização A4 em tempo real;
- seleção de capa, logo e dados institucionais;
- exibição de cliente e obra;
- visibilidade de etapas, atividades, quantidades e preço unitário;
- modo de valor apenas por etapa;
- descrições comerciais independentes das descrições técnicas;
- condições de pagamento, prazo, validade, observações e assinaturas;
- impressão/PDF pela mesma visualização.

### Salvar rascunho

Salvar rascunho atualiza ou cria a única revisão mutável em status `rascunho` da negociação atual, persistindo `configuracao` e `fotografia`. Reabrir ou recarregar a página deve restaurar exatamente a configuração salva.

### Publicar nova revisão

Publicar valida a origem, congela a própria revisão em rascunho e altera seu status para `enviada`; não existe estado intermediário `publicada`. A fotografia comercial é gerada a partir da revisão congelada do orçamento e da configuração do editor, já sanitizada para remover custos internos, BDI, insumos, coeficientes e margens.

Após a publicação, a revisão passa a integrar o histórico e não pode mais ser sobrescrita. Alterações posteriores criam o próximo rascunho numerado, sem modificar a fotografia já enviada.

### Histórico

O diálogo de revisões consulta `proposta_revisoes`, apresenta número, status e data e permite visualizar/imprimir uma fotografia anterior. Ele não deve usar dados simulados ou apenas o estado React atual.

## Compatibilidade com propostas legadas

Ao abrir uma proposta sem `proposta_revisoes` ou sem `orcamento_revisao_id`, o sistema monta uma adaptação somente para aquela proposta usando, na ordem:

1. orçamento/revisão vinculados à obra;
2. etapas e atividades analíticas atuais da obra;
3. `propostas_itens`, como último fallback.

A adaptação deve ser apresentada ao usuário como rascunho legado. A persistência no modelo novo acontece somente quando o usuário salva ou publica. Nenhum registro antigo é apagado automaticamente.

Se a obra possuir mais de uma revisão de orçamento compatível, o sistema não escolhe automaticamente a mais recente: o usuário deve selecionar explicitamente a revisão que corresponde à negociação original. Isso evita reconstruir uma proposta antiga com preços diferentes dos apresentados ao cliente.

Quando não houver origem suficiente, o editor apresenta uma mensagem orientando a vincular uma obra/orçamento; não deve quebrar nem inventar valores.

## Exclusão definitiva

A exclusão definitiva será permitida somente para propostas em status `rascunho`. Propostas `enviadas`, `aceitas`, `rejeitadas` ou `expiradas` permanecem preservadas para histórico e auditoria; quando aplicável, a interface oferece arquivamento/cancelamento em vez de exclusão.

A exclusão será uma operação transacional no banco, preferencialmente por função `SECURITY DEFINER` com checagem explícita de autorização. A função recebe o ID da proposta, confirma que ela ainda está em rascunho, verifica vínculos relevantes e executa a política definida:

- referências configuradas com `ON DELETE SET NULL` são desvinculadas;
- dependências próprias da proposta com `ON DELETE CASCADE` são removidas;
- vínculos que representem impedimento comercial retornam código e mensagem específicos;
- sucesso só é retornado depois de confirmar que a proposta deixou de existir.

A interface não remove otimisticamente a linha antes da confirmação. Durante a operação, mostra estado de carregamento; em sucesso invalida a consulta; em falha mantém a linha e exibe a mensagem real.

Para a `PROP-2026-0008`, que está em rascunho e portanto é elegível para exclusão definitiva, a investigação deve registrar o vínculo ou política que impedia o `DELETE` anterior antes de aplicar correção aos dados de produção.

## Modelo de dados e segurança

- `propostas.orcamento_revisao_id` identifica a origem congelada.
- `proposta_revisoes.configuracao` armazena as opções comerciais.
- `proposta_revisoes.fotografia` armazena o documento comercial sanitizado.
- A numeração de revisão continua única por proposta.
- Revisões `enviadas` e propostas aceitas não podem ser sobrescritas.
- `propostas.status` deve refletir o estado comercial vigente da revisão ativa; publicar leva ambos para `enviada` e o aceite leva a revisão/proposta correspondente para `aceita`.
- RLS/RPC deve seguir as permissões atuais de admin/diretor/financeiro aplicáveis ao módulo.
- A fotografia nunca deve conter campos técnicos bloqueados, mesmo que o cliente altere a requisição no navegador.

## Migração e rollback

1. Adicionar função transacional e eventuais índices/constraints sem remover estruturas existentes.
2. Publicar o novo fluxo mantendo leitura de legado.
3. Validar criação, salvamento, publicação, impressão, aceite e exclusão.
4. Somente em Issue posterior considerar a remoção das estruturas antigas sem consumidores.

O rollback consiste em reverter a interface e a função nova; as tabelas e registros legados permanecem intactos. Revisões já criadas continuam preservadas.

## Validação

- Teste de regressão para configuração comercial completa e ausência do erro `.includes()`.
- Testes para normalização de configuração antiga/incompleta.
- Teste de criação exigindo obra + orçamento + revisão.
- Testes de salvar/reabrir rascunho.
- Testes de publicação que congela o rascunho como `enviada`, sanitização e criação do próximo rascunho numerado.
- Testes de adaptação por cada fonte legada.
- Testes de escolha explícita quando uma proposta legada encontrar várias revisões possíveis.
- Testes de duplicação consciente e bloqueio de duplicata acidental para a mesma obra/revisão.
- Testes SQL da exclusão: sucesso para rascunho, bloqueio para os demais status, falta de permissão, vínculo impeditivo e confirmação de ausência.
- Teste de interface garantindo que componentes e botões antigos não apareçam.
- Teste da impressão/PDF pelo editor único.
- Testes focados, lint dos arquivos alterados e build de produção.

## Decisões deixadas ao implementador

- Organização interna dos hooks/componentes, desde que a rota não permaneça monolítica.
- Texto exato de mensagens e rótulos, mantendo clareza em português.
- Nome da função SQL e dos testes, seguindo os padrões do repositório.
