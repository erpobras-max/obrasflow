# Cadastro de empreiteiros no menu

## Intenção

Deixar evidente que o cadastro dos empreiteiros fica dentro do grupo **Empreiteiros**, reduzindo a dúvida causada pelo rótulo genérico atual.

## Escopo

- Renomear o item **Cadastro e serviços** para **Cadastro de empreiteiros**.
- Manter o destino existente `/prestadores`, que já concentra o cadastro e os serviços do prestador.
- Manter **Contratos de empreiteiros** como item separado logo abaixo.
- Corrigir o contraste da busca do menu com fundo branco, texto digitado escuro, placeholder e ícone em cinza legível e foco visível.
- Atualizar o teste do menu e o `PROGRESS.md`.

## Fora do escopo

- Criar uma nova tela, rota ou tabela de empreiteiros.
- Alterar dados existentes ou executar migration.
- Separar agora os serviços em uma nova aba.

## Abordagens consideradas

1. **Renomear o item existente** — escolhida por tornar a função clara sem duplicar cadastro, rota ou dados.
2. Criar dois atalhos para cadastro e serviços — rejeitada porque ambos abririam a mesma tela e aumentariam a redundância.
3. Criar uma nova tela exclusiva — rejeitada porque duplicaria uma função que `/prestadores` já atende.

## Resultado esperado

O grupo ficará na ordem **Cadastro de empreiteiros** e **Contratos de empreiteiros**, preservando todas as funcionalidades atuais e deixando mais claro onde novos empreiteiros são cadastrados. A busca continuará no mesmo lugar e tamanho, mas o texto **Buscar módulo**, o ícone e o conteúdo digitado terão contraste suficiente para leitura.
