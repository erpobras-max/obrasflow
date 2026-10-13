# Revisão de interface — ObrasFlow

Use esta lista ao revisar uma rota, modal ou componente antes de publicar. Ela adapta as [Web Interface Guidelines da Vercel](https://github.com/vercel-labs/web-interface-guidelines) ao ObrasFlow.

## Obrigatório

- Campos possuem `Label`, `name`, tipo, `autocomplete` e `inputMode` quando aplicável.
- Ações usam `button`; navegação usa `Link` ou `a`.
- Botões de ícone possuem `aria-label`; imagens têm `alt` e dimensões.
- Foco por teclado está visível e nenhum `outline` é removido sem substituto.
- Mensagens de erro explicam como corrigir; mensagens assíncronas usam `aria-live` ou papel semântico adequado.
- Exclusões têm confirmação e preservam integridade financeira/documental.
- Tabelas possuem cabeçalhos, unidades, tratamento de textos longos e ações sempre alcançáveis.
- Interface foi conferida em 360 px e em desktop.

## Boas práticas

- Usar `Intl` para valores e datas brasileiros.
- Usar `tabular-nums` para colunas numéricas.
- Evitar `transition: all`; respeitar `prefers-reduced-motion`.
- Tratar estados vazio, carregando, sucesso e falha.
- Sincronizar filtros, paginação e abas relevantes com a URL quando fizer sentido.

## Comando de auditoria

Antes de uma revisão, consultar a versão atual das diretrizes oficiais e registrar achados no formato `arquivo:linha — problema`.
