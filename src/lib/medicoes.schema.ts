import { z } from "zod";

export const statusMedicaoEnum = z.enum(["rascunho","aprovada","faturada","cancelada"]);
export type StatusMedicao = z.infer<typeof statusMedicaoEnum>;

export const STATUS_MEDICAO_LABEL: Record<StatusMedicao, string> = {
  rascunho: "Rascunho",
  aprovada: "Aprovada",
  faturada: "Faturada",
  cancelada: "Cancelada",
};
export const STATUS_MEDICAO_BADGE: Record<StatusMedicao, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aprovada: "bg-blue-600 text-white hover:bg-blue-600",
  faturada: "bg-green-600 text-white hover:bg-green-600",
  cancelada: "bg-red-600 text-white hover:bg-red-600",
};

export const medicaoItemSchema = z.object({
  referencia_id: z.string().uuid().nullable().optional(),
  fonte_referencia: z.enum(["sinapi", "sicro"]).nullable().optional(),
  tipo_referencia: z.enum(["insumo", "composicao"]).nullable().optional(),
  codigo_referencia: z.string().trim().max(50).nullable().optional(),
  referencia_uf: z.string().trim().length(2).nullable().optional(),
  referencia_mes: z.string().trim().max(7).nullable().optional(),
  proposta_item_id: z.string().uuid().nullable().optional(),
  etapa_codigo: z.string().nullable().optional(), etapa_nome: z.string().nullable().optional(),
  item_codigo: z.string().nullable().optional(), item_nome: z.string().nullable().optional(),
  subitem_codigo: z.string().nullable().optional(),
  percentual_executado: z.coerce.number().min(0).max(100).default(0),
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(300),
  unidade: z.string().trim().max(20).optional().or(z.literal("")),
  qtd_contratada: z.coerce.number().min(0),
  qtd_executada: z.coerce.number().min(0),
  valor_unitario: z.coerce.number().min(0),
});

export const medicaoSchema = z.object({
  obra_id: z.string().uuid({ message: "Selecione uma obra" }),
  contrato_id: z.string().uuid().nullable().optional(),
  periodo_inicio: z.string().min(1, "Início obrigatório"),
  periodo_fim: z.string().min(1, "Fim obrigatório"),
  percentual_total: z.coerce.number().min(0).max(100),
  status: statusMedicaoEnum,
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  itens: z.array(medicaoItemSchema).min(1, "Adicione pelo menos 1 item"),
});
export type MedicaoFormValues = z.infer<typeof medicaoSchema>;
