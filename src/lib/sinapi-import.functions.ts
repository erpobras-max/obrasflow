import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

const importSinapiSchema = z.object({
  fonte: z.enum(["sinapi", "sicro"]),
  uf: z.string().length(2),
  mesReferencia: z.string().regex(/^\d{2}\/\d{4}$/), // MM/AAAA
});

export const importarSINAPI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSinapiSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { fonte, uf, mesReferencia } = data;

    // Converte MM/AAAA para YYYY-MM para a API da Caixa
    const [mes, ano] = mesReferencia.split("/");
    const apiMes = `${ano}-${mes}`;

    // Lógica principal de importação:
    // 1. Warm up cookie com https://www.caixa.gov.br/... (usando o cookie jar conforme descoberto)
    // 2. Fetch JSON:
    //    - .../dados/${apiMes}/descricoes.json (para descrição/unidade)
    //    - .../dados/${apiMes}/${uf}.json (para sd/cd)
    //    - .../dados/${apiMes}/analitico.json (para identificar composicoes vs insumos e material)

    // 3. Processar lotes (500) e upsert na tabela correta (referencia_insumos/composicoes)
    //    - sd -> preco_mediano (insumo) ou custo_total (composicao)
    //    - cd -> preco_desonerado (insumo) ou custo_desonerado (composicao)

    return { success: true, message: "Implementação em andamento" };
  });
