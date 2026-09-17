import { z } from "zod";

export const CATEGORIAS_DOCUMENTO = [
  "CONTRATO",
  "ART",
  "PROJETO",
  "LICENCA",
  "CERTIDAO",
  "FISCAL",
  "OUTRO",
] as const;

export type CategoriaDocumento = typeof CATEGORIAS_DOCUMENTO[number];

export const CATEGORIA_LABELS: Record<CategoriaDocumento, string> = {
  CONTRATO: "Contrato",
  ART: "ART",
  PROJETO: "Projeto",
  LICENCA: "Licença",
  CERTIDAO: "Certidão",
  FISCAL: "Fiscal",
  OUTRO: "Outro",
};

export const documentUploadSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(200),
  categoria: z.enum(CATEGORIAS_DOCUMENTO, {
    errorMap: () => ({ message: "Selecione uma categoria válida" }),
  }),
  obra_id: z.string().uuid().nullable().optional(),
  versao: z.coerce.number().int().min(1, "Versão mínima é 1"),
});

export type DocumentUploadFormValues = z.infer<typeof documentUploadSchema>;

export interface DocumentRow {
  id: string;
  nome: string;
  categoria: CategoriaDocumento;
  obra_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
  versao: number;
  bucket_path: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
}
