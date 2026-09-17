import { z } from "zod";

// FORNECEDOR
export const fornecedorSchema = z.object({
  razao_social: z.string().trim().min(2, "Razão social obrigatória").max(200),
  nome_fantasia: z.string().trim().max(200).optional().or(z.literal("")),
  cnpj: z.string().trim().optional().or(z.literal("")),
  cpf: z.string().trim().optional().or(z.literal("")),
  tipo: z.enum(["pf", "pj"]),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().trim().optional().or(z.literal("")),
  avaliacao: z.coerce.number().int().min(1).max(5).optional().or(z.literal("" as any)),
  ativo: z.boolean().default(true),
});

export type FornecedorFormValues = z.infer<typeof fornecedorSchema>;

// PRODUTO
export const produtoSchema = z.object({
  // aliases legados usados nas telas de compras
  codigo: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
  sku: z.string().trim().min(1, "Código SKU obrigatório").max(50),
  nome: z.string().trim().min(2, "Descrição/Nome obrigatório").max(200),
  unidade: z.string().trim().min(1, "Unidade obrigatória").max(10),
  categoria: z.string().trim().default("MAT"),
  estoque_min: z.coerce.number().min(0, "Estoque mínimo deve ser ≥ 0"),
});

export type ProdutoFormValues = z.infer<typeof produtoSchema>;

// SOLICITAÇÃO ITEM
export const solicitacaoItemSchema = z.object({
  material_id: z.string().uuid().nullable().optional(),
  produto_id: z.string().uuid().nullable().optional(),
  descricao_livre: z.string().trim().optional().or(z.literal("")),
  quantidade: z.coerce.number().min(0.001, "Quantidade deve ser maior que zero"),
  unidade: z.string().trim().min(1, "Unidade obrigatória"),
  etapa_id: z.string().uuid().nullable().optional(),
});

// SOLICITAÇÃO COMPRA
export const solicitacaoSchema = z.object({
  obra_id: z.string().uuid("Selecione uma obra"),
  urgente: z.boolean().default(false),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  itens: z.array(solicitacaoItemSchema).min(1, "Adicione pelo menos um item"),
});

export type SolicitacaoFormValues = z.infer<typeof solicitacaoSchema>;

// PEDIDO ITEM
export const pedidoItemSchema = z.object({
  material_id: z.string().uuid().nullable().optional(),
  produto_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(2, "Descrição obrigatória"),
  quantidade: z.coerce.number().min(0.001, "Quantidade deve ser maior que zero"),
  unidade: z.string().trim().min(1, "Unidade obrigatória"),
  valor_unit: z.coerce.number().min(0.01, "Valor unitário deve ser maior que zero"),
});

// PEDIDO COMPRA
export const pedidoSchema = z.object({
  fornecedor_id: z.string().uuid("Selecione um fornecedor"),
  data_entrega_prev: z.string().optional().or(z.literal("")),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
  itens: z.array(pedidoItemSchema).min(1, "Adicione pelo menos um item"),
});

export type PedidoFormValues = z.infer<typeof pedidoSchema>;

// ROW INTERFACES
export interface FornecedorRow {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  tipo: "pf" | "pj";
  email: string | null;
  telefone: string | null;
  avaliacao: number | null;
  ativo: boolean;
  created_at: string;
}

export interface ProdutoRow {
  id: string;
  sku: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  unidade: string;
  categoria: string;
  estoque_min: number;
  created_at: string;
}

export interface SolicitacaoCompraRow {
  id: string;
  obra_id: string;
  solicitante_id: string;
  status: "aberta" | "em_aprovacao" | "aprovada" | "reprovada" | "pedido_gerado";
  urgente: boolean;
  observacoes: string | null;
  reprovacao_motivo: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
}

export interface SolicitacaoItemRow {
  id: string;
  solicitacao_id: string;
  produto_id: string | null;
  material_id?: string | null;
  descricao_livre: string | null;
  quantidade: number;
  unidade: string;
  etapa_id: string | null;
}

export interface PedidoCompraRow {
  id: string;
  solicitacao_id: string | null;
  fornecedor_id: string;
  obra_id: string;
  status: "emitido" | "confirmado" | "entregue_parcial" | "entregue" | "cancelado";
  data_entrega_prev: string | null;
  observacoes: string | null;
  valor_total: number;
  created_at: string;
}

export interface PedidoItemRow {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  material_id?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unit: number;
  valor_total: number;
}
