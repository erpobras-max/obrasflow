import { z } from "zod";
import { UFS } from "./clientes.schema";

export const statusObraEnum = z.enum([
  "planejamento","em_andamento","pausada","concluida","cancelada",
]);
export type StatusObra = z.infer<typeof statusObraEnum>;

export const STATUS_OBRA_LABEL: Record<StatusObra, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const STATUS_OBRA_BADGE: Record<StatusObra, string> = {
  planejamento: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-600 text-white hover:bg-blue-600",
  pausada: "bg-amber-600 text-white hover:bg-amber-600",
  concluida: "bg-green-600 text-white hover:bg-green-600",
  cancelada: "bg-red-600 text-white hover:bg-red-600",
};

export const obraSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  cliente_id: z.string().uuid({ message: "Selecione um cliente" }),
  contrato_id: z.string().uuid().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  status: statusObraEnum,
  orcamento: z.coerce.number().min(0, "Orçamento ≥ 0"),
  valor_executado: z.coerce.number().min(0),
  progresso: z.coerce.number().int().min(0).max(100),
  data_inicio_prevista: z.string().optional().or(z.literal("")),
  data_fim_prevista: z.string().optional().or(z.literal("")),
  data_inicio_real: z.string().optional().or(z.literal("")),
  data_fim_real: z.string().optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  logradouro: z.string().trim().max(200).optional().or(z.literal("")),
  numero_endereco: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(100).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.enum(UFS).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ObraFormValues = z.infer<typeof obraSchema>;
