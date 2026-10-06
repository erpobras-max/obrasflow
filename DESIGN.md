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

- Conteúdo principal usa espaçamento de 24 px no desktop e 12–20 px no celular.
- Telas de gestão usam cabeçalho com título, descrição curta e ação primária à direita; no celular, a ação fica abaixo do título e ocupa largura necessária.
- Tabelas densas preservam colunas essenciais; no celular, priorize cartões ou rolagem horizontal explícita com cabeçalho legível.
- Formulários usam uma coluna no celular, duas no tablet e até três somente quando os campos forem curtos e relacionados.
- Alvos de toque têm no mínimo 44 px de altura/largura.

## Componentes

### Formulários

- Todo campo tem `Label` visível, `id`, `name`, tipo apropriado, `inputMode` quando necessário e `autocomplete` coerente.
- Máscaras não impedem colar conteúdo. CPF, CNPJ, CEP e telefone aceitam somente dígitos e são formatados durante a digitação.
- Erros aparecem junto ao campo e em linguagem acionável. O primeiro erro recebe foco ao enviar o formulário.
- Enquanto uma requisição estiver em curso, o botão exibe indicador de carregamento e previne duplicidade de envio.
- Campos monetários mostram a moeda e atualizam totais próximos em tempo real.

### Tabelas e listas

- Cabeçalho sempre identifica a unidade, como “Valor (R$)” e “Execução (%)”.
- Ações de linha ficam à direita, possuem rótulo acessível e não desaparecem somente por hover.
- Listas vazias explicam o que falta e oferecem a ação possível, sem parecer erro.
- Exclusão pede confirmação e explica o impacto. Registros financeiros vinculados nunca são removidos sem regra de negócio explícita.

### Modais e feedback

- Modal tem título, descrição quando houver risco, foco inicial útil e rolagem interna sem bloquear o elemento focado.
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
