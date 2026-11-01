import { z } from "zod";

export type EmpreiteiroStatusFilter = "todos" | "ativos" | "inativos";

export interface Empreiteiro {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  tipo: "pf" | "pj";
  email: string | null;
  telefone: string | null;
  classificacao: "fornecedor" | "terceirizado";
  especialidade: string | null;
  avaliacao: number | null;
  ativo: boolean;
  created_at?: string;
}

const optionalEmail = z
  .string()
  .trim()
  .refine((value) => value === "" || z.string().email().safeParse(value).success, {
    message: "Informe um e-mail válido",
  });

export const empreiteiroSchema = z
  .object({
    razao_social: z.string().trim().min(2, "Informe o nome ou a razão social"),
    nome_fantasia: z.string(),
    tipo: z.enum(["pf", "pj"]),
    cnpj: z.string(),
    cpf: z.string(),
    especialidade: z.string(),
    telefone: z.string(),
    email: optionalEmail,
    avaliacao: z.number().int().min(1).max(5).nullable(),
    ativo: z.boolean(),
  })
  .superRefine((values, context) => {
    const document = values.tipo === "pj" ? values.cnpj : values.cpf;
    const minimumDigits = values.tipo === "pj" ? 14 : 11;
    if (document.replace(/\D/g, "").length !== minimumDigits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [values.tipo === "pj" ? "cnpj" : "cpf"],
        message: values.tipo === "pj" ? "Informe um CNPJ válido" : "Informe um CPF válido",
      });
    }
  });

export type EmpreiteiroFormValues = z.infer<typeof empreiteiroSchema>;

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

export function criarEmpreiteiroPayload(values: EmpreiteiroFormValues) {
  return {
    razao_social: values.razao_social.trim(),
    nome_fantasia: optionalText(values.nome_fantasia),
    tipo: values.tipo,
    cnpj: values.tipo === "pj" ? optionalText(values.cnpj) : null,
    cpf: values.tipo === "pf" ? optionalText(values.cpf) : null,
    classificacao: "terceirizado" as const,
    especialidade: optionalText(values.especialidade),
    telefone: optionalText(values.telefone),
    email: optionalText(values.email),
    avaliacao: values.avaliacao,
    ativo: values.ativo,
  };
}

function searchableText(item: Empreiteiro) {
  const text = [item.razao_social, item.nome_fantasia, item.cnpj, item.cpf, item.especialidade]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
  const digits = `${item.cnpj ?? ""} ${item.cpf ?? ""}`.replace(/\D/g, "");
  return `${text} ${digits}`;
}

export function filtrarEmpreiteiros(
  items: Empreiteiro[],
  busca: string,
  status: EmpreiteiroStatusFilter,
) {
  const normalizedSearch = busca
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
  const searchDigits = busca.replace(/\D/g, "");

  return items.filter((item) => {
    if (status === "ativos" && !item.ativo) return false;
    if (status === "inativos" && item.ativo) return false;
    if (!normalizedSearch) return true;

    const haystack = searchableText(item);
    return (
      haystack.includes(normalizedSearch) || (!!searchDigits && haystack.includes(searchDigits))
    );
  });
}
