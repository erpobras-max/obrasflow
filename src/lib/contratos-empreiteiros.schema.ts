import { z } from "zod";

export const tipoContratoEmpreiteiroSchema = z.enum([
  "empreitada_global",
  "preco_unitario",
  "administracao",
  "mista",
]);
export type TipoContratoEmpreiteiro = z.infer<typeof tipoContratoEmpreiteiroSchema>;

export const statusContratoEmpreiteiroSchema = z.enum([
  "rascunho",
  "em_aprovacao",
  "aprovado",
  "em_execucao",
  "aditivado",
  "concluido",
  "distratado",
  "cancelado",
]);
export type StatusContratoEmpreiteiro = z.infer<typeof statusContratoEmpreiteiroSchema>;

export const statusMedicaoEmpreiteiroSchema = z.enum([
  "rascunho",
  "enviada",
  "aprovada",
  "rejeitada",
  "paga",
  "cancelada",
]);
export type StatusMedicaoEmpreiteiro = z.infer<typeof statusMedicaoEmpreiteiroSchema>;

export const tipoAjusteMedicaoSchema = z.enum([
  "desconto",
  "adiantamento",
  "retencao_tecnica",
  "tributo",
  "outro",
]);
export type TipoAjusteMedicao = z.infer<typeof tipoAjusteMedicaoSchema>;

export const modoEntradaMedicaoSchema = z.enum([
  "quantidade",
  "percentual",
  "valor",
]);
export type ModoEntradaMedicao = z.infer<typeof modoEntradaMedicaoSchema>;

export const contratoItemSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().max(50).nullable().optional(),
  descricao: z.string().min(1, "A descrição do item é obrigatória").max(500),
  unidade: z.string().min(1, "A unidade é obrigatória").max(20),
  etapa: z.string().max(100).nullable().optional(),
  quantidadeContratada: z.number().positive("Quantidade contratada deve ser maior que zero"),
  precoUnitarioCentavos: z.number().int().nonnegative("Preço unitário não pode ser negativo"),
  origemOrcamentoId: z.string().uuid().nullable().optional(),
  origemAtividadeId: z.string().uuid().nullable().optional(),
  origemTipo: z.string().max(50).nullable().optional(),
  ordem: z.number().int().nonnegative().default(0),
});
export type ContratoItem = z.infer<typeof contratoItemSchema>;

export const contratoEmpreiteiroFormSchema = z.object({
  id: z.string().uuid().optional(),
  obraId: z.string().uuid("Selecione uma obra"),
  fornecedorId: z.string().uuid("Selecione um empreiteiro / fornecedor"),
  numero: z.string().min(1, "O número do contrato é obrigatório").max(50),
  tipo: tipoContratoEmpreiteiroSchema.default("preco_unitario"),
  objeto: z.string().min(1, "O objeto do contrato é obrigatório").max(500),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
  percentualRetencaoTecnicaPadrao: z.number().min(0).max(100).default(0),
  condicoesPagamento: z.string().max(1000).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  itens: z.array(contratoItemSchema).min(1, "O contrato deve conter pelo menos um item"),
});
export type ContratoEmpreiteiroFormData = z.infer<typeof contratoEmpreiteiroFormSchema>;

export const medicaoItemEntradaSchema = z.object({
  servicoTerceirizadoId: z.string().uuid(),
  modoEntrada: modoEntradaMedicaoSchema.default("quantidade"),
  quantidadeAtual: z.number().min(0),
  percentualAtual: z.number().min(0).max(100),
  valorAtualCentavos: z.number().int().min(0),
  observacoes: z.string().max(1000).nullable().optional(),
});
export type MedicaoItemEntrada = z.infer<typeof medicaoItemEntradaSchema>;

export const medicaoAjusteSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: tipoAjusteMedicaoSchema,
  descricao: z.string().min(1, "Descrição do ajuste é obrigatória").max(255),
  percentual: z.number().min(0).max(100).nullable().optional(),
  baseCalculoCentavos: z.number().int().min(0).nullable().optional(),
  valorCentavos: z.number().int().min(0, "Valor do ajuste não pode ser negativo"),
  observacoes: z.string().max(1000).nullable().optional(),
});
export type MedicaoAjuste = z.infer<typeof medicaoAjusteSchema>;

export const medicaoEmpreiteiroFormSchema = z.object({
  id: z.string().uuid().optional(),
  contratoEmpreiteiroId: z.string().uuid(),
  numero: z.number().int().positive(),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
  dataVencimentoPrevista: z.string().min(1, "Data de vencimento é obrigatória"),
  observacoes: z.string().max(2000).nullable().optional(),
  itens: z.array(medicaoItemEntradaSchema).min(1, "A medição deve ter itens"),
  ajustes: z.array(medicaoAjusteSchema).default([]),
});
export type MedicaoEmpreiteiroFormData = z.infer<typeof medicaoEmpreiteiroFormSchema>;

