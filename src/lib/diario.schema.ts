import { z } from "zod";

export const CLIMAS = ["ensolarado","nublado","chuvoso","parcialmente_nublado","tempestade"] as const;
export const CLIMA_LABEL: Record<(typeof CLIMAS)[number], string> = {
  ensolarado: "Ensolarado",
  nublado: "Nublado",
  chuvoso: "Chuvoso",
  parcialmente_nublado: "Parcialmente nublado",
  tempestade: "Tempestade",
};

export const efetivoItemSchema = z.object({
  funcao: z.string().trim().min(1, "Função obrigatória").max(80),
  quantidade: z.coerce.number().int().min(1, "≥ 1").max(999),
});

export const diarioSchema = z.object({
  obra_id: z.string().uuid({ message: "Selecione uma obra" }),
  data: z.string().min(1, "Data obrigatória"),
  clima: z.enum(CLIMAS).optional().or(z.literal("")),
  temperatura: z.coerce.number().min(-20).max(60).optional().or(z.literal("" as any)),
  efetivo: z.array(efetivoItemSchema),
  atividades: z.string().trim().max(4000).optional().or(z.literal("")),
  ocorrencias: z.string().trim().max(4000).optional().or(z.literal("")),
  observacoes: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type DiarioFormValues = z.infer<typeof diarioSchema>;
export type EfetivoItem = z.infer<typeof efetivoItemSchema>;
