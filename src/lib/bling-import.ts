// Utilitários e mapeamentos de importação de dados do Bling (CSV/Excel).
import { z } from "zod";
import { onlyDigits } from "./validacao-documento";

// ============ Tipos suportados ============
export const TIPOS_IMPORTACAO = ["clientes","produtos","pedidos_venda","contas_receber","contas_pagar"] as const;
export type TipoImportacao = typeof TIPOS_IMPORTACAO[number];

export const TIPO_IMPORT_LABEL: Record<TipoImportacao, string> = {
  clientes: "Clientes / Fornecedores",
  produtos: "Produtos",
  pedidos_venda: "Pedidos de Venda",
  contas_receber: "Contas a Receber",
  contas_pagar: "Contas a Pagar",
};

// ============ Campos por tipo ============
export interface CampoDestino {
  id: string;
  label: string;
  obrigatorio: boolean;
  aliases: string[]; // cabeçalhos do Bling (case-insensitive)
}

export const CAMPOS: Record<TipoImportacao, CampoDestino[]> = {
  clientes: [
    { id: "codigo_externo", label: "Código", obrigatorio: false, aliases: ["codigo","código","id","id contato"] },
    { id: "nome", label: "Nome / Razão Social", obrigatorio: true, aliases: ["nome","razao social","razão social"] },
    { id: "nome_fantasia", label: "Nome Fantasia", obrigatorio: false, aliases: ["fantasia","nome fantasia","apelido"] },
    { id: "cpf_cnpj", label: "CPF / CNPJ", obrigatorio: true, aliases: ["cpf","cnpj","cpf/cnpj","cpf ou cnpj","documento"] },
    { id: "rg_ie", label: "RG / IE", obrigatorio: false, aliases: ["rg","ie","inscricao estadual","inscrição estadual"] },
    { id: "email", label: "Email", obrigatorio: false, aliases: ["email","e-mail"] },
    { id: "telefone", label: "Telefone", obrigatorio: false, aliases: ["telefone","fone"] },
    { id: "celular", label: "Celular", obrigatorio: false, aliases: ["celular","whatsapp"] },
    { id: "cep", label: "CEP", obrigatorio: false, aliases: ["cep"] },
    { id: "logradouro", label: "Endereço", obrigatorio: false, aliases: ["endereco","endereço","logradouro","rua"] },
    { id: "numero", label: "Número", obrigatorio: false, aliases: ["numero","número","nº","num"] },
    { id: "complemento", label: "Complemento", obrigatorio: false, aliases: ["complemento"] },
    { id: "bairro", label: "Bairro", obrigatorio: false, aliases: ["bairro"] },
    { id: "cidade", label: "Cidade", obrigatorio: false, aliases: ["cidade","municipio","município"] },
    { id: "uf", label: "UF", obrigatorio: false, aliases: ["uf","estado"] },
    { id: "tipo_relacao", label: "Tipo (cliente/fornecedor/ambos)", obrigatorio: false, aliases: ["tipo","tipo relacao","tipo de relacao"] },
  ],
  produtos: [
    { id: "sku", label: "SKU / Código", obrigatorio: true, aliases: ["codigo","código","sku","cod","cód"] },
    { id: "nome", label: "Descrição / Nome", obrigatorio: true, aliases: ["descricao","descrição","nome","produto"] },
    { id: "unidade", label: "Unidade", obrigatorio: false, aliases: ["unidade","un","unid"] },
    { id: "ncm", label: "NCM", obrigatorio: false, aliases: ["ncm"] },
    { id: "gtin", label: "GTIN / EAN", obrigatorio: false, aliases: ["gtin","ean","codigo de barras","código de barras"] },
    { id: "preco_venda", label: "Preço de venda", obrigatorio: false, aliases: ["preco","preço","preco venda","preço venda","valor"] },
    { id: "preco_custo", label: "Preço de custo", obrigatorio: false, aliases: ["preco custo","preço custo","custo"] },
    { id: "estoque_inicial", label: "Estoque atual", obrigatorio: false, aliases: ["estoque","estoque atual","saldo"] },
    { id: "estoque_minimo", label: "Estoque mínimo", obrigatorio: false, aliases: ["estoque minimo","estoque mínimo","min"] },
    { id: "categoria", label: "Categoria", obrigatorio: false, aliases: ["categoria","grupo"] },
    { id: "situacao", label: "Situação (ativo/inativo)", obrigatorio: false, aliases: ["situacao","situação","status","ativo"] },
  ],
  pedidos_venda: [
    { id: "codigo_externo", label: "Número", obrigatorio: false, aliases: ["numero","número","pedido","codigo","código"] },
    { id: "cpf_cnpj_cliente", label: "CPF/CNPJ do cliente", obrigatorio: true, aliases: ["cpf","cnpj","cpf/cnpj","cpf cliente","documento cliente"] },
    { id: "data_pedido", label: "Data do pedido", obrigatorio: false, aliases: ["data","data pedido","emissao","emissão"] },
    { id: "situacao", label: "Situação", obrigatorio: false, aliases: ["situacao","situação","status"] },
    { id: "valor_total", label: "Valor total", obrigatorio: true, aliases: ["valor","valor total","total"] },
    { id: "forma_pagamento", label: "Forma de pagamento", obrigatorio: false, aliases: ["forma pagamento","pagamento"] },
    { id: "observacoes", label: "Observações", obrigatorio: false, aliases: ["observacoes","observações","obs"] },
  ],
  contas_receber: [
    { id: "descricao", label: "Descrição", obrigatorio: true, aliases: ["descricao","descrição","historico","histórico"] },
    { id: "valor", label: "Valor", obrigatorio: true, aliases: ["valor","valor total","total"] },
    { id: "data_vencimento", label: "Vencimento", obrigatorio: true, aliases: ["vencimento","data vencimento","venc"] },
    { id: "cpf_cnpj_cliente", label: "CPF/CNPJ do cliente", obrigatorio: false, aliases: ["cpf","cnpj","cpf/cnpj","documento"] },
    { id: "numero_documento", label: "Nº documento", obrigatorio: false, aliases: ["documento","nº documento","numero documento","numero doc"] },
    { id: "forma_pagamento", label: "Forma pagamento", obrigatorio: false, aliases: ["forma pagamento","pagamento"] },
    { id: "categoria", label: "Categoria", obrigatorio: false, aliases: ["categoria"] },
    { id: "situacao", label: "Situação", obrigatorio: false, aliases: ["situacao","situação","status"] },
    { id: "observacoes", label: "Observações", obrigatorio: false, aliases: ["observacoes","observações","obs"] },
  ],
  contas_pagar: [
    { id: "descricao", label: "Descrição", obrigatorio: true, aliases: ["descricao","descrição","historico","histórico"] },
    { id: "valor", label: "Valor", obrigatorio: true, aliases: ["valor","valor total","total"] },
    { id: "data_vencimento", label: "Vencimento", obrigatorio: true, aliases: ["vencimento","data vencimento","venc"] },
    { id: "cnpj_fornecedor", label: "CNPJ do fornecedor", obrigatorio: false, aliases: ["cnpj","cnpj fornecedor","documento","cpf/cnpj"] },
    { id: "nome_fornecedor", label: "Nome do fornecedor", obrigatorio: false, aliases: ["fornecedor","nome fornecedor","razao social","razão social"] },
    { id: "numero_documento", label: "Nº documento", obrigatorio: false, aliases: ["documento","nº documento","numero documento","numero doc"] },
    { id: "forma_pagamento", label: "Forma pagamento", obrigatorio: false, aliases: ["forma pagamento","pagamento"] },
    { id: "categoria", label: "Categoria", obrigatorio: false, aliases: ["categoria"] },
    { id: "situacao", label: "Situação", obrigatorio: false, aliases: ["situacao","situação","status"] },
    { id: "observacoes", label: "Observações", obrigatorio: false, aliases: ["observacoes","observações","obs"] },
  ],
};

// ============ Helpers ============
export function normalizeHeader(h: string): string {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 /]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function autoMap(headers: string[], tipo: TipoImportacao): Record<string, string> {
  const map: Record<string, string> = {};
  const campos = CAMPOS[tipo];
  headers.forEach((h) => {
    const n = normalizeHeader(h);
    const found = campos.find((c) => c.aliases.some((a) => normalizeHeader(a) === n));
    if (found) map[found.id] = h;
  });
  return map;
}

export function parseBRLNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/[R$\s]/g, "");
  // Formato brasileiro: 1.234,56 → 1234.56
  const noDots = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(noDots);
  return isNaN(n) ? 0 : n;
}

export function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  // yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Excel serial
  const n = Number(s);
  if (!isNaN(n) && n > 25000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function normalizeCpfCnpj(v: unknown): string {
  return onlyDigits(String(v ?? ""));
}

// ============ Schemas de linha (server-side) ============
export const clienteRowSchema = z.object({
  nome: z.string().trim().min(2),
  cpf_cnpj: z.string().trim().min(11),
  nome_fantasia: z.string().trim().optional().nullable(),
  rg_ie: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  celular: z.string().trim().optional().nullable(),
  cep: z.string().trim().optional().nullable(),
  logradouro: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  complemento: z.string().trim().optional().nullable(),
  bairro: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  uf: z.string().trim().max(2).optional().nullable(),
  tipo_relacao: z.enum(["cliente","fornecedor","ambos"]).optional().default("cliente"),
  codigo_externo: z.string().trim().optional().nullable(),
});

export const produtoRowSchema = z.object({
  sku: z.string().trim().min(1),
  nome: z.string().trim().min(2),
  unidade: z.string().trim().max(10).optional().default("UN"),
  ncm: z.string().trim().optional().nullable(),
  gtin: z.string().trim().optional().nullable(),
  preco_venda: z.number().nonnegative().optional().default(0),
  preco_custo: z.number().nonnegative().optional().default(0),
  estoque_inicial: z.number().optional().default(0),
  estoque_minimo: z.number().nonnegative().optional().default(0),
  categoria: z.string().trim().optional().nullable(),
  situacao: z.enum(["ativo","inativo"]).optional().default("ativo"),
});

export const pedidoVendaRowSchema = z.object({
  cpf_cnpj_cliente: z.string().trim().min(11),
  data_pedido: z.string().nullable().optional(),
  situacao: z.string().trim().optional().nullable(),
  valor_total: z.number().nonnegative(),
  forma_pagamento: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
  codigo_externo: z.string().trim().optional().nullable(),
});

export const contaReceberRowSchema = z.object({
  descricao: z.string().trim().min(2),
  valor: z.number().nonnegative(),
  data_vencimento: z.string().min(1),
  cpf_cnpj_cliente: z.string().trim().optional().nullable(),
  numero_documento: z.string().trim().optional().nullable(),
  forma_pagamento: z.string().trim().optional().nullable(),
  categoria: z.string().trim().optional().nullable(),
  situacao: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

export const contaPagarRowSchema = z.object({
  descricao: z.string().trim().min(2),
  valor: z.number().nonnegative(),
  data_vencimento: z.string().min(1),
  cnpj_fornecedor: z.string().trim().optional().nullable(),
  nome_fornecedor: z.string().trim().optional().nullable(),
  numero_documento: z.string().trim().optional().nullable(),
  forma_pagamento: z.string().trim().optional().nullable(),
  categoria: z.string().trim().optional().nullable(),
  situacao: z.string().trim().optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

export type ClienteRow = z.infer<typeof clienteRowSchema>;
export type ProdutoRow = z.infer<typeof produtoRowSchema>;
export type PedidoVendaRow = z.infer<typeof pedidoVendaRowSchema>;
export type ContaReceberRow = z.infer<typeof contaReceberRowSchema>;
export type ContaPagarRow = z.infer<typeof contaPagarRowSchema>;
