# Proposta comercial independente da obra

## Intenção

Permitir que a proposta seja o primeiro registro comercial. Nenhuma obra será necessária para iniciar uma proposta; somente uma proposta aprovada e classificada como `Obra` poderá criar uma obra.

## Regras confirmadas

- A proposta manual exige cliente, título, classificação, escopo, valor/itens comerciais, validade e condições, mas não exige obra ou orçamento técnico.
- O orçamento técnico detalhado é opcional e será criado/anexado posteriormente, quando houver obra ou quando o usuário converter a proposta.
- `Obra` é a única classificação que cria obra automaticamente após aprovação.
- `Reforma`, `Projeto`, `Serviço`, `Regularização`, `Vistoria`, `Consultoria` e `Outro` apenas mudam para aprovada/contratada; não criam obra nem contrato automaticamente.
- Para converter qualquer proposta não-`Obra` em obra, o usuário usa uma ação manual e confirma/completa nome, endereço, responsável técnico e status.
- A aprovação deve ser transacional e idempotente.

## Compatibilidade

Propostas antigas vinculadas a obra e revisão de orçamento continuam funcionando. O fluxo antigo baseado em revisão congelada permanece disponível, mas a nova proposta manual será o padrão.

## Fora do escopo

Não alterar cronograma, arquivos, relatórios, medições, BDI ou composições SINAPI; não criar contratos automaticamente para propostas não classificadas como `Obra`.

## Critérios de aceite

1. Criar e publicar proposta sem obra cadastrada.
2. Aprovar `Obra` e criar exatamente uma obra vinculada.
3. Aprovar `Reforma` e demais tipos sem criar obra ou contrato automático.
4. Repetir aprovação sem duplicar obra.
5. Converter manualmente com confirmação e complementação dos dados.
6. Propostas antigas continuam abrindo, editando e imprimindo.
