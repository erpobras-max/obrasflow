# Medições de Obras com motor compartilhado — desenho de produto e arquitetura

**Data:** 31/10/2026

**Issue:** #206

**Status:** aprovado pelo usuário em 31/10/2026

## 1. Intenção

Evoluir a Medição de Obras do ObrasFlow até o nível funcional demonstrado pelo Mais Controle, aproveitando os recursos mais maduros já implementados em Contratos de Empreiteiros. Os dois fluxos permanecem separados para o usuário e no financeiro:

- **Medição de Obras:** avanço da obra, aceite do cliente e contas a receber.
- **Medição de Empreiteiros:** execução contratada, aprovação interna e contas a pagar.

Eles compartilharão componentes, cálculos, anexos, relatórios, histórico e infraestrutura de aprovação. A separação impede que cobrança de cliente e pagamento de fornecedor sejam confundidos, enquanto o compartilhamento reduz duplicação e oferece uma experiência consistente.

## 2. Estado atual confirmado

### Medição de Obras

- Lista medições por obra e status.
- Carrega itens do escopo comercial/orçamento aceito.
- Aceita avanço acumulado por percentual e calcula quantidade e valor do período.
- Permite itens manuais, referências SINAPI/SICRO e quantitativos do Projeto 3D.
- Impede regressão abaixo do percentual já medido e avanço acima de 100%.
- Gera relatório para impressão/PDF e planilha Excel com histórico.
- Uma alteração direta de status pode gerar conta a receber.
- O progresso da obra considera hoje qualquer medição não cancelada, inclusive rascunho.

### Medição de Empreiteiros

- Trabalha por contrato e item de serviço.
- Aceita entrada por quantidade, percentual ou valor.
- Controla medido anteriormente, medição atual, acumulado e saldo.
- Aplica descontos, amortização de adiantamento, retenção técnica e tributos.
- Aprova/cancela por RPC transacional, gerando ou estornando conta a pagar.
- Possui fotos, link público, relatório imprimível, retenções e aditivos.

### Portal do Cliente

- Mostra cronograma financeiro e contas a receber.
- Ainda não possui uma área completa de boletins, evidências, aceite e contestação.

## 3. Objetivos

1. Tornar a medição de obra segura, auditável e fácil de usar no canteiro e no escritório.
2. Apresentar claramente contratado, anterior, atual, acumulado e saldo por etapa e atividade.
3. Atualizar progresso e financeiro somente após aprovação válida.
4. Gerar boletim configurável em PDF, Excel e link online.
5. Levar boletins, evidências e aceite ao Portal do Cliente.
6. Comparar avanço planejado e medido por etapa, mês e acumulado.
7. Reaproveitar o motor de empreiteiros sem misturar contas a pagar e receber.
8. Preservar dados e links existentes durante a migração.

## 4. Não objetivos

- Unificar Medição de Obras e Medição de Empreiteiros em uma única tela ou tabela de negócio.
- Substituir orçamento, cronograma, RDO ou financeiro.
- Criar aplicativo móvel nativo nesta fase; a interface será responsiva/PWA.
- Permitir que IA aprove medições ou altere valores automaticamente.
- Apagar tabelas legadas durante a primeira entrega.

## 5. Antiobjetivos

O projeto será considerado incorreto se:

- um rascunho alterar progresso, faturamento ou saldo definitivo;
- uma medição de cliente gerar conta a pagar;
- uma medição de empreiteiro gerar conta a receber;
- valores aprovados puderem ser editados sem revisão ou estorno auditado;
- a mesma atividade puder ultrapassar 100% ou o saldo contratado;
- fotos ou links públicos escaparem das regras de acesso;
- a migração escolher silenciosamente uma revisão errada do orçamento.

## 6. Abordagens consideradas

### A. Copiar somente as telas do concorrente

Entrega visual rápida, mas mantém status inseguro, duplicação entre módulos e regras diferentes. Rejeitada.

### B. Compartilhar o motor e preservar os domínios separados — escolhida

Extrai cálculos e componentes maduros de empreiteiros para uma camada compartilhada. Medição de Obras continua gerando recebimento; Empreiteiros continua gerando pagamento. Melhor equilíbrio entre segurança, prazo e reaproveitamento.

### C. Criar um único domínio universal de medições

Reduz tabelas, mas aumenta o risco de misturar cliente, fornecedor, retenções e direções financeiras. Rejeitada para esta fase.

## 7. Experiência proposta

### 7.1 Central de Medições de Obras

A rota `/medicoes` passa a ter três abas:

1. **Lista de Medições** — busca, obra, período, status, responsável, valor, percentual e pendências.
2. **Mapa de Medições** — matriz histórica por etapa/atividade, com medição anterior, atual, acumulada e saldo.
3. **Indicadores** — avanço por etapa, Curva S planejado × medido, avanço mensal, acumulado, desvio e previsão.

O cabeçalho da obra mostra valor contratado, medido aprovado, medição em análise, saldo, avanço físico, avanço financeiro e desvio do cronograma.

### 7.2 Editor do boletim

O editor agrupa itens por etapa e permite expandir atividades. Colunas mínimas:

- código e descrição;
- unidade;
- quantidade contratada;
- preço unitário;
- medido anteriormente;
- entrada desta medição por quantidade, percentual ou valor;
- acumulado;
- saldo físico;
- saldo financeiro;
- indicador de estouro ou inconsistência;
- quantidade de evidências.

Alternar o modo de entrada não altera o resultado econômico; quantidade, percentual e valor são representações sincronizadas da mesma medição. Alterações manuais de preço ou quantidade contratada exigem aditivo, nunca edição dentro do boletim.

### 7.3 Fluxo de status

Fluxo padrão:

`rascunho → em_conferencia → aprovada_tecnica → aprovada_comercial → faturada → recebida`

Saídas laterais:

- `em_conferencia → devolvida` com justificativa;
- `aprovada_* → cancelada` somente por estorno controlado;
- `devolvida → rascunho` cria nova versão editável.

Configuração inicial de alçadas:

- engenharia/gestor da obra envia e aprova tecnicamente;
- diretor/admin aprova comercialmente;
- financeiro fatura e registra recebimento;
- a empresa poderá futuramente configurar aprovadores e limites por valor.

Mapeamento inicial dos papéis existentes:

- `engenharia`, `diretor` e `admin` podem enviar e aprovar tecnicamente;
- `diretor` e `admin` podem aprovar comercialmente;
- `financeiro_civil`, `diretor` e `admin` podem faturar e registrar recebimento;
- por padrão, a mesma pessoa não aprova técnica e comercialmente; `admin` pode usar exceção emergencial com justificativa auditada.

Cada transição é executada por RPC transacional, valida papel, estado anterior, saldo, versão e idempotência, e grava usuário, data, comentário e fotografia dos totais.

### 7.4 Regras financeiras e de progresso

- Somente `aprovada_comercial`, `faturada` e `recebida` compõem progresso definitivo.
- A aprovação comercial congela itens, totais, anexos e configuração do relatório.
- A aprovação comercial gera ou atualiza exatamente uma conta a receber.
- O contrato/proposta define `exige_aceite_cliente`. Quando falso, a aprovação comercial gera a conta a receber. Quando verdadeiro, ela muda para `aguardando_aceite_cliente` e a conta só é gerada após o aceite.
- Cancelamento estorna conta aberta e progresso; recebimento já conciliado exige procedimento financeiro próprio.
- O avanço físico é ponderado pelas quantidades/serviços; o avanço financeiro, pelos preços comerciais congelados.
- O avanço físico usa os pesos do cronograma físico-financeiro; sem pesos publicados, usa proporcionalmente o preço comercial congelado e identifica o indicador como estimativa financeira.
- Custo interno, BDI e composição de insumos não aparecem para o cliente.

### 7.5 Evidências

Fotos e documentos são vinculados ao boletim e, opcionalmente, à etapa/atividade específica. Cada evidência registra:

- arquivo e miniatura;
- legenda;
- data da captura informada;
- usuário do envio;
- etapa/atividade;
- origem (upload, RDO ou diário);
- posição opcional;
- hash e metadados básicos para auditoria.

Evidências são opcionais por padrão. A empresa pode exigir ao menos uma evidência por boletim, etapa ou atividade; a regra mais específica prevalece e é fotografada no boletim.

Excluir evidência de rascunho é permitido aos papéis autorizados. Após aprovação, a evidência fica imutável; correção exige nova versão ou anexo complementar auditado.

### 7.6 Relatório configurável

O usuário escolhe um modelo e configura:

- completo ou somente percentual;
- todas as etapas ou somente as medidas;
- preços visíveis ou ocultos;
- comentários, fotos, documentos, histórico e assinaturas;
- dados da empresa;
- planejado × medido;
- resumo, itens e anexos.

Saídas:

- visualização online responsiva;
- PDF/impressão;
- Excel;
- link público revogável, com expiração e escopo de leitura;
- publicação no Portal do Cliente.

A configuração e a versão do relatório são congeladas na aprovação para que um link antigo nunca mude silenciosamente.

### 7.7 Portal do Cliente

Nova seção **Medições** com:

- lista e status dos boletins publicados;
- resumo contratado/anterior/atual/acumulado/saldo;
- etapas e atividades liberadas;
- evidências e comentários destinados ao cliente;
- PDF e histórico de versões;
- ações `Aceitar` e `Solicitar revisão`;
- aceite com usuário, data, IP técnico/auditoria e declaração apresentada.

Solicitar revisão não altera valores diretamente: muda o estado para análise e exige justificativa. O aceite do cliente pode ser opcional ou obrigatório por contrato, mas não substitui as aprovações internas.

Comentários possuem audiência explícita `interno`, `cliente` ou `empreiteiro`. Medição de Obras aceita `interno` e `cliente`; Medição de Empreiteiros aceita `interno` e `empreiteiro`. Após aprovação, comentários existentes são imutáveis e novas observações são acrescentadas como eventos.

### 7.8 Indicadores e inovação

- Curva S planejada × medida por período.
- Barras de avanço por etapa.
- desempenho mensal e acumulado;
- desvio percentual e financeiro;
- previsão de conclusão baseada no ritmo aprovado;
- alertas de atividade medida sem evidência ou sem RDO recente;
- alertas de avanço fora do intervalo planejado;
- projeção de faturamento e saldo;
- QR Code no PDF para validar a versão publicada.

Alertas são informativos. Nenhum modelo automatizado aprova, rejeita ou altera medição.

## 8. Arquitetura

### 8.1 Núcleo compartilhado

Criar uma camada `src/lib/medicoes-core/` sem dependência de React contendo:

- conversão entre quantidade, percentual e valor;
- cálculo anterior/atual/acumulado/saldo;
- validações de estouro, regressão e precisão;
- cálculo físico e financeiro;
- tipos de linha, resumo e ajuste;
- configuração de relatório;
- máquina de estados pura para validação no cliente e testes.

Componentes compartilhados em `src/components/medicoes-core/`:

- `MeasurementSummaryCards`;
- `MeasurementItemsTable`;
- `MeasurementEvidencePanel`;
- `MeasurementApprovalTimeline`;
- `MeasurementReportConfigurator`;
- `MeasurementStatusBadge`;
- gráficos planejado × medido.

Cada domínio fornece um adaptador:

- `medicao-obra-adapter`: fotografia comercial, contas a receber e portal do cliente;
- `medicao-empreiteiro-adapter`: itens do contrato, ajustes, retenções e contas a pagar.

### 8.2 Dados de Medição de Obras

Evoluir tabelas atuais sem renomeá-las inicialmente:

- `medicoes`: versão, status ampliado, responsáveis, datas de transição, configuração/fotografia do relatório, totais físico-financeiros e vínculo com revisão de orçamento.
- `medicoes_itens`: anterior, atual, acumulado, saldo, modo de entrada e fotografia comercial do item.
- nova `medicao_obra_anexos`.
- nova `medicao_obra_aprovacoes`.
- nova `medicao_obra_links_publicos`.
- nova `medicao_obra_eventos` para trilha imutável.
- nova `medicao_obra_versoes` para fotografias imutáveis da mesma medição.
- nova `medicao_obra_comentarios` com audiência explícita.

A fonte comercial definitiva é o escopo materializado da proposta aceita, cuja origem é uma revisão congelada do orçamento. Uma obra só pode ter um escopo comercial ativo por vez. Aditivos aprovados geram nova versão do escopo; não alteram fotografias de boletins anteriores. Obras internas sem proposta exigem uma revisão de orçamento publicada explicitamente marcada como escopo de medição.

Devolução mantém o mesmo `medicao_id` e número do boletim, incrementa `lock_version` e cria uma nova linha imutável em `medicao_obra_versoes`. Links e aceites apontam para `versao_id`, impedindo que uma versão publicada seja alterada silenciosamente.

Valores monetários novos usam centavos inteiros. Campos numéricos antigos permanecem durante a transição e são reconciliados por migration testada.

### 8.3 Serviços de banco

RPCs previstas:

- criar rascunho a partir de revisão congelada;
- salvar rascunho com controle de versão otimista;
- enviar para conferência;
- aprovar tecnicamente;
- aprovar comercialmente e gerar recebimento;
- devolver para correção;
- cancelar/estornar;
- publicar/revogar link;
- aceitar/contestar pelo portal;
- obter fotografia sanitizada para relatório/portal.

As RPCs usam transação, bloqueio de linha quando necessário, idempotência e auditoria. DML direto em estados aprovados fica bloqueado por privilégios/RLS.

## 9. Migração e compatibilidade

1. Criar novas colunas/tabelas de forma aditiva.
2. Mapear estados antigos: `rascunho`, `aprovada`, `faturada`, `cancelada`.
3. Fotografar itens existentes e recalcular anterior/acumulado em ordem por obra e período.
4. Marcar inconsistências para conferência; nunca ajustar silenciosamente valores históricos.
5. Manter relatório antigo como fallback somente para registros não migrados.
6. Ativar o novo fluxo por feature flag e por empresa.
7. Fazer execução sombra dos cálculos e comparar totais.
8. Migrar links/relatórios e liberar o Portal.
9. Remover fallback apenas após auditoria e janela de rollback.

Toda migration deve ter roteiro de rollback, teste em banco efêmero e relatório de contagem/valores antes e depois.

Mapeamento inicial: `rascunho → rascunho`, `aprovada → aprovada_comercial`, `faturada → faturada` e `cancelada → cancelada`. Aprovações históricas inexistentes recebem evento técnico `migracao_legada`, sem atribuir aceite humano fictício. Medição faturada sem conta, totais divergentes ou encadeamento ambíguo fica `legado_requer_revisao`, somente leitura, até saneamento explícito.

## 10. Segurança e privacidade

- Links públicos usam token forte armazenado como hash, expiração, revogação e escopo somente leitura.
- Fotografia pública elimina custo interno, BDI interno, composição, salários e dados de fornecedores.
- Anexos ficam privados no R2 e são entregues por URL assinada/autorizada.
- Aceites e aprovações registram identidade e contexto técnico sem expor esses dados no relatório público.
- RLS restringe obra por empresa, vínculo do cliente e papel do colaborador.
- Auditoria não pode ser editada pelo cliente.

## 11. Tratamento de erros e concorrência

- Atualização de rascunho envia número de versão; conflito pede recarregamento e nunca sobrescreve silenciosamente.
- Aprovação repetida retorna o mesmo resultado sem duplicar conta.
- Falha financeira reverte toda a aprovação.
- Upload incompleto não bloqueia salvar rascunho, mas evidência obrigatória bloqueia envio conforme regra.
- Ausência de cronograma desativa comparativo planejado × medido com mensagem explicativa.
- Ausência de revisão congelada impede criar medição e orienta o usuário.

## 12. Testes e critérios de aceite

### Domínio

- conversões quantidade/percentual/valor preservam resultado e arredondamento;
- anterior + atual = acumulado e contratado - acumulado = saldo;
- regressão e estouro são rejeitados;
- físico e financeiro são independentes e corretos;
- máquina de estados rejeita transições inválidas.

### Banco

- aprovação é atômica e idempotente;
- gera uma única conta a receber;
- rascunho não altera progresso;
- cancelamento estorna somente quando permitido;
- RLS protege empresa, obra, cliente e anexos;
- migration e rollback preservam totais históricos.

### Interface

- editor funciona em desktop e celular;
- modos de entrada permanecem sincronizados;
- mapa, resumo e relatório mostram os mesmos totais;
- relatório público não expõe custo interno;
- portal permite aceitar/solicitar revisão e registra o evento;
- estados de carregamento, vazio e erro não exibem dados obsoletos.

### Não regressão

- Contratos de Empreiteiros continuam gerando somente contas a pagar.
- Medições de Obras continuam gerando somente contas a receber.
- relatórios históricos permanecem acessíveis.
- cronograma, RDO, propostas e financeiro preservam suas funções atuais.

## 13. Entrega incremental

1. **Fundação:** núcleo compartilhado, correção de rascunho no progresso, estados e RPCs.
2. **Editor:** tabela anterior/atual/acumulado/saldo e modos de entrada para Medição de Obras; a interface atual de Empreiteiros permanece intacta, consumindo inicialmente apenas o núcleo puro onde isso não altera comportamento.
3. **Evidências e relatório:** anexos por item, configurador, PDF/Excel/link.
4. **Mapa e indicadores:** histórico, Curva S e planejado × medido.
5. **Portal:** publicação, aceite, revisão e notificações.
6. **Inteligência operacional:** alertas, previsão e validação cruzada com RDO.
7. **Convergência visual de Empreiteiros:** substituir componentes duplicados pelos compartilhados somente após estabilizar Medição de Obras.

Cada etapa deve ser liberável, testável e reversível sem depender da etapa seguinte.

## 14. Decisões deixadas ao construtor

- Biblioteca visual específica para os gráficos, desde que reutilize as dependências existentes quando possível.
- Divisão interna dos componentes compartilhados.
- Textos menores de ajuda e empty states.
- Índices adicionais identificados por `EXPLAIN` durante a implementação.
