# Medições Separadas e Contratos de Empreiteiros — Design

## Intenção

Separar com clareza os dois fluxos de medição do ObrasFlow e elevar o controle de empreiteiros ao mesmo conceito funcional observado no Mais Controle:

- **Medição da Obra / Cliente:** avanço físico do orçamento, relatório ao cliente e geração de conta a receber.
- **Contratos de Empreiteiros:** escopo e preços negociados com terceiros, medições, descontos, adiantamentos, retenções e geração de conta a pagar.

Para o usuário, a regra mental deve ser imediata: em **Medição da Obra** o cliente paga a construtora; em **Contratos de Empreiteiros** a construtora paga o prestador.

## Estado atual relevante

- `/medicoes` já controla a medição da obra, importa o escopo de `escopo_obra`, limita o avanço acumulado e gera conta a receber quando a medição é aprovada/faturada.
- `/prestadores` já possui `servicos_terceirizados`, `medicoes_terceirizados` e a RPC `aprovar_medicao_terceirizado`, que cria uma conta a pagar.
- O fluxo de prestadores atual é plano: cada serviço funciona isoladamente e cada medição pertence a um único serviço. Não existe um cabeçalho de contrato com vários itens nem uma medição única com vários itens, descontos e retenções.
- O orçamento analítico novo possui etapas, atividades e revisões, mas sua migration ainda precisa ser aplicada no ambiente publicado. A importação de contrato não pode depender exclusivamente dele.

## Objetivos

1. Manter os dois tipos de medição separados na navegação, nas permissões e nos efeitos financeiros.
2. Criar contratos de empreiteiros com vários itens e valores negociados, sem alterar o orçamento original.
3. Permitir itens importados do orçamento, importados de Excel ou cadastrados manualmente.
4. Medir cada item por quantidade, percentual ou valor, sempre com conversão e validação no servidor.
5. Exibir contratado, medido anteriormente, medição atual, acumulado e saldo físico/financeiro.
6. Aplicar descontos, amortização de adiantamento, retenção técnica e tributos antes de gerar o valor líquido.
7. Gerar exatamente uma conta a pagar por medição aprovada, de forma transacional e idempotente.
8. Preservar dados atuais e permitir rollback do novo fluxo sem excluir tabelas ou registros legados.
9. Produzir relatório imprimível e link somente leitura para o empreiteiro, com fotos e documentos.

## Não objetivos desta entrega

- Copiar identidade visual, textos protegidos ou código do Mais Controle.
- Substituir o cadastro geral de fornecedores.
- Alterar o motor do orçamento analítico, o cronograma, o diário de obra ou o estoque.
- Criar assinatura eletrônica juridicamente qualificada.
- Integrar automaticamente banco, PIX, nota fiscal ou WhatsApp; o link poderá ser copiado e enviado pelo canal escolhido pelo usuário.
- Remover `/prestadores`, `servicos_terceirizados` ou `medicoes_terceirizados` durante o rollout.

## Abordagens consideradas

### 1. Ampliar apenas o painel atual de prestadores

Menor esforço inicial, mas perpetua o modelo “um serviço = um contrato” e torna descontos, retenções, relatórios e aprovações difíceis de manter. Rejeitada.

### 2. Criar um módulo totalmente novo e abandonar as tabelas atuais

Produz um domínio limpo, porém duplica dados, exige migração arriscada e pode quebrar contas a pagar já vinculadas. Rejeitada.

### 3. Criar cabeçalhos de contrato e medição sobre os detalhes existentes

Escolhida. Novas tabelas representam o contrato e o boletim de medição; `servicos_terceirizados` passa a representar os itens do contrato e `medicoes_terceirizados`, os itens medidos. O backfill cria um contrato e uma medição de compatibilidade para cada registro legado, preservando todos os IDs e vínculos financeiros existentes.

## Navegação aprovada

No grupo **Obras** do menu:

```text
Medições
├── Medição da Obra
└── Contratos de Empreiteiros
```

Rotas:

- `/medicoes`: permanece como Medição da Obra / Cliente.
- `/contratos-empreiteiros`: lista e indicadores dos contratos.
- `/contratos-empreiteiros/$contratoId`: resumo, itens, medições, retenções e documentos.
- `/contratos-empreiteiros/$contratoId/medicoes/$medicaoId`: boletim editável ou somente leitura.
- `/medicao-empreiteiro/$token`: relatório público sanitizado e somente leitura.
- `/prestadores`: mantém compatibilidade e direciona para o novo módulo; nenhum favorito ou link antigo deve terminar em página inexistente.

## Fluxo do contrato

1. O usuário seleciona obra, empreiteiro, tipo de contrato (`preco_unitario` ou `empreitada_global`), objeto e datas.
2. Adiciona itens por uma ou mais fontes:
   - revisão publicada do orçamento analítico, quando disponível;
   - escopo legado da obra (`escopo_obra`) como fallback;
   - planilha Excel;
   - cadastro manual.
3. A importação cria uma fotografia independente com código, etapa, descrição, unidade e quantidade. Preço unitário e quantidade podem ser negociados no contrato sem modificar a origem.
4. O contrato começa em `rascunho`, pode ir para `em_aprovacao` e somente `ativo` aceita medições.
5. Alterações de escopo depois da ativação exigem aditivo. Itens e valores anteriores permanecem auditáveis.

## Lista e resumo de contratos

Filtros: texto, obra, empreiteiro, tipo e status.

Colunas: número, empreiteiro, obra, valor contratado, valor aprovado, percentual medido, saldo, última medição e status. O rodapé apresenta totais dos contratos filtrados.

O detalhe apresenta cartões de valor original, aditivos, contratado atual, medido aprovado, pago, retenções e saldo, além das abas **Itens**, **Medições**, **Retenções**, **Documentos** e **Histórico**.

## Fluxo da medição de empreiteiro

1. Ao abrir uma nova medição, todos os itens ativos do contrato são carregados com o acumulado aprovado e o saldo.
2. Em cada item o usuário escolhe a entrada por quantidade, percentual ou valor. Os outros dois campos são derivados.
3. Rascunhos não consomem saldo. Apenas medições aprovadas entram no acumulado.
4. A grade mostra: etapa/atividade, unidade, quantidade e valor contratados, acumulado anterior, medição atual, novo acumulado e saldo.
5. O resumo mostra: bruto atual, descontos, amortização do adiantamento, retenção técnica, tributos, líquido a pagar e saldo do contrato.
6. Fotos podem ser ligadas à medição inteira ou a um item específico.
7. Fluxo: `rascunho → em_aprovacao → aprovada → paga`, com alternativas `reprovada` e `cancelada`.
8. Após aprovação, conteúdo financeiro e itens ficam bloqueados. Correções exigem cancelamento controlado ou nova medição, nunca edição silenciosa.

## Regras financeiras e de cálculo

- Valores monetários persistidos no novo domínio usam centavos inteiros (`bigint`). Quantidades e percentuais usam `numeric` com escala definida.
- O servidor recalcula todos os totais; valores totais enviados pelo navegador não são confiáveis.
- O acumulado considera somente medições aprovadas ou pagas e nunca ultrapassa a quantidade/valor vigente do item, incluindo aditivos aprovados.
- Para preço unitário: `valor_atual = quantidade_atual × preço_unitário_negociado`.
- Para empreitada global, percentual ou valor podem ser usados como entrada e são convertidos sobre o valor contratado do item.
- Ajustes percentuais registram sua base de cálculo. O valor resultante fica congelado na aprovação.
- `líquido = bruto - descontos - amortizações - retenções - tributos_retidos` e nunca pode ser negativo.
- A aprovação usa bloqueio de linhas, verifica novamente os saldos e cria no máximo uma `contas_pagar` por medição.
- Retenções aprovadas ficam pendentes e podem ser liberadas após conclusão do contrato, gerando conta a pagar própria e auditável.
- Cancelar uma medição com conta aberta cancela a conta em uma única transação. Medição com conta paga não pode ser cancelada sem estorno financeiro autorizado.

## Modelo de dados aditivo

### Novas tabelas

- `contratos_empreiteiros`: cabeçalho, obra, fornecedor, tipo, objeto, datas, status, retenção padrão, adiantamento, totais e auditoria.
- `medicoes_empreiteiros`: cabeçalho do boletim, período, vencimento, status, totais bruto/líquido, aprovação e vínculo financeiro.
- `medicao_empreiteiro_ajustes`: descontos, adiantamentos, retenções, tributos e outros ajustes.
- `contrato_empreiteiro_aditivos`: alterações aprovadas de quantidade, preço, prazo ou escopo.
- `medicao_empreiteiro_anexos`: metadados e chave R2 de fotos/documentos, opcionalmente ligados a um item.
- `retencoes_empreiteiros`: valor retido, saldo, liberação e conta a pagar da liberação.
- `medicao_empreiteiro_links`: token com hash, validade e revogação para relatório público.
- `contrato_empreiteiro_auditoria`: ator, ação, entidade e fotografias anterior/posterior.
- `medicao_empreiteiro_alcadas`: perfis autorizados a aprovar, ativos/inativos, autor e datas da configuração; admin e diretor são semeados como padrão obrigatório.

### Extensões compatíveis

- `servicos_terceirizados` recebe `contrato_empreiteiro_id`, código, unidade, etapa, origem e referências congeladas do orçamento.
- `medicoes_terceirizados` recebe `medicao_empreiteiro_id`, modo de entrada, percentual atual e campos necessários ao snapshot.
- `contas_pagar` recebe vínculo ao cabeçalho da medição e à liberação de retenção, com índices únicos parciais.

O backfill não agrupa registros por suposição. Cada serviço legado gera seu próprio contrato de compatibilidade e cada medição legada gera seu próprio cabeçalho, preservando o significado original.

## Permissões iniciais

- Admin e diretor: gestão e aprovação completa, aditivos, cancelamentos e liberação de retenção.
- Engenharia: cria contratos em rascunho, registra medições, evidências e envia para aprovação.
- Compras: cria e edita contratos em rascunho e consulta medições.
- Financeiro/financeiro civil: pode pertencer à alçada de aprovação, informa vencimento, acompanha pagamentos e libera retenções conforme autorização.
- Outros perfis: sem acesso até receberem permissão explícita.

A aprovação da medição possui **uma única etapa**, como no fluxo público apresentado pelo Mais Controle. Engenharia registra e envia; um usuário incluído na alçada configurável aprova ou rejeita. Admin e diretor pertencem à alçada padrão; financeiro/financeiro civil pode ser incluído pela configuração da empresa. A aprovação registra usuário e horário, congela a medição e cria a conta a pagar. O aprovador não pode alterar silenciosamente quantidades medidas.

## Decisões operacionais fechadas

### Ajustes percentuais

Todos os ajustes percentuais da primeira versão usam como base o valor bruto da medição atual e são calculados de forma independente, nunca em cascata. Cada ajuste persiste `base_calculo_centavos`, percentual e valor resultante. Ajustes fixos persistem apenas o valor. Uma evolução futura poderá introduzir bases específicas por categoria sem reinterpretar medições antigas.

### Pagamento e status da medição

O status financeiro é sincronizado automaticamente a partir de `contas_pagar`. Pagamento integral muda a medição para `paga`; pagamento parcial mantém `aprovada` e exibe `valor_pago` e `saldo_a_pagar`. Uma medição com qualquer valor pago não pode ser cancelada nesta entrega: primeiro o Financeiro deve concluir um estorno em seu próprio fluxo; somente uma conta novamente aberta e sem valor pago pode ser cancelada pela RPC da medição.

### Aditivos

Todo aditivo nasce em `rascunho`, é enviado e aprovado por admin ou diretor. Ele vigora a partir da aprovação e não altera fotografias de medições anteriores. Pode aumentar ou reduzir quantidade, preço, prazo ou incluir item, mas nunca pode reduzir o total vigente de um item abaixo do acumulado já aprovado. Novo item recebe ID próprio e referência opcional à origem; aditivo rejeitado ou cancelado não altera saldos.

### Backfill legado

- Serviço `rascunho` vira contrato `rascunho`.
- Serviço `aprovado` vira contrato `ativo`.
- Serviço `concluido` vira contrato `concluido`.
- Serviço `cancelado` vira contrato `cancelado`.
- Medição `rascunho` vira boletim `rascunho`.
- Medição `reprovada` vira boletim `reprovada`.
- Medição `financeiro_gerado` vira `paga` somente quando sua `contas_pagar` estiver integralmente paga; nos demais casos vira `aprovada`.
- Datas e aprovadores existentes são preservados; campos sem evidência permanecem nulos e recebem marcador `origem_legada`, sem inventar eventos de auditoria.

### Empreitada global

Mesmo em empreitada global, cada item possui valor contratado próprio e a soma dos itens deve coincidir com o total vigente do contrato. Quando não houver rateio detalhado, o usuário pode cadastrar um único item global. Isso mantém a medição e o saldo verificáveis sem rateios implícitos.

### Conclusão e retenções

Quando todos os itens atingirem 100%, o sistema apenas sinaliza “pronto para concluir”. Admin ou diretor conclui o contrato após o aceite final. Retenções podem ser liberadas somente em contrato concluído, total ou parcialmente, por admin, diretor ou financeiro autorizado; cada liberação gera no máximo uma conta a pagar e preserva o saldo remanescente.

### Adiantamento

O adiantamento é um desembolso financeiro real. Após o contrato ficar ativo, uma ação explícita e idempotente gera a conta a pagar do adiantamento. A amortização nas medições não pode ultrapassar o total efetivamente pago e ainda não amortizado. Informar apenas um número no cabeçalho não cria pagamento automaticamente.

### Arredondamento e campo canônico

Quantidades usam escala de seis casas e percentuais quatro casas. Conversões usam arredondamento decimal “meio para cima”; valores finais são centavos inteiros. Em contratos por preço unitário, a quantidade atual é o campo canônico e o valor é derivado. Em item global, o valor em centavos é canônico e o percentual é derivado. O modo e o valor originalmente digitados também ficam registrados para auditoria.

## Relatórios e anexos

- Reutilizar o fluxo R2 de `src/lib/r2.ts`; nunca armazenar binários no PostgreSQL.
- Aceitar imagens e PDF dentro dos limites já adotados pelo ObrasFlow, validar tipo e tamanho no cliente e no servidor.
- O relatório contém dados da empresa, obra, empreiteiro, contrato, período, grade completa, ajustes, líquido, fotos selecionadas, observações, aprovações e histórico resumido.
- Impressão deve usar uma folha própria visível e não repetir o defeito antigo de conteúdo em branco.
- O link público retorna apenas campos permitidos por uma função segura; não expõe IDs internos, custos de outros contratos ou chaves privadas do R2.

## Compatibilidade e rollout

1. Criar Issue e branch conforme `AGENTS.md`.
2. Fazer backup recuperável dos arquivos e do schema afetados.
3. Aplicar migration somente aditiva e testar backfill/rollback em banco efêmero.
4. Liberar a nova interface com `VITE_CONTRATOS_EMPREITEIROS_V1=true` após validar a migration.
5. Manter `/prestadores` e a RPC antiga durante a estabilização.
6. Validar dados legados, contas a pagar e relatórios.
7. Somente em uma Issue futura considerar remoção de compatibilidade.

## Critérios de aceite

- O menu diferencia claramente Medição da Obra e Contratos de Empreiteiros.
- Um contrato pode combinar itens do orçamento, Excel e cadastro manual.
- O orçamento de origem não muda quando preço ou quantidade negociados são alterados.
- Uma única medição contém vários itens e mostra anterior, atual, acumulado e saldo.
- Entrada por quantidade, percentual e valor produz resultados equivalentes dentro do arredondamento definido.
- Sobre-medição e líquido negativo são recusados no banco.
- Dupla aprovação não duplica conta a pagar.
- Descontos, adiantamentos, retenções e tributos aparecem no relatório e no financeiro.
- Fotos e documentos podem ser anexados e exibidos com autorização adequada.
- Dados legados continuam acessíveis e seus vínculos financeiros permanecem válidos.
- Medição da Obra continua gerando conta a receber e não se mistura com contas a pagar.
- Desktop e celular permitem concluir os fluxos essenciais; a grade vira cartões ou rolagem controlada no mobile.
