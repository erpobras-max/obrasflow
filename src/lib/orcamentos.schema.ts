import { z } from "zod";

export const orcamentoItemSchema = z.object({
  codigo: z.string().trim().optional().or(z.literal("")),
  descricao: z.string().trim().min(2, "Descrição é obrigatória"),
  unidade: z.string().trim().min(1, "Unidade é obrigatória").max(10),
  quantidade: z.coerce.number().min(0.0001, "A quantidade deve ser maior que zero"),
  valor_unitario: z.coerce.number().min(0, "O valor unitário não pode ser negativo"),
  fonte_referencia: z.enum(["sinapi", "sicro", "proprio"]).default("proprio"),
  referencia_id: z.string().uuid().nullable().optional(),
  tipo_referencia: z.enum(["insumo", "composicao"]).nullable().optional(),
  referencia_uf: z.string().trim().length(2).nullable().optional(),
  referencia_mes: z.string().trim().max(7).nullable().optional(),
  etapa: z.string().trim().min(1, "A etapa/fase é obrigatória"),
});

export type OrcamentoItemFormValues = z.infer<typeof orcamentoItemSchema>;

export interface ReferenciaInsumoRow {
  id: string;
  fonte: "sinapi" | "sicro";
  uf: string;
  mes_referencia: string;
  codigo: string;
  descricao: string;
  unidade: string;
  preco_mediano: number; // in centavos
  created_at: string;
  updated_at: string;
}

export interface ReferenciaComposicaoRow {
  id: string;
  fonte: "sinapi" | "sicro";
  uf: string;
  mes_referencia: string;
  codigo: string;
  descricao: string;
  unidade: string;
  custo_total: number; // in centavos
  tipo_classe: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoRow {
  id: string;
  obra_id: string;
  total_estimado: number; // in centavos
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItemRow {
  id: string;
  orcamento_id: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number; // in centavos
  valor_total: number; // in centavos
  fonte_referencia: string;
  referencia_id?: string | null;
  tipo_referencia?: "insumo" | "composicao" | null;
  referencia_uf?: string | null;
  referencia_mes?: string | null;
  etapa: string;
  created_at: string;
  updated_at: string;
}
