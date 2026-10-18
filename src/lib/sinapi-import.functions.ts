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

    // Converte MM/AAAA para YYYY-MM
    const [mes, ano] = mesReferencia.split("/");
    const apiMes = `${ano}-${mes}`;
    const baseUrl = "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Documents/busca";

    try {
      // 1. Fetch dos dados - Manter manual para evitar subrequests excessivas de redirect
      const fetchWithCookie = async (url: string) => {
        // Tenta buscar com cache e controle manual de redirect
        const response = await fetch(url, { redirect: 'manual' });
        if (response.status === 302) {
          // Se 302, captura o cookie e tenta novamente sem redirect
          const cookie = response.headers.get('set-cookie');
          return fetch(url, { headers: { Cookie: cookie || '' } }).then(r => r.json());
        }
        return response.json();
      };

      const [descricoes, analitico, precos] = await Promise.all([
        fetchWithCookie(`${baseUrl}/dados/${apiMes}/descricoes.json`),
        fetchWithCookie(`${baseUrl}/dados/${apiMes}/analitico.json`),
        fetchWithCookie(`${baseUrl}/dados/${apiMes}/${uf}.json`)
      ]);

      const insumosMap = new Map();
      descricoes.forEach((d: any) => insumosMap.set(String(d.c), d));

      const compositionCodes = new Set(analitico.map((a: any) => String(a.c)));

      const insumosBatch: any[] = [];
      const composicoesBatch: any[] = [];

      precos.forEach((p: any) => {
        const d = insumosMap.get(String(p.c));
        if (!d) return;

        if (compositionCodes.has(String(p.c))) {
          composicoesBatch.push({
            fonte,
            uf,
            mes_referencia: mesReferencia,
            codigo: String(p.c),
            descricao: d.d,
            unidade: d.u,
            custo_total: Math.round(p.sd * 100),
            custo_desonerado: Math.round(p.cd * 100),
          });
        } else {
          insumosBatch.push({
            fonte,
            uf,
            mes_referencia: mesReferencia,
            codigo: String(p.c),
            descricao: d.d,
            unidade: d.u,
            preco_mediano: Math.round(p.sd * 100),
            preco_desonerado: Math.round(p.cd * 100),
          });
        }
      });

      // 3. Upsert
      if (insumosBatch.length > 0) {
        const { error } = await supabase
          .from("referencia_insumos")
          .upsert(insumosBatch, { onConflict: "fonte,uf,mes_referencia,codigo" });
        if (error) throw error;
      }
      if (composicoesBatch.length > 0) {
        const { error } = await supabase
          .from("referencia_composicoes")
          .upsert(composicoesBatch, { onConflict: "fonte,uf,mes_referencia,codigo" });
        if (error) throw error;
      }

      return { success: true, insumos: insumosBatch.length, composicoes: composicoesBatch.length };
    } catch (e: any) {
      console.error("Erro na importação SINAPI:", e);
      throw new Error(`Falha: ${e.message}`);
    }
  });
