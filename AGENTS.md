# Instruções de trabalho — ObrasFlow ERP

Estas regras são obrigatórias para qualquer agente, modelo ou pessoa que realize alterações neste repositório.

## Fluxo obrigatório

1. Antes de iniciar qualquer correção, melhoria, nova funcionalidade, alteração de infraestrutura ou migração de banco, verificar se já existe uma Issue correspondente.
2. Se não existir, criar uma Issue com objetivo, escopo e critérios de aceite antes de alterar arquivos.
3. Criar uma branch própria a partir de `main`, usando um nome claro, por exemplo:
   - `fix/123-corrigir-login`
   - `feat/124-propostas-hierarquicas`
   - `chore/125-ajustar-deploy`
4. Nunca enviar alterações diretamente para `main`.
5. Desenvolver e validar a alteração na branch da Issue.
6. Abrir uma Pull Request da branch para `main`.
7. A descrição da PR deve mencionar e fechar a Issue relacionada usando `Closes #<numero>`. Ela também deve informar:
   - resumo do que foi alterado;
   - como foi validado;
   - impacto no banco de dados e SQL/migrações que precisam ser executados, quando houver;
   - impacto na publicação, quando houver.
8. A publicação em produção ocorre somente após a PR ser aprovada e mesclada em `main`. Não mesclar sem autorização explícita do responsável pelo projeto.

## Organização

- Uma Issue por tarefa lógica. Não misturar alterações independentes na mesma PR.
- Corrigir comentários e conflitos na mesma branch e PR.
- Manter Issues e PRs em português, com títulos objetivos.
- Registrar na Issue qualquer impedimento ou decisão que altere o escopo inicial.
