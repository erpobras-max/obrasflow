import { z } from "zod";
import { onlyDigits, validarCpfCnpj } from "./validacao-documento";
import { UFS } from "./clientes.schema";

// Clientes Imobiliários
export const tipoClienteEnum = z.enum(["pf", "pj"]);
export const statusClienteEnum = z.enum(["ativo", "inativo"]);

export const imobiliariaClienteSchema = z.object({
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
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  celular: z.string().trim().max(20).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  logradouro: z.string().trim().max(200).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(100).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.enum(UFS).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ImobiliariaClienteFormValues = z.infer<typeof imobiliariaClienteSchema>;

export const STATUS_CLIENTE_LABEL: Record<z.infer<typeof statusClienteEnum>, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

export const STATUS_CLIENTE_BADGE: Record<z.infer<typeof statusClienteEnum>, string> = {
  ativo: "bg-green-600 text-white hover:bg-green-600",
  inativo: "bg-muted text-muted-foreground",
};

// Imóveis
export const tipoImovelEnum = z.enum(["apartamento", "casa", "comercial", "terreno"]);
export const statusImovelEnum = z.enum(["disponivel", "alugado", "vendido", "inativo"]);

export type TipoImovel = z.infer<typeof tipoImovelEnum>;
export type StatusImovel = z.infer<typeof statusImovelEnum>;

export const TIPO_IMOVEL_LABEL: Record<TipoImovel, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
};

export const STATUS_IMOVEL_LABEL: Record<StatusImovel, string> = {
  disponivel: "Disponível",
  alugado: "Alugado",
  vendido: "Vendido",
  inativo: "Inativo",
};

export const STATUS_IMOVEL_BADGE: Record<StatusImovel, string> = {
  disponivel: "bg-green-600 text-white hover:bg-green-600",
  alugado: "bg-blue-600 text-white hover:bg-blue-600",
  vendido: "bg-purple-600 text-white hover:bg-purple-600",
  inativo: "bg-muted text-muted-foreground",
};

export const imovelSchema = z.object({
  codigo: z.string().trim().min(2, "Código obrigatório").max(50),
  titulo: z.string().trim().min(3, "Título obrigatório").max(200),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
  tipo: tipoImovelEnum,
  status: statusImovelEnum,
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  logradouro: z.string().trim().max(200).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  complemento: z.string().trim().max(100).optional().or(z.literal("")),
  bairro: z.string().trim().max(100).optional().or(z.literal("")),
  cidade: z.string().trim().max(100).optional().or(z.literal("")),
  uf: z.enum(UFS).optional().or(z.literal("")),
  quartos: z.coerce.number().min(0, "Quartos inválidos").default(0),
  banheiros: z.coerce.number().min(0, "Banheiros inválidos").default(0),
  suites: z.coerce.number().min(0, "Suítes inválidas").default(0),
  vagas: z.coerce.number().min(0, "Vagas inválidas").default(0),
  area_privativa: z.coerce.number().min(0, "Área inválida").optional().nullable(),
  area_total: z.coerce.number().min(0, "Área inválida").optional().nullable(),
  valor_locacao: z.coerce.number().min(0, "Valor inválido").optional().nullable(),
  valor_venda: z.coerce.number().min(0, "Valor inválido").optional().nullable(),
  valor_condominio: z.coerce.number().min(0, "Valor inválido").optional().nullable(),
  valor_iptu: z.coerce.number().min(0, "Valor inválido").optional().nullable(),
  proprietario_id: z.string().uuid("Selecione o proprietário"),
  foto_url: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ImovelFormValues = z.infer<typeof imovelSchema>;

// Locações
export const garantiaLocacaoEnum = z.enum(["caucao", "fiador", "seguro_fianca", "sem_garantia"]);
export const statusLocacaoEnum = z.enum(["ativo", "finalizado", "rescindido"]);

export type GarantiaLocacao = z.infer<typeof garantiaLocacaoEnum>;
export type StatusLocacao = z.infer<typeof statusLocacaoEnum>;

export const GARANTIA_LOCACAO_LABEL: Record<GarantiaLocacao, string> = {
  caucao: "Caução",
  fiador: "Fiador",
  seguro_fianca: "Seguro Fiança",
  sem_garantia: "Sem Garantia",
};

export const STATUS_LOCACAO_LABEL: Record<StatusLocacao, string> = {
  ativo: "Ativo",
  finalizado: "Finalizado",
  rescindido: "Rescindido",
};

export const STATUS_LOCACAO_BADGE: Record<StatusLocacao, string> = {
  ativo: "bg-green-600 text-white hover:bg-green-600",
  finalizado: "bg-blue-600 text-white hover:bg-blue-600",
  rescindido: "bg-red-600 text-white hover:bg-red-600",
};

export const locacaoSchema = z.object({
  contrato_numero: z.string().trim().min(2, "Contrato obrigatório").max(50),
  imovel_id: z.string().uuid("Selecione o imóvel"),
  locatario_id: z.string().uuid("Selecione o locatário/inquilino"),
  data_inicio: z.string().min(1, "Data de início obrigatória"),
  data_fim: z.string().optional().or(z.literal("")),
  dia_vencimento: z.coerce.number().min(1, "Dia mínimo: 1").max(31, "Dia máximo: 31"),
  valor_aluguel: z.coerce.number().min(0.01, "Valor do aluguel obrigatório"),
  taxa_administracao_percentual: z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%").default(0),
  garantia_tipo: garantiaLocacaoEnum,
  garantia_valor: z.coerce.number().min(0, "Valor inválido").optional().nullable(),
  fiador_id: z.string().uuid("Selecione o fiador").optional().nullable(),
  tipo_contrato: z.enum(["inicial", "renovacao", "rescisao"]).default("inicial"),
  indice_reajuste: z.enum(["ipca", "igp_m", "inpc", "manual"]).default("manual"),
  status: statusLocacaoEnum,
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type LocacaoFormValues = z.infer<typeof locacaoSchema>;
