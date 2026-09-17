
# Aproximar do Bling + Importador CSV/Excel

Plano em duas frentes: (1) novos módulos/telas para dar cara e função de ERP tipo Bling; (2) importador universal por upload de CSV/Excel exportado do Bling.

## 1. Novos módulos e melhorias (para ficar parecido com o Bling)

### Produtos & Estoque
- Nova tabela `produtos` (SKU, nome, categoria, unidade, preço_custo, preço_venda, NCM, GTIN, situação, estoque_min, estoque_max, imagem).
- Nova tabela `depositos` (multi-depósito) + `produto_estoque` (saldo por depósito).
- Nova tabela `movimentacoes_estoque` (entrada/saída/ajuste/transferência, com custo médio).
- Telas: lista de produtos com busca por SKU/nome/GTIN, ficha do produto (abas: geral, preços, estoque, fiscal), extrato de movimentações, ajuste de saldo.
- Melhorar página `estoque.tsx` existente para consumir as novas tabelas.

### Vendas (Pedidos/Orçamento/NF)
- Nova tabela `pedidos_venda` + `pedidos_venda_itens` (número, cliente, vendedor, situação: em aberto/atendido/cancelado, forma pgto, frete, desconto, totais).
- Baixa automática de estoque ao marcar como "atendido" (trigger).
- Tela lista de pedidos + formulário (semelhante ao de propostas atual, reaproveitando padrão).
- Placeholder para NF-e/NFS-e (campos e status; emissão real fora do escopo agora).

### Compras & Fornecedores
- Nova tabela `fornecedores` (ou reutilizar `clientes` com flag `tipo_relacao`: cliente/fornecedor/ambos — recomendado, evita duplicação).
- Nova tabela `pedidos_compra` + `pedidos_compra_itens`.
- Entrada de mercadoria vira movimentação de estoque + lançamento financeiro (contas a pagar).
- Tela lista + form de pedido de compra.

### Financeiro completo
- Estender `lancamentos_financeiros` existente com: forma_pagamento, conta_bancaria_id, categoria_dre, numero_documento, competencia.
- Novas tabelas `contas_bancarias`, `categorias_financeiras` (com hierarquia pai/filho para DRE).
- Tela de fluxo de caixa (previsto x realizado), conciliação manual (marcar como conciliado), DRE simplificado.
- Vincular contas a pedidos de venda/compra automaticamente.

### Dashboard estilo Bling
- Cards: vendas do mês, contas a receber vencendo, contas a pagar vencendo, estoque baixo, top produtos, top clientes.
- Gráficos de faturamento mensal e por categoria.

## 2. Importador de dados do Bling (CSV/Excel)

### Arquitetura
- Nova rota `_app/importacoes.tsx` — central de importações.
- Upload de arquivo (`.csv`, `.xlsx`) via input local; parse client-side com `papaparse` (CSV) e `xlsx` (Excel) — sem storage.
- Passo 1: usuário seleciona o tipo (Clientes, Produtos, Pedidos de venda, Contas a pagar, Contas a receber).
- Passo 2: preview das primeiras 20 linhas com **mapeamento de colunas** (dropdown por coluna do sistema, autopreenchido pelos cabeçalhos padrão do Bling).
- Passo 3: validação com zod (mostra linhas com erro, permite ignorar/corrigir).
- Passo 4: importação em lotes de 500 via `supabase.from().insert()` em `createServerFn` autenticada, com barra de progresso.
- Nova tabela `importacoes_log` (arquivo, tipo, total_linhas, sucesso, erros, usuário, data) + `importacoes_erros` (linha, campo, mensagem).

### Templates suportados na V1
Cabeçalhos padrão de exportação do Bling (com mapeamento automático):
- **Clientes**: Código, Nome, Fantasia, CPF/CNPJ, IE, Email, Telefone, Celular, CEP, Endereço, Número, Complemento, Bairro, Cidade, UF.
- **Produtos**: Código (SKU), Descrição, Unidade, NCM, Preço, Preço custo, Estoque, GTIN, Categoria, Situação.
- **Pedidos de venda**: Número, Data, Cliente (CPF/CNPJ ou código), Situação, Valor total, Forma pagamento, itens (arquivo separado ou uma linha por item).
- **Contas a pagar/receber**: Vencimento, Descrição, Categoria, Cliente/Fornecedor, Valor, Situação, Documento.

### Deduplicação
- Clientes: chave = CPF/CNPJ normalizado; se existir, atualiza; se não, insere.
- Produtos: chave = SKU (código); mesmo comportamento.
- Pedidos: chave = número + tipo; pula se já existe (evita reimportação duplicada).

### Página final
- Botão "Baixar modelo CSV" para cada tipo — gera template com cabeçalhos esperados.
- Botão "Ver histórico de importações" — lista `importacoes_log`.
- Se houver erros, botão "Baixar CSV de erros" para o usuário corrigir e reimportar só os erros.

## Detalhes técnicos

- **Migrações**: uma migration por módulo (produtos+estoque, compras, vendas, financeiro estendido, importações) com `GRANT`s e RLS por `auth.uid()` + `has_role`.
- **Server fns**: `src/lib/importacoes.functions.ts` com `requireSupabaseAuth`, uma fn por tipo (`importarClientes`, `importarProdutos`, etc.) recebendo `{ rows: unknown[] }` validadas por zod.
- **Bibliotecas novas**: `papaparse`, `xlsx` (SheetJS) — parse no browser, evita upload de arquivo.
- **Roles**: só `admin`, `diretor` e `financeiro` acessam importações (usar `has_role`).
- **UI**: seguir padrão atual das páginas de propostas (Table + Dialog + shadcn Form).

## Ordem de execução sugerida

1. Migration: `fornecedores` como flag em `clientes` + tabelas `produtos`, `depositos`, `produto_estoque`, `movimentacoes_estoque`.
2. Migration: `pedidos_venda`/`itens`, `pedidos_compra`/`itens`, extensões financeiras, `contas_bancarias`, `categorias_financeiras`.
3. Migration: `importacoes_log`, `importacoes_erros`.
4. Instalar `papaparse` e `xlsx`.
5. Página de Importações + server fns.
6. Páginas de Produtos, Pedidos de Venda, Pedidos de Compra.
7. Extensão do Financeiro (contas bancárias, categorias, fluxo, DRE).
8. Dashboard estilo Bling.

## Fora do escopo desta rodada

- Emissão real de NF-e/NFS-e (exige certificado A1 + SEFAZ — projeto separado).
- Integração automática com marketplaces.
- Impressão de boletos/PIX (pode virar próxima fase).
- API oficial Bling v3 (OAuth) — você escolheu CSV; fica como extensão futura.

Confirma para começar pela **Fase 1 (migrations de Produtos/Estoque)** e o **Importador** em paralelo?
