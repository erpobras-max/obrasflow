# Orçamento analítico e proposta comercial integrada

## Intenção

Transformar o orçamento de obras em uma fonte técnica única para custos e preços, usando composições analíticas SINAPI ou próprias, e gerar a proposta comercial diretamente desse orçamento sem expor dados internos ao cliente.

## Objetivos

- Estruturar o orçamento em etapas, atividades, composições e insumos.
- Sincronizar automaticamente as competências publicadas pela Caixa e preservar o arquivo original.
- Copiar composições para cada orçamento, permitindo adaptações sem alterar o catálogo mestre.
- Calcular custo unitário exclusivamente a partir de consumo × preço dos insumos.
- Registrar a memória estruturada que forma a quantidade de cada atividade.
- Calcular o preço de venda com BDI configurável e prioridade atividade → categoria → geral.
- Mostrar custos, acréscimos, BDI efetivo e preço final por atividade, etapa e orçamento.
- Gerar propostas configuráveis, imprimíveis e versionadas a partir do orçamento.
- Preservar os módulos atuais de cronograma, arquivos e relatórios.

## Não objetivos

- Reformular cronograma, arquivos, relatórios ou compras.
- Criar importação de orçamento por IA.
- Permitir edição direta do custo unitário ou total de uma composição.
- Alterar o catálogo SINAPI quando uma composição for adaptada dentro de uma obra.
- Implementar memória de cálculo fiscal detalhada do BDI; os percentuais são informados diretamente.

## Abordagens consideradas

### Catálogo separado do orçamento

Manter os itens atuais e apenas consultá-los no catálogo. É uma alteração menor, mas não preserva insumos, coeficientes, adaptações e competência de forma auditável. Descartada.

### Cópia analítica por orçamento, com sincronização externa

Copiar composições e insumos para o orçamento e atualizar o SINAPI por serviço externo. Resolve o domínio, mas cria infraestrutura, credenciais e operação fora do ObrasFlow. Descartada.

### Cópia analítica por orçamento e sincronização interna em lotes

Uma rotina agendada no ObrasFlow detecta novas publicações da Caixa, preserva o ZIP original, valida e importa os dados em lotes. Cada atividade recebe uma cópia congelada da composição e de seus insumos. Escolhida por centralizar governança, histórico e operação.

## Experiência do orçamento

### Cabeçalho

- Obra, cliente e status do orçamento.
- UF herdada do endereço da obra.
- Competência SINAPI válida mais recente, selecionada automaticamente e congelada no orçamento.
- Regime da referência disponível no catálogo importado.
- BDI geral informado diretamente.
- Custo total, acréscimo total, BDI efetivo e preço a cobrar do cliente.

Uma competência mais nova não altera orçamentos existentes. O usuário autorizado pode trocar a competência explicitamente; a operação recalcula apenas após confirmação e registra auditoria.

Ao trocar a competência, o sistema preserva descrições, memoriais e coeficientes adaptados. Atualiza somente preços de insumos que não tenham sido alterados manualmente. Antes da confirmação, apresenta comparação entre competência, preços e totais anteriores e novos.

### Planilha hierárquica

- Etapas expansíveis com custo, acréscimo, BDI efetivo e preço final.
- Atividades com descrição, unidade, quantidade, custo unitário calculado, custo total, BDI efetivo, preço unitário e preço total.
- Inclusão de etapa, subetapa opcional e atividade.
- Pesquisa unificada de composições SINAPI e próprias.
- Identificação visual da fonte e do estado adaptado.
- Edição direta do nome, unidade, quantidade e BDI da atividade.
- Custo unitário exibido como calculado e não editável.

Ao passar o mouse, focar ou tocar nos totais, o sistema mostra mão de obra, material, equipamento, serviços auxiliares e outros, com valores, percentuais e barras horizontais. O clique abre o detalhamento completo.

### Memorial de quantidade

Cada atividade pode usar quantidade direta ou memorial estruturado. O memorial contém várias linhas com:

- descrição da parcela;
- fórmula aritmética;
- resultado calculado;
- inclusão, remoção e reordenação.

O total das linhas preenche a quantidade da atividade. Valores negativos representam descontos. As fórmulas aceitam números, parênteses e as quatro operações, sem execução de código. O memorial é versionado com o orçamento e pode ser exportado.

### Composição analítica da atividade

Ao clicar no custo unitário, abre-se a composição com:

- código e descrição do insumo;
- categoria: mão de obra, material, equipamento, serviço auxiliar ou outros;
- unidade;
- coeficiente de consumo;
- preço unitário;
- custo parcial calculado;
- fonte, UF e competência do preço.

O usuário pode alterar consumo e preço, adicionar insumos próprios ou remover itens. Essas mudanças tornam a cópia “SINAPI adaptada” e afetam somente o orçamento. O custo unitário é sempre a soma dos custos parciais. Não existe ajuste manual do total.

Composições auxiliares são decompostas até seus insumos originais para classificação e cálculo por categoria. A interface pode preservar a árvore técnica para consulta, mas os resumos de mão de obra, material, equipamento e outros usam os componentes finais, evitando concentrar custos na categoria genérica de serviço auxiliar.

### BDI

O sistema resolve exatamente um BDI por parcela, sem somar camadas:

1. BDI específico da atividade, quando definido;
2. BDI da categoria do insumo;
3. BDI geral do orçamento.

Quando a atividade possui BDI próprio, ele é aplicado ao custo total da atividade. Sem BDI próprio, cada categoria recebe seu percentual e o preço da atividade é a soma das parcelas. O BDI efetivo é `acréscimo total / custo total`.

A engrenagem do orçamento oferece:

- configurar BDI geral e por categoria;
- aplicar ou remover exceções por atividade;
- restaurar o BDI padrão;
- lista consolidada de insumos;
- lista de composições;
- bases e competências;
- exportação sintética, analítica e de memoriais;
- histórico de alterações;
- duplicação do orçamento.

### Duplicação e histórico de preços

Duplicar cria um novo orçamento independente, preservando estrutura, memoriais e percentuais, mas permitindo escolher a competência e atualizar preços de forma explícita. O catálogo de insumos próprios mostra as últimas compras por fornecedor, data e preço, usando dados já registrados em compras/financeiro quando houver vínculo confiável.

## Proposta comercial

A proposta nasce de uma versão do orçamento. Por padrão mostra:

- dados da empresa, cliente e obra;
- etapas e atividades;
- quantidades e unidades;
- preço fechado por etapa;
- preço total, condições, validade e observações.

Por padrão, não mostra custos internos, composição dos insumos nem BDI. Antes de gerar, o usuário pode configurar o nível de detalhe, incluindo ou ocultando atividades, quantidades, preços unitários e anexos.

Cada emissão gera uma revisão imutável com número, data, responsável, motivo e fotografia dos itens e valores. Uma nova negociação parte da revisão anterior. A proposta pode ser visualizada, impressa e salva em PDF com os mesmos dados.

O orçamento pode ser editado livremente enquanto estiver em rascunho. Uma revisão imutável é criada somente pela ação explícita “Publicar revisão” ou ao gerar uma proposta. Quando a proposta for aceita, sua revisão de orçamento fica bloqueada. Qualquer mudança posterior exige nova revisão do orçamento e nova proposta, sem alterar o documento aceito.

## Sincronização SINAPI

Uma rotina agendada consulta diariamente a página oficial da Caixa e procura uma competência ainda não registrada.

1. Descobrir a publicação e registrar uma execução idempotente.
2. Baixar o ZIP XLSX e preservar o arquivo original no R2 com hash.
3. Extrair metadados, insumos, composições, coeficientes e preços por UF/regime.
4. Importar em tabelas de preparação usando lotes e retomada por checkpoint.
5. Validar contagens, chaves, relações, unidades, coeficientes e distribuição de preços.
6. Bloquear publicação com preços zerados ou anomalias críticas.
7. Publicar atomicamente a competência válida e manter as anteriores.
8. Notificar administradores sobre sucesso, bloqueio ou falha.

O painel administrativo permite consultar execuções, executar nova verificação, reprocessar um arquivo preservado e selecionar manualmente a base padrão. O parser deve ser versionado porque o formato da Caixa pode mudar.

## Modelo de dados proposto

### Catálogo

- `sinapi_competencias`: competência, fonte, URL, hash, situação, metadados e datas.
- `sinapi_insumos`: competência, UF, regime, código, descrição, unidade, categoria e preço.
- `sinapi_composicoes`: competência, UF, regime, código, descrição, unidade, classe e custo publicado.
- `sinapi_composicao_itens`: composição, insumo/composição auxiliar, coeficiente e categoria.
- `bases_proprias`, `insumos_proprios`, `composicoes_proprias` e `composicao_propria_itens`.
- `sinapi_importacoes`: estado da execução, checkpoints, contagens e erros sanitizados.

### Orçamento congelado

- `orcamentos`: obra, versão, competência, UF, regime, BDI geral/categorias, totais derivados e status.
- `orcamento_etapas`: hierarquia, código, nome e ordem.
- `orcamento_atividades`: etapa, origem, referência original, descrição, unidade, quantidade, BDI específico e ordem.
- `orcamento_atividade_insumos`: fotografia do insumo, categoria, unidade, consumo, preço e custo derivado.
- `orcamento_memoriais`: atividade, descrição, fórmula segura, resultado e ordem.
- `orcamento_revisoes` e `orcamento_auditoria`.

### Proposta

- A proposta existente passa a referenciar `orcamento_id` e `orcamento_revisao_id`.
- `proposta_revisoes` preserva configurações de exibição e fotografia do documento emitido.
- Os itens exibidos são derivados da revisão escolhida, não do estado mutável atual.

Todos os valores monetários usam centavos inteiros ou `numeric` com escala definida; não usam ponto flutuante. Totais críticos são recalculados no banco e no domínio, nunca aceitos diretamente do navegador.

## Permissões e auditoria

- Administradores gerenciam sincronizações e bases.
- Admin, diretoria e engenharia podem editar orçamentos conforme as regras atuais.
- Perfis somente leitura não alteram composições, BDI ou revisões.
- Auditoria registra autor, horário, entidade, valores anteriores e posteriores.
- Propostas emitidas e revisões de orçamento são imutáveis; correções geram nova revisão.

## Compatibilidade e migração

O módulo atual permanece legível durante a transição. A entrega será feita em passos reversíveis:

1. criar novas tabelas sem remover as atuais;
2. importar e validar uma competência SINAPI;
3. liberar o novo orçamento por feature flag para obras selecionadas;
4. migrar um orçamento existente para cópia analítica em modo de conferência; cada item sem composição vira uma atividade própria com um único insumo consolidado marcado como “Legado — conferir composição”;
5. conectar a proposta à revisão do orçamento;
6. ampliar a liberação após validação;
7. manter rollback para o fluxo anterior até a estabilização.

Cronograma, arquivos e relatórios atuais continuam usando suas interfaces existentes. Integrações futuras devem consumir a revisão publicada do orçamento, sem redesenhar esses módulos neste projeto.

## Tratamento de falhas

- Download interrompido é retomado ou reiniciado sem duplicar dados.
- Arquivo com formato desconhecido fica bloqueado para revisão.
- Competência com preços zerados pode preservar estruturas, mas não vira padrão de preços.
- Falha parcial mantém a competência anterior ativa.
- Fórmula inválida no memorial mostra erro na linha e impede salvar.
- Insumo removido exige confirmação e recalcula imediatamente a composição.
- Divergência entre custo publicado e custo analítico é sinalizada, não ocultada.

## Validação

- Testes unitários para fórmulas, custos, categorias, precedência do BDI e totais.
- Testes de integração para parser, importação idempotente e publicação atômica.
- Testes de banco para constraints, RLS, auditoria e imutabilidade de revisões.
- Testes de interface para edição, memoriais, detalhamento, hover/foco/toque e permissões.
- Testes de ponta a ponta do orçamento à proposta e sua impressão/PDF.
- Teste de migração e rollback com dados existentes.

## Decisões deixadas ao implementador

- Tamanho dos lotes e mecanismo específico de fila/checkpoint compatível com Cloudflare e Supabase.
- Nomes finais de tabelas e índices, mantendo as invariantes descritas.
- Biblioteca de parsing XLSX/ZIP mais adequada às restrições de CPU e memória.
- Forma visual exata dos componentes, seguindo os protótipos aprovados e o design system atual.

