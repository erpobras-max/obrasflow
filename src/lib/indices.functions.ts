import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

const SERIES = {
  ipca: 433,
  igp_m: 189,
  inpc: 188,
} as const;

type IndiceTipo = keyof typeof SERIES;
type BcbValue = { data: string; valor: string };

async function requireIndiceAccess(context: {
  supabase: Pick<SupabaseClient, "from">;
  userId: string;
}) {
  const { data: profile } = await context.supabase
    .from("perfis_usuarios")
    .select("perfil,ativo")
    .eq("user_id", context.userId)
    .maybeSingle();
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const roles = new Set<string>(
    [profile?.perfil, ...(roleRows ?? []).map((row: { role: string }) => row.role)].filter(Boolean),
  );

  if (
    !profile?.ativo ||
    !["admin", "diretor", "financeiro_imobiliaria", "imobiliaria"].some((role) => roles.has(role))
  ) {
    throw new Error("Você não tem permissão para atualizar os índices imobiliários.");
  }
}

function parseBcbDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) throw new Error(`Data inválida recebida do BCB: ${value}`);
  return { day, month, year, time: Date.UTC(year, month - 1, day) };
}

async function fetchSerie(tipo: IndiceTipo) {
  const response = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES[tipo]}/dados/ultimos/12?formato=json`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`${tipo.toUpperCase()}: BCB respondeu ${response.status}`);

  const values = (await response.json()) as BcbValue[];
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${tipo.toUpperCase()}: série sem dados`);
  }

  const ordered = values
    .map((item) => ({
      ...item,
      parsed: parseBcbDate(item.data),
      number: Number(item.valor.replace(",", ".")),
    }))
    .filter((item) => Number.isFinite(item.number))
    .sort((a, b) => a.parsed.time - b.parsed.time);
  if (ordered.length === 0) throw new Error(`${tipo.toUpperCase()}: valores inválidos`);

  const latest = ordered[ordered.length - 1];
  const accumulated = ordered.reduce((factor, item) => factor * (1 + item.number / 100), 1);
  return {
    indice_tipo: tipo,
    periodo_ano: latest.parsed.year,
    periodo_mes: latest.parsed.month,
    valor_indice: latest.number,
    variacao_percentual: latest.number,
    acumulado_12m: Math.round((accumulated - 1) * 10000) / 100,
    fonte: `Banco Central do Brasil - SGS ${SERIES[tipo]}`,
    atualizado_em: new Date().toISOString(),
  };
}

export const atualizarIndicesBcb = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ force: z.boolean().default(false) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireIndiceAccess(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");

    if (!data.force) {
      const { data: current } = await supabaseAdmin
        .from("imob_indices_reajuste")
        .select("indice_tipo,atualizado_em")
        .in("indice_tipo", Object.keys(SERIES))
        .order("atualizado_em", { ascending: false });
      const latestByType = new Map<string, string>();
      for (const row of current ?? []) {
        if (!latestByType.has(row.indice_tipo)) {
          latestByType.set(row.indice_tipo, row.atualizado_em);
        }
      }
      const freshAfter = Date.now() - 24 * 60 * 60 * 1000;
      const allFresh = Object.keys(SERIES).every((tipo) => {
        const updatedAt = latestByType.get(tipo);
        return updatedAt && new Date(updatedAt).getTime() >= freshAfter;
      });
      if (allFresh) return { updated: 0, skipped: true, errors: [] as string[] };
    }

    const results = await Promise.allSettled(
      (Object.keys(SERIES) as IndiceTipo[]).map((tipo) => fetchSerie(tipo)),
    );
    let updated = 0;
    const errors: string[] = [];

    for (const result of results) {
      if (result.status === "rejected") {
        errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
        continue;
      }
      const { error } = await supabaseAdmin
        .from("imob_indices_reajuste")
        .upsert(result.value, { onConflict: "indice_tipo,periodo_ano,periodo_mes" });
      if (error) errors.push(`${result.value.indice_tipo.toUpperCase()}: ${error.message}`);
      else updated += 1;
    }

    if (updated === 0 && errors.length > 0) throw new Error(errors.join("; "));
    return { updated, skipped: false, errors };
  });
