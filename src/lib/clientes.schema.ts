import { z } from "zod";
import { onlyDigits, validarCpfCnpj } from "./validacao-documento";

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export const tipoClienteEnum = z.enum(["pf", "pj"]);
export const statusClienteEnum = z.enum(["ativo", "inativo", "prospect"]);
export type StatusCliente = z.infer<typeof statusClienteEnum>;

export const clienteSchema = z.object({
  tipo: tipoClienteEnum,
  status: statusClienteEnum,
  nome: z.string().trim().min(2, "Nome obrigatório").max(200),
  nome_fantasia: z.string().trim().max(200).optional().or(z.literal("")),
  cpf_cnpj: z
    .string()
    .trim()
    .min(1, "Documento obrigatório")
    .refine(validarCpfCnpj, "CPF ou CNPJ inválido")
    .transform((v) => onlyDigits(v)),
  rg_ie: z.string().trim().max(30).optional().or(z.literal("")),
  data_nascimento: z.string().optional().or(z.literal("")),
  data_fundacao: z.string().optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  celular: z.string().trim().max(20).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  logradouro: z.string().trim().max(200).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(100).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.enum(UFS).optional().or(z.literal("")),
  inscricao_municipal: z.string().trim().max(50).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;

export const STATUS_LABEL: Record<z.infer<typeof statusClienteEnum>, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  prospect: "Prospect",
};

export const STATUS_BADGE: Record<z.infer<typeof statusClienteEnum>, string> = {
  ativo: "bg-green-600 text-white hover:bg-green-600",
  inativo: "bg-muted text-muted-foreground",
  prospect: "bg-blue-600 text-white hover:bg-blue-600",
};

// Oportunidades
export const statusOportunidadeEnum = z.enum([
  "novo","qualificacao","proposta","negociacao","ganho","perdido",
]);
export type StatusOportunidade = z.infer<typeof statusOportunidadeEnum>;

export const OPORT_STAGES: { key: StatusOportunidade; label: string }[] = [
  { key: "novo", label: "Novo" },
  { key: "qualificacao", label: "Qualificação" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
  { key: "perdido", label: "Perdido" },
];

export const oportunidadeSchema = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  titulo: z.string().trim().min(2, "Título obrigatório").max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  valor_estimado: z.coerce.number().min(0).optional().nullable(),
  status: statusOportunidadeEnum,
  probabilidade: z.coerce.number().min(0).max(100),
  data_prevista: z.string().optional().or(z.literal("")),
});
export type OportunidadeFormValues = z.infer<typeof oportunidadeSchema>;

// Propostas
export const statusPropostaEnum = z.enum([
  "rascunho","enviada","aceita","rejeitada","expirada",
]);
export type StatusProposta = z.infer<typeof statusPropostaEnum>;

export const STATUS_PROPOSTA_LABEL: Record<StatusProposta, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aceita: "Aceita",
  rejeitada: "Rejeitada",
  expirada: "Expirada",
};

export const STATUS_PROPOSTA_BADGE: Record<StatusProposta, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-600 text-white hover:bg-blue-600",
  aceita: "bg-green-600 text-white hover:bg-green-600",
  rejeitada: "bg-red-600 text-white hover:bg-red-600",
  expirada: "bg-amber-600 text-white hover:bg-amber-600",
};

export const propostaItemSchema = z.object({
  id: z.string().uuid().optional(),
  referencia_id: z.string().uuid().nullable().optional(),
  fonte_referencia: z.enum(["sinapi", "sicro"]).nullable().optional(),
  tipo_referencia: z.enum(["insumo", "composicao"]).nullable().optional(),
  codigo_referencia: z.string().trim().max(50).nullable().optional(),
  referencia_uf: z.string().trim().length(2).nullable().optional(),
  referencia_mes: z.string().trim().max(7).nullable().optional(),
  etapa_codigo: z.string().trim().max(30).nullable().optional(),
  etapa_nome: z.string().trim().max(200).nullable().optional(),
  item_codigo: z.string().trim().max(30).nullable().optional(),
  item_nome: z.string().trim().max(300).nullable().optional(),
  subitem_codigo: z.string().trim().max(30).nullable().optional(),
  unidade: z.string().trim().max(20).optional().or(z.literal("")),
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(500),
  quantidade: z.coerce.number().min(0.001, "Qtd > 0"),
  valor_unitario: z.coerce.number().min(0, "Valor ≥ 0"),
});
export type PropostaItemValues = z.infer<typeof propostaItemSchema>;

export const propostaSchema = z.object({
  cliente_id: z.string().uuid({ message: "Selecione um cliente" }),
  oportunidade_id: z.string().uuid().nullable().optional(),
  titulo: z.string().trim().min(2, "Título obrigatório").max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  status: statusPropostaEnum,
  validade: z.string().optional().or(z.literal("")),
  data_envio: z.string().optional().or(z.literal("")),
  condicoes_pagamento: z.string().trim().max(1000).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
  itens: z.array(propostaItemSchema).min(1, "Adicione ao menos 1 item"),
});
export type PropostaFormValues = z.infer<typeof propostaSchema>;

// Contratos
export const statusContratoEnum = z.enum(["ativo","concluido","cancelado","suspenso"]);
export type StatusContrato = z.infer<typeof statusContratoEnum>;

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  cancelado: "Cancelado",
  suspenso: "Suspenso",
};
export const STATUS_CONTRATO_BADGE: Record<StatusContrato, string> = {
  ativo: "bg-green-600 text-white hover:bg-green-600",
  concluido: "bg-blue-600 text-white hover:bg-blue-600",
  cancelado: "bg-red-600 text-white hover:bg-red-600",
  suspenso: "bg-amber-600 text-white hover:bg-amber-600",
};

export const contratoSchema = z.object({
  cliente_id: z.string().uuid({ message: "Selecione um cliente" }),
  proposta_id: z.string().uuid().nullable().optional(),
  titulo: z.string().trim().min(2, "Título obrigatório").max(200),
  objeto: z.string().trim().max(4000).optional().or(z.literal("")),
  valor_total: z.coerce.number().min(0, "Valor ≥ 0"),
  status: statusContratoEnum,
  data_inicio: z.string().optional().or(z.literal("")),
  data_fim: z.string().optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type ContratoFormValues = z.infer<typeof contratoSchema>;
