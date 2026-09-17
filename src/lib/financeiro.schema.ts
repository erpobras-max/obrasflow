import { z } from "zod";

export const statusReceberEnum = z.enum(["aberta", "recebida", "atrasada", "cancelada"]);
export type StatusReceber = z.infer<typeof statusReceberEnum>;

export const statusPagarEnum = z.enum(["aberta", "paga", "atrasada", "cancelada"]);
export type StatusPagar = z.infer<typeof statusPagarEnum>;

export const STATUS_RECEBER_LABEL: Record<StatusReceber, string> = {
  aberta: "Aberta",
  recebida: "Recebida",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const STATUS_RECEBER_BADGE: Record<StatusReceber, string> = {
  aberta: "bg-blue-600 text-white hover:bg-blue-600/85",
  recebida: "bg-green-600 text-white hover:bg-green-600/85",
  atrasada: "bg-red-600 text-white hover:bg-red-600/85",
  cancelada: "bg-muted text-muted-foreground",
};

export const STATUS_PAGAR_LABEL: Record<StatusPagar, string> = {
  aberta: "Aberta",
  paga: "Paga",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const STATUS_PAGAR_BADGE: Record<StatusPagar, string> = {
  aberta: "bg-blue-600 text-white hover:bg-blue-600/85",
  paga: "bg-green-600 text-white hover:bg-green-600/85",
  atrasada: "bg-red-600 text-white hover:bg-red-600/85",
  cancelada: "bg-muted text-muted-foreground",
};

export const contasReceberSchema = z.object({
  obra_id: z.string().uuid().nullable().optional().or(z.literal("")),
  cliente_id: z.string().uuid().nullable().optional().or(z.literal("")),
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(300),
  valor_total: z.coerce.number().positive("Valor deve ser maior que zero"),
  data_vencimento: z.string().min(1, "Vencimento obrigatório"),
  status: statusReceberEnum.default("aberta"),
  data_recebimento: z.string().optional().or(z.literal("")),
  valor_recebido: z.coerce.number().min(0).optional().nullable(),
  nota_fiscal_url: z.string().optional().nullable().or(z.literal("")),
  comprovante_url: z.string().optional().nullable().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  conta_bancaria_id: z.string().uuid().nullable().optional().or(z.literal("")),
  categoria_dre_id: z.string().uuid().nullable().optional().or(z.literal("")),
  numero_documento: z.string().trim().max(100).optional().or(z.literal("")),
});
export type ContasReceberFormValues = z.infer<typeof contasReceberSchema>;

export const contasPagarSchema = z.object({
  obra_id: z.string().uuid().nullable().optional().or(z.literal("")),
  fornecedor_id: z.string().uuid().nullable().optional().or(z.literal("")),
  pedido_id: z.string().uuid().nullable().optional().or(z.literal("")),
  descricao: z.string().trim().min(2, "Descrição obrigatória").max(300),
  valor_total: z.coerce.number().positive("Valor deve ser maior que zero"),
  data_vencimento: z.string().min(1, "Vencimento obrigatório"),
  status: statusPagarEnum.default("aberta"),
  data_pagamento: z.string().optional().or(z.literal("")),
  valor_pago: z.coerce.number().min(0).optional().nullable(),
  nota_fiscal_url: z.string().optional().nullable().or(z.literal("")),
  comprovante_url: z.string().optional().nullable().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  conta_bancaria_id: z.string().uuid().nullable().optional().or(z.literal("")),
  categoria_dre_id: z.string().uuid().nullable().optional().or(z.literal("")),
  numero_documento: z.string().trim().max(100).optional().or(z.literal("")),
});
export type ContasPagarFormValues = z.infer<typeof contasPagarSchema>;
