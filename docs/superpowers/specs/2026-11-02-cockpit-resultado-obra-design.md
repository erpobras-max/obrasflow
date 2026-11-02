# Cockpit Integrado de Resultado da Obra

## Intenção

Dar ao dono, diretor e gestor financeiro uma resposta imediata para quatro perguntas: quanto a obra deveria custar, quanto já foi comprometido e realizado, quanto deve custar ao terminar e qual margem ainda é provável. O cockpit deve unir dados que hoje existem em Orçamento, Compras, Contratos de Empreiteiros, Medições e Financeiro sem exigir lançamentos duplicados.

## Objetivo

Criar uma visão executiva e analítica por obra, disponível no Financeiro consolidado e acessível diretamente pela lista de Obras. A primeira entrega deve superar uma simples DRE por projeto ao permitir abrir cada indicador até a etapa e até o lançamento que o originou.

## Não objetivos desta entrega

- Integrar boleto, PIX, Open Finance ou emissão/captura fiscal.
- Substituir a contabilidade oficial ou produzir demonstrações contábeis legais.
- Criar um data warehouse ou histórico imutável mensal nesta primeira versão.
- Alterar valores de orçamento, pedido, contrato, medição ou lançamento a partir do cockpit.
- Excluir ou converter dados legados.

## Abordagens consideradas

### 1. Painel calculado somente no frontend do Financeiro

Mais rápido, porém repetiria consultas, exporia regras financeiras em componentes React e produziria resultados diferentes conforme a tela. Rejeitado.

### 2. Cockpit integrado por obra com motor de domínio e consulta consolidada — escolhido

Uma consulta consolidada reúne as fontes; um motor puro, testável em centavos, calcula KPIs, projeções e alertas; componentes reutilizáveis exibem a mesma leitura no Financeiro e no atalho da Obra. É rastreável, incremental e prepara o caminho para BI posterior.

### 3. Data mart com snapshots mensais

É a melhor solução para grande volume e comparações históricas fechadas, mas introduz atualização incremental, reprocessamento e governança antes de validarmos os indicadores. Fica como evolução futura.

## Experiência de uso

### Entrada pelo Financeiro

Adicionar a aba **Resultado das Obras** antes do DRE Simplificado. A aba abre com visão consolidada e permite selecionar uma obra. O filtro de período possui:

- **Até hoje**: posição acumulada atual.
- **Mês**: caixa ou competência do mês escolhido.
- **Obra inteira**: todo o ciclo conhecido da obra, incluindo projeções.

O seletor **Caixa | Competência** deve explicar o critério em texto curto:

- Caixa considera datas e valores efetivamente pagos/recebidos.
- Competência considera obrigações e receitas reconhecidas, mesmo em aberto.

O período recorta os movimentos. Receita contratada e BAC permanecem como linhas de base da obra; recebimentos, realizado e pago usam o período. Compromissos mostram a posição atual enquanto não houver snapshots históricos e recebem o rótulo **posição atual** quando o usuário consultar um mês passado. A primeira entrega não promete reconstruir retrospectivamente um saldo comprometido que nunca foi fotografado.

### Entrada pela lista de Obras

Adicionar ação **Resultado** em cada obra. A ação navega para `/financeiro?tab=resultado&obra=<id>`. Não será criada uma segunda implementação da tela.

### Cabeçalho executivo

Para uma obra selecionada, mostrar:

1. **Receita contratada** — proposta aceita/contrato comercial; na ausência, receitas previstas vinculadas à obra.
2. **Custo orçado (BAC)** — custo interno da revisão analítica corrente do orçamento, sem BDI e sem preço de venda.
3. **Custo comprometido** — saldo ainda não realizado de pedidos aprovados e contratos/aditivos ativos.
4. **Custo realizado** — apropriações financeiras válidas conforme o regime escolhido.
5. **Custo pago** — pagamentos efetivamente liquidados.
6. **Custo projetado no término (EAC)** — melhor estimativa disponível conforme as regras abaixo.
7. **Margem projetada** — receita contratada menos EAC, em valor e percentual.
8. **Desvio projetado** — EAC menos BAC, em valor e percentual.

Valores indisponíveis devem aparecer como **Não informado**, nunca como zero enganoso.

### Visão por etapa

Tabela ordenada conforme o orçamento, com:

- etapa;
- custo orçado;
- comprometido em compras;
- comprometido em contratos;
- realizado;
- pago;
- avanço físico;
- IDC;
- EAC;
- desvio previsto;
- status visual: saudável, atenção, crítico ou sem dados.

Cada linha expande um detalhamento por origem: orçamento, pedidos, contratos/medições e contas financeiras. Cada item fornece link para a tela de origem quando existir.

### Gráficos

- Barras comparando **Orçado × Comprometido × Realizado × EAC** por etapa.
- Linha de **margem prevista** e **margem projetada**.
- Curva acumulada simples de custo orçado, realizado e projetado quando houver datas suficientes.

### Alertas acionáveis

Exibir somente alertas com ação clara:

- etapa com EAC acima do orçamento;
- compromissos maiores que o saldo orçado;
- custo realizado sem obra ou etapa apropriada;
- obra sem orçamento analítico atual;
- contrato, pedido ou conta sem correspondência de etapa;
- títulos vencidos relevantes;
- projeção de caixa negativa dentro dos próximos 30 dias;
- margem projetada abaixo do limite configurado pela empresa.

O clique no alerta aplica o filtro correspondente e abre o detalhamento.

## Fontes e regras de cálculo

Todos os valores monetários usam inteiros em centavos. Registros cancelados ou excluídos logicamente são ignorados.

### Orçado

- Fonte principal: `orcamentos`, `orcamento_etapas`, `orcamento_atividades` e `orcamento_atividade_insumos` da revisão analítica corrente vinculada à obra.
- O custo da atividade é a soma dos insumos e coeficientes já calculados pelo orçamento.
- BDI e preço de venda não entram no BAC.
- Orçamento legado pode alimentar somente um total consolidado identificado como **sem detalhamento por etapa**; não inventar rateio.

### Receita contratada

- Prioridade 1: proposta/revisão comercial aceita vinculada à obra.
- Prioridade 2: valor contratual persistido na obra, quando existir e for confiável.
- Fallback: soma das contas a receber não canceladas da obra.
- A origem escolhida deve ser exibida no tooltip para evitar dupla contagem.

### Comprometido

- Compras: saldo de pedidos emitidos, confirmados ou parcialmente recebidos, usando itens e quantidades ainda não realizados/cancelados.
- Os dois fluxos existentes entram na consulta: `pedidos_compra`/`pedido_itens` e `cotacoes_pedidos`/`cotacoes_pedidos_itens`. O fluxo novo usa a quantidade recebida persistida. O legado usa o vínculo financeiro/recebimento disponível; quando não houver saldo por item confiável, exibe o valor como compromisso bruto identificado como **legado sem saldo aferível**, sem fabricar quantidade recebida, e gera alerta de qualidade.
- Empreiteiros: valor dos contratos ativos mais aditivos aprovados, menos medições aprovadas que já foram apropriadas como realizadas.
- Uma conta a pagar gerada por pedido ou medição não é somada novamente ao compromisso. Os vínculos de origem prevalecem sobre aproximações por descrição.
- Quando faltar vínculo de etapa, acumular em **Sem apropriação** e gerar alerta.

### Etapa canônica

`orcamento_etapas.id` da revisão analítica corrente é a chave canônica do cockpit. Cronograma, solicitações, pedidos, contratos, medições e contas apontam para essa chave quando o vínculo for conhecido. Vínculos antigos que guardam apenas texto/código são conciliados somente quando houver correspondência única normalizada dentro da mesma obra; ambiguidades ficam em **Sem apropriação**.

A migration pode criar uma tabela aditiva `resultado_obra_apropriacoes` para registrar mapeamentos explícitos entre origem, registro e `orcamento_etapa_id`, com unicidade por origem/registro e auditoria. O cockpit nunca grava automaticamente um mapeamento ambíguo.

### Realizado e pago

- Competência: contas a pagar/receber não canceladas reconhecidas no período, usando data de competência; enquanto esse campo não existir, usar a data de emissão/criação documentada como fallback e marcar a origem.
- Caixa: `valor_pago`/`valor_recebido` e data de liquidação.
- Medições aprovadas alimentam o realizado pela conta financeira gerada, não pela medição novamente.
- Transferências internas não são receita nem custo.

### Avanço físico, valor agregado e IDC

- Avanço físico vem de medições de obra/cronograma por etapa. Medições de empreiteiro representam custo executado e não devem, sozinhas, afirmar avanço físico global da obra.
- `EV = BAC × avanço físico`.
- `IDC = EV ÷ custo realizado` quando ambos forem maiores que zero.
- Sem avanço físico confiável, o IDC deve aparecer como **Não calculável**.
- Considerar somente medições de obra aprovadas e progresso confirmado do cronograma. O avanço consolidado é ponderado pelo BAC das etapas.
- Liberar projeção por desempenho somente a partir de 5% de avanço físico consolidado e custo realizado de pelo menos 1% do BAC. Antes disso, mostrar IDC informativo, mas não usar o cenário para EAC.

### Projeção de custo final

Exibir dois cenários e destacar o conservador:

1. **Cenário contratual**: `realizado + compromisso remanescente + max(BAC - realizado - compromisso remanescente, 0)`, equivalente a `max(BAC, realizado + compromisso remanescente)`.
2. **Cenário por desempenho**: `BAC ÷ IDC`, somente quando houver avanço físico confiável e custo realizado suficiente.

`EAC principal = maior valor entre os cenários válidos`. A interface deve explicar a fórmula e permitir ver ambos. Se nenhum cenário for válido, não apresentar projeção falsa.

### Margens

- `Margem prevista = receita contratada - BAC`.
- `Margem projetada = receita contratada - EAC principal`.
- Percentual usa receita contratada como denominador e fica indisponível quando a receita não for conhecida ou for zero.

## Arquitetura

### Banco e consulta

Criar migration reversível com uma função/RPC de leitura `obter_resultado_obra(p_obra_id, p_data_inicio, p_data_fim, p_regime)` ou views auxiliares `security_invoker`. A consulta deve:

- aplicar RLS das tabelas de origem;
- retornar valores crus e identificadores de origem, não HTML nem regras visuais;
- evitar N+1 por etapa;
- separar linhas por origem e etapa;
- incluir um bloco explícito de dados sem apropriação;
- nunca usar `SECURITY DEFINER` para contornar a visibilidade de obras sem uma checagem equivalente e testada.

A consolidação final e as projeções ficam no motor TypeScript na primeira entrega. Isso mantém fórmulas testáveis e evita esconder decisões gerenciais em SQL extenso.

### Motor de domínio

Criar `src/lib/resultado-obra.ts` com tipos e funções puras:

- normalização das linhas consolidadas;
- deduplicação por vínculo de origem;
- agregação por obra e etapa;
- cálculo BAC, EV, IDC, EAC e margens;
- classificação de saúde;
- geração de alertas com motivo e destino.

### Interface

- `src/components/financeiro/resultado-obras-cockpit.tsx`: container de dados e filtros.
- Componentes menores para KPIs, tabela por etapa, gráficos e gaveta de detalhamento.
- `src/routes/_app/financeiro.tsx`: adiciona aba e preserva as seis abas existentes.
- `src/routes/_app/obras.tsx`: adiciona somente o atalho para a aba compartilhada.

### URL e estado

O Financeiro passa a aceitar `tab=resultado`, `obra=<uuid>`, `regime=caixa|competencia` e período na query string. Atualizar filtros deve atualizar a URL sem recarregar, permitindo compartilhar a visão interna e voltar pelo navegador.

## Permissões e auditoria

- Admin, diretor, financeiro e financeiro civil visualizam valores completos das obras às quais já possuem acesso.
- Engenharia não acessa o cockpit financeiro nesta primeira entrega. Uma futura visão operacional de custos poderá reutilizar o motor com retorno sanitizado, mas não será apenas uma ocultação de UI.
- Cliente nunca acessa o cockpit interno.
- O cockpit é somente leitura; toda alteração continua na tela de origem e mantém sua auditoria existente.
- A RPC/view deve ter testes negativos de RLS, incluindo usuário sem acesso à obra.

## Precedência da receita

Quando existirem valores divergentes, usar uma única fonte e exibir sua identificação:

1. fotografia da revisão comercial aceita mais aditivos comerciais aprovados;
2. contrato comercial ativo mais aditivos aprovados;
3. valor contratual persistido na obra;
4. contas a receber não canceladas, apenas como fallback.

Uma fonte de prioridade inferior nunca é somada a uma superior.

## Limites de saúde e alertas

Defaults da primeira entrega, centralizados no motor e preparados para futura configuração por empresa:

- saudável: EAC até 5% acima do BAC;
- atenção: desvio maior que 5% e até 10%;
- crítico: desvio maior que 10%;
- margem crítica: margem projetada abaixo de 10% da receita;
- título vencido relevante: maior entre R$ 1.000,00 e 1% do BAC.

Sem BAC ou receita, usar estado **sem dados**, não saudável. A configuração por empresa fica fora da primeira entrega; a interface identifica os defaults utilizados.

## Estados de qualidade dos dados

O painel deve distinguir:

- carregando;
- erro com nova tentativa;
- obra sem orçamento;
- obra sem movimentos;
- dados parciais;
- resultado completo.

Uma faixa **Qualidade dos dados** mostra quantidade e valor de lançamentos sem etapa, sem origem ou sem data de competência. O cockpit não deve esconder inconsistências por meio de rateio automático.

## Testes e prova

- Testes unitários do motor com centavos, deduplicação, cenários EAC, margens, IDC indisponível e dados parciais.
- Testes de migration/RPC em PGlite cobrindo fontes, cancelamentos, dupla contagem e RLS.
- Testes de integração de consulta/URL e estados vazio/erro.
- Teste regressivo garantindo que transferências internas não afetam resultado.
- Teste regressivo garantindo que medição e conta gerada não sejam contadas duas vezes.
- Suite completa, ESLint focado, build de produção e validação visual desktop/mobile.

## Implantação e reversão

- Migration somente de leitura/aditiva; nenhuma tabela operacional será removida.
- Publicar inicialmente sem alterar o DRE atual.
- Caso o cockpit falhe, ocultar a nova aba e manter os dados operacionais intactos.
- A evolução para snapshots mensais será uma fase separada após validar os cálculos com obras reais.

## Critérios de aceite

1. Uma obra com orçamento, pedido, contrato, medição e pagamentos exibe cada valor uma única vez.
2. Totais consolidados são exatamente a soma das etapas mais **Sem apropriação**.
3. Caixa e competência apresentam resultados diferentes de forma explicável.
4. O usuário consegue ir de um desvio até o lançamento de origem.
5. O painel não apresenta zero quando o dado está ausente.
6. O cálculo conserva centavos e informa a fórmula usada.
7. Obras sem orçamento ou com dados incompletos continuam acessíveis com alertas claros.
8. O DRE, Fluxo de Caixa e demais telas financeiras existentes permanecem inalterados.
