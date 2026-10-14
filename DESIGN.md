# ObrasFlow — Linguagem de interface

## Objetivo

O ObrasFlow é um ERP de construção civil e imobiliária. A interface deve priorizar leitura rápida, segurança em operações financeiras e clareza para pessoas no escritório, na obra e no celular. A estética é sóbria e técnica: informação primeiro, ornamento por último.

## Fundamentos visuais

- **Base:** superfícies claras, texto azul-ardósia e contraste alto.
- **Marca e ação principal:** azul técnico (`primary`).
- **Destaque e atenção:** âmbar (`accent`), reservado para ação relevante, avisos de prazo e foco.
- **Estados semânticos:** verde para concluído/pago/efetivado; azul para em andamento/proposta; âmbar para pendência; vermelho para erro, cancelamento ou exclusão.
- **Raio:** `0.625rem` como padrão. Não usar cartões excessivamente arredondados.
- **Sombra:** discreta. Cards administrativos usam borda antes de sombra.

Os tokens ficam em `src/styles.css`. Ao criar uma cor nova, use uma variável semântica em OKLCH e registre-a no bloco `@theme inline`; não introduza valores hex avulsos em telas.

## Tipografia e conteúdo

- Use títulos curtos, em português do Brasil, em voz ativa.
- Uma página possui um único `h1`; seções internas usam `h2` e `h3` em ordem.
- Valores, percentuais, datas e códigos devem ter largura previsível; use `tabular-nums` em tabelas e indicadores financeiros.
- Formate valores com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e datas com `Intl.DateTimeFormat('pt-BR')`.
- Textos longos em tabelas devem usar quebra, truncamento ou tooltip. Nunca deixá-los deslocar ações ou totais.
- Botões descrevem a ação: “Salvar venda”, “Excluir documento”, “Gerar relatório”. Evite “Continuar” quando a ação for específica.

## Layout e responsividade

### Regras gerais

- Conteúdo principal usa espaçamento de 24 px no desktop e 12–20 px no celular.
- Telas de gestão usam cabeçalho com título, descrição curta e ação primária à direita; no celular, a ação fica abaixo do título e ocupa a largura necessária.
- Formulários usam uma coluna no celular, duas no tablet e até três somente quando os campos forem curtos e relacionados.
- Alvos de toque têm no mínimo 44 px de altura/largura.

### Sem rolagem horizontal da página

- **A página nunca rola na horizontal** em larguras a partir de 360 px. Rolagem horizontal só é permitida dentro de um contêiner próprio (lista de abas ou tabela densa), nunca no corpo da página.
- Filhos de `flex` e `grid` que contêm tabelas, abas, imagens ou textos longos usam `min-w-0` para não estourar a largura da tela.
- Não usar larguras fixas em `px` para colunas, cartões ou contêineres; usar unidades relativas, `max-w-full` e `w-full`.
- O contêiner principal do layout (`_app`) usa `overflow-x-clip` como proteção final, sem esconder conteúdo que deveria rolar dentro de seu próprio contêiner.
- Conteúdo largo (tabelas, código, diagramas, mapas) rola dentro de um contêiner com `overflow-x-auto`.

## Componentes

### Formulários

- Todo campo tem `Label` visível, `id`, `name`, tipo apropriado, `inputMode` quando necessário e `autocomplete` coerente.
- Máscaras não impedem colar conteúdo. CPF, CNPJ, CEP e telefone aceitam somente dígitos e são formatados durante a digitação.
- Erros aparecem junto ao campo e em linguagem acionável. O primeiro erro recebe foco ao enviar o formulário.
- Enquanto uma requisição estiver em curso, o botão exibe indicador de carregamento e previne duplicidade de envio.
- Campos monetários mostram a moeda e atualizam totais próximos em tempo real.
- Ao usar `FormLabel`, `FormControl` e `FormMessage`, sempre dentro de um `FormField`.

### Abas

- Abas (`Tabs`) cuja lista é mais larga que a tela **rolam dentro da própria lista**: `overflow-x-auto`, `whitespace-nowrap`, sem quebra de linha e com a barra de rolagem oculta.
- Cada aba tem no mínimo 44 px de altura e não encolhe (`shrink-0`).
- A aba ativa permanece visível: ao selecioná-la, a lista rola até ela.
- Com mais de cinco abas em tela pequena, considerar um seletor (dropdown) no lugar da lista.
- Abas nunca deslocam o conteúdo da página para o lado.

### Tabelas e listas

- Toda tabela do sistema usa o componente `ResponsiveTable` (`src/components/ui/responsive-table.tsx`). Não criar tabelas soltas com `<table>` nas telas.
- Cada coluna declara título, forma de exibição, **prioridade** (`essential` ou `secondary`) e um rótulo para uso no cartão.
- Cabeçalho sempre identifica a unidade, como “Valor (R$)” e “Execução (%)”.
- Ações de linha ficam à direita, possuem rótulo acessível, têm alvo de toque de 44 px e não desaparecem somente por hover.
- Listas vazias explicam o que falta e oferecem a ação possível, sem parecer erro.
- Estados de carregamento usam esqueleto ou indicador, nunca uma tabela vazia.
- Exclusão pede confirmação e explica o impacto. Registros financeiros vinculados nunca são removidos sem regra de negócio explícita.

#### Padrões no celular (abaixo de `md`)

Cada tela usa um dos três padrões abaixo, conforme o tipo de dado:

1. **Cartões (padrão para listas operacionais).** Movimentações, compras, cotações, obras, medições, prestadores e similares. Cada linha vira um cartão com 3 a 4 dados principais (as colunas `essential`) e um bloco “Ver detalhes” com as demais. Ações ficam no rodapé do cartão.
2. **Detalhe em gaveta.** Quando as colunas secundárias são muitas, tocar na linha abre uma gaveta ou modal com todos os campos.
3. **Rolagem contida (somente tabelas densas).** Relatórios, financeiro e extratos com muitas colunas numéricas. A tabela rola dentro de um contêiner com `overflow-x-auto`, a **primeira coluna fica fixa** (`sticky`), o cabeçalho continua legível e há uma indicação visual de que existe mais conteúdo à direita (sombra ou gradiente na borda).

No desktop (`md` ou acima), todas as variantes voltam a ser uma tabela comum.

### Modais e feedback

- Modal tem título, descrição quando houver risco, foco inicial útil e rolagem interna sem bloquear o elemento focado.
- Em telas pequenas, modais longos ocupam a largura útil, sem rolagem horizontal, e o botão de ação principal permanece visível.
- Toasts e validações assíncronas usam região acessível (`aria-live="polite"`).
- Sucesso confirma o resultado; erro informa o próximo passo e nunca expõe dados técnicos ou credenciais.

### Imagens e documentos

- Toda imagem significativa tem `alt`, dimensões e carregamento preguiçoso quando estiver abaixo da dobra.
- Imagens de imóvel mantêm proporção, navegação por teclado e ação para ampliar.
- Arquivos exibem nome, tipo, tamanho, data e ação clara para abrir ou remover.

## Acessibilidade e interação

- Ações usam `button`; navegação usa `Link` ou `a`.
- Ícones decorativos usam `aria-hidden`; botões apenas com ícone precisam de `aria-label`.
- Todo controle interativo mantém `focus-visible` evidente, com o anel de foco de `ring`.
- Não remover `outline` sem oferecer substituto visível.
- Animações usam somente `transform`/`opacity`, evitam `transition: all` e respeitam `prefers-reduced-motion`.
- Arrastar, ordenar e assinar devem ter alternativa por botão ou teclado sempre que viável.

## Páginas públicas

Login, portal do cliente, imóvel público e assinatura são vitrines do sistema. Devem ter hierarquia visual mais espaçada, porém manter a mesma paleta, nomenclatura e mensagens do ERP. Animação é discreta; confiança, leitura e conclusão da tarefa têm prioridade.

## Revisão antes de publicar

1. A tela funciona com teclado e em largura de 360 px.
2. Campos têm rótulos, tipos e mensagens de erro compreensíveis.
3. Botões críticos continuam visíveis sem hover.
4. Estados vazio, carregando, sucesso e erro foram considerados.
5. Não há `transition: all`, navegação em `div` ou imagem sem texto alternativo adequado.
6. Totais, datas e moedas usam formatação brasileira consistente.
7. Em 360 px e 390 px, a página não ganha rolagem horizontal (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`).
8. As abas rolam dentro da própria lista e a aba ativa está visível.
9. As tabelas usam `ResponsiveTable` e, no celular, aparecem como cartões ou em rolagem contida com a primeira coluna fixa.