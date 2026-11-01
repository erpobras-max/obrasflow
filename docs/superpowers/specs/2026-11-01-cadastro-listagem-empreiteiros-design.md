# Cadastro e listagem de empreiteiros

## Intenção

Eliminar a sobreposição entre a tela legada de serviços terceirizados e o módulo moderno de contratos. A rota `/prestadores` passa a ser o cadastro mestre de empreiteiros; `/contratos-empreiteiros` concentra contratação, escopo, medições e pagamentos.

## Solução escolhida

- Usar a tabela existente `fornecedores`, sempre com `classificacao = 'terceirizado'`, para não duplicar pessoas ou empresas.
- Exibir em `/prestadores` uma listagem pesquisável de empreiteiros ativos e inativos.
- Permitir cadastrar e editar pessoa física ou jurídica com nome/razão social, CPF/CNPJ, nome fantasia, especialidade, telefone, e-mail, avaliação e situação.
- Permitir ativar ou inativar pelo formulário, sem exclusão física.
- Remover da rota a interface de serviços contratados e seu botão **Novo serviço**.
- Manter o componente e os registros legados no código/banco; nenhuma exclusão ou migration destrutiva será executada.
- Corrigir a policy ampla legada: empreiteiros ficam com escrita para `admin`/`compras` e exclusão para `admin`, sem retirar as permissões existentes dos fornecedores comuns.
- Manter `/contratos-empreiteiros` como destino exclusivo para serviços, contratos, medições, retenções e pagamentos.

## Abordagens consideradas

1. **Cadastro mestre em `/prestadores` e operação em `/contratos-empreiteiros`** — escolhida por eliminar redundância e preservar a mesma chave de fornecedor já usada nos contratos.
2. Manter cadastro e serviços em abas — rejeitada porque continuaria duplicando o módulo de contratos.
3. Criar nova tabela `empreiteiros` — rejeitada porque quebraria os vínculos existentes e duplicaria `fornecedores`.

## Regras

- Novos registros criados nesta tela devem receber `classificacao = 'terceirizado'`.
- A listagem não deve mostrar fornecedores de materiais classificados como `fornecedor`.
- CPF é usado para pessoa física e CNPJ para pessoa jurídica; o documento do outro tipo deve ser salvo como nulo.
- Busca deve ignorar maiúsculas e acentos e pesquisar nome, nome fantasia, documento e especialidade.
- Usuários sem papel `admin` ou `compras` podem visualizar, mas não criar ou editar.
- A avaliação é opcional; quando informada, deve ser um inteiro de 1 a 5, conforme a constraint existente no banco.

## Fora do escopo

- Converter automaticamente registros de `servicos_terceirizados` em contratos.
- Excluir registros legados.
- Alterar colunas ou migrar dados do banco.
- Publicar ou mesclar a branch; a entrega solicitada termina no commit.
