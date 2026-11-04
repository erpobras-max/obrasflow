# Evolução do Portal do Cliente — Design

## Intenção

Transformar o portal de consulta da obra em um canal de relacionamento com o cliente: ele deve acompanhar o que foi contratado, receber pedidos de decisão e consultar a evolução, sem receber acesso a custos internos, BDI, insumos ou informações de outras obras.

## Entregas

1. **Proposta e aditivos**: página somente leitura da última revisão comercial aceita vinculada à obra, com escopo, etapas, valores comerciais e histórico de versões. Alterações comerciais que exijam manifestação do cliente aparecem como solicitações e registram aceite ou recusa autenticados.
2. **Central de decisões**: mensagens e solicitações por obra, com texto, anexos já publicados em documentos, prazo, status e resposta do cliente. A equipe cria e encerra solicitações; o cliente apenas lê e responde às que lhe pertencem.
3. **Cronograma visual**: linha do tempo por etapas, com início/fim previstos, percentual realizado, situação e próximos marcos, mantendo o detalhamento atual como fonte de dados.
4. **Financeiro acionável**: exibir um botão de pagamento somente quando a parcela possuir URL de pagamento já cadastrada. Não haverá geração de boleto/PIX nem baixa automática sem um provedor financeiro configurado.

## Segurança e regras

- Toda leitura/escrita do cliente deve ser protegida por RLS e vinculada a uma obra cujo cliente autenticado seja o dono.
- A proposta mostrada é a fotografia comercial já publicada/aceita; custos, BDI, composição e insumos jamais são enviados ao portal.
- Cliente não edita proposta, cronograma, valor, parcela ou documento. A resposta a uma solicitação é imutável depois de enviada.
- O aceite no portal registra usuário e data, mas a assinatura contratual continua no fluxo de contratos existente.

## Alternativas avaliadas

1. Expor as tabelas internas de orçamento/proposta diretamente: mais rápido, mas vaza dados de custo e torna a autorização frágil. Rejeitada.
2. Criar um portal totalmente separado e duplicar dados: isola bem, mas cria sincronização e manutenção desnecessárias. Rejeitada.
3. Criar RPCs e tabelas de interação mínimas, reutilizando as fotografias comerciais e fontes atuais: mantém os dados consistentes, permite RLS estrita e evolui incrementalmente. **Escolhida.**

## Limites desta entrega

Não inclui chat em tempo real, WhatsApp/e-mail, geração de cobrança bancária, pagamentos, assinatura eletrônica de aditivos ou alteração de cronograma pelo cliente. Esses itens dependem de fornecedor externo ou de definição jurídica/operacional adicional.

## Resultado esperado

Um cliente autenticado consegue ver a proposta comercial aplicável à sua obra, responder decisões pendentes, acompanhar um cronograma mais claro e abrir uma cobrança existente por link; a equipe mantém a autoria e o controle das publicações.
