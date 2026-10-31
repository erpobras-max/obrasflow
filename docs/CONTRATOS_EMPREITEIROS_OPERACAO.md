# Manual Operacional — Contratos de Empreiteiros e Medições

Este guia orienta engenheiros, gestores de obras e administradores na operação do módulo de **Contratos de Empreiteiros** no ObrasFlow ERP.

---

## 1. Regra Conceitual

O ObrasFlow ERP separa rigorosamente os dois fluxos de medição da construtora:

| Fluxo | Rota | Objetivo | Efeito Financeiro |
| :--- | :--- | :--- | :--- |
| **Medição da Obra** | `/medicoes` | Acompanhar o avanço da obra para o cliente | Gera **Conta a Receber** |
| **Contratos de Empreiteiros** | `/contratos-empreiteiros` | Acompanhar o serviço prestado por terceirizados | Gera **Conta a Pagar** |

---

## 2. Passo a Passo Operacional

### A. Criando um Novo Contrato de Empreiteiro
1. Acesse o menu lateral em **Obras > Contratos Empreiteiros** (ou acesse `/contratos-empreiteiros`).
2. Clique no botão **"+ Novo Contrato"**.
3. Preencha:
   - **Obra:** selecione o empreendimento onde o serviço será executado.
   - **Empreiteiro / Prestador:** selecione o fornecedor terceirizado cadastrado.
   - **Modalidade:** Preço Unitário (medição por avanço físico) ou Empreitada Global.
   - **Objeto do Contrato:** resumo claro do escopo contratado.
   - **Retenção Técnica Padrão (%):** percentual padrão a ser retido a cada medição como garantia (ex: 5%).
   - **Adiantamento Previsto (R$):** valor inicial eventualmente concedido ao prestador para compra de insumos/mobilização.

### B. Adicionando Itens ao Escopo
Você tem 3 formas flexíveis de compor os itens contratados:
1. **Importar do Orçamento:** clique em `Do Orçamento` para abrir as atividades do orçamento analítico da obra com preços e BDI calculados. Marque os itens desejados e clique em `Adicionar ao Contrato`.
2. **Importar Planilha Excel / CSV:** clique em `Do Excel` e selecione ou arraste a planilha. As colunas *Descrição*, *Unidade*, *Quantidade* e *Preço Unitário* são identificadas automaticamente.
3. **Item Manual:** adicione linhas avulsas preenchendo descrição, unidade, quantidade e preço unitário.

Ao salvar, o contrato é ativado e já fica disponível para emissão de boletins de medição.

---

### C. Emitindo um Boletim de Medição (BM)
1. No painel do contrato, clique em **"Nova Medição"** (o número sequencial BM-01, BM-02 é gerado automaticamente).
2. Na janela de edição:
   - Defina o **Período de Medição** (início e término).
   - Defina a **Data de Vencimento** (data que será gravada na Conta a Pagar gerada no financeiro).
3. **Preenchendo os Serviços Executados:**
   - Você pode digitar na coluna **Qtd**, no **%** ou no **Valor Medido (R$)**. Ao alterar qualquer um dos três, o sistema recalcula instantaneamente os demais.
   - O sistema exibe o contratado, a medição anterior e o acumulado atual.
   - Se o quantitativo medido ultrapassar o saldo contratado restante, um alerta visual vermelho de estouro de saldo será exibido.

---

### D. Deduções e Retenções
No quadro inferior esquerdo, você pode gerenciar os ajustes:
- **Retenção Técnica:** calculada automaticamente com base no percentual padrão do contrato (ex: 5% sobre o valor medido bruto).
- **Amortização de Adiantamento:** deduza valores adiantados previamente ao prestador.
- **Descontos Operacionais:** lance descontos por compra de EPIs pela construtora, retrabalhos ou ferramentas danificadas.

O quadro da direita atualiza em tempo real o **Valor Bruto Medido**, o **Total de Deduções** e o **Valor Líquido a Pagar**.

---

### E. Evidências Fotográficas e Link Compartilhável
1. Clique no botão **"Fotos & Link"** no cabeçalho do boletim.
2. Faça upload de fotos do avanço físico dos serviços (armazenamento de alta performance no Cloudflare R2).
3. Clique em **"Copiar Link"** para enviar por WhatsApp ou e-mail ao empreiteiro.
4. O link gerado é público, seguro e permite ao empreiteiro visualizar o relatório completo com fotos no celular ou computador, sem necessidade de usuário no sistema.

---

### F. Aprovação e Integração com Contas a Pagar
1. Quando a medição for conferida pelo fiscal ou engenheiro da obra, clique em **"Aprovar Medição e Gerar Conta a Pagar"**.
2. Uma confirmação detalhada será exibida. Ao confirmar:
   - Os saldos do contrato são atualizados de forma atômica no banco de dados.
   - É gerada exatamente **1 Conta a Pagar** no módulo Financeiro com o valor líquido e o vencimento definidos.
   - Se houver retenção técnica, ela é registrada no painel de retenções do contrato com saldo a liberar.

---

### G. Liberação de Retenções Técnicas
Ao término da obra ou do prazo de garantia contratual:
1. No painel do contrato, clique em **"Retenções"**.
2. Selecione a retenção desejada e clique em **"Liberar"**.
3. Informe o valor a liberar e a data de vencimento do pagamento.
4. O sistema gera automaticamente a Conta a Pagar no Financeiro correspondente à liberação.

---

### H. Termos Aditivos Contratuais
Caso haja acréscimo de serviços, reajuste ou prorrogação de prazo:
1. No painel do contrato, clique em **"+ Termo Aditivo"**.
2. Selecione o tipo (*Quantidade*, *Preço*, *Prazo*, *Escopo* ou *Misto*).
3. Informe o valor de acréscimo em R$ e os dias adicionais.
4. O valor total atualizado do contrato é recalculado instantaneamente.

