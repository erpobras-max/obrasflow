import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const mesSchema = z.object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
const ajusteSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora_entrada: timeSchema,
  hora_saida_almoco: timeSchema,
  hora_retorno_almoco: timeSchema,
  hora_saida: timeSchema,
  motivo: z.string().trim().min(5).max(1000),
});
const marcacaoSchema = z.object({
  tipo: z.enum(["entrada", "saida_almoco", "retorno_almoco", "saida"]),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  precisao: z.number().finite().nonnegative().nullable(),
  dispositivo: z.object({
    navegador: z.string().max(500),
    plataforma: z.string().max(100),
    idioma: z.string().max(30),
  }),
});

async function requireFuncionario() {
  const { getPontoFuncionario } = await import("./ponto-session.server");
  const access = await getPontoFuncionario();
  if (!access) throw new Error("Acesso ao ponto expirado. Entre novamente com CPF.");
  return access;
}

export const obterFuncionarioPontoCpf = createServerFn({ method: "POST" }).handler(async () => {
  const { getPontoFuncionario } = await import("./ponto-session.server");
  const access = await getPontoFuncionario();
  return access?.funcionario ?? null;
});

export const obterRegistrosPontoCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mesSchema.parse(input))
  .handler(async ({ data }) => {
    const { funcionario, supabaseAdmin } = await requireFuncionario();
    const primeiroDia = `${data.mes}-01`;
    const ultimoDia = new Date(Date.UTC(Number(data.mes.slice(0, 4)), Number(data.mes.slice(5)), 0))
      .toISOString()
      .slice(0, 10);
    const { data: registros, error } = await supabaseAdmin
      .from("registros_ponto")
      .select(
        "id,data,hora_entrada,hora_saida_almoco,hora_retorno_almoco,hora_saida,horas_trabalhadas,tipo_dia,observacoes,entrada_localizacao,saida_almoco_localizacao,retorno_almoco_localizacao,saida_localizacao",
      )
      .eq("funcionario_id", funcionario.id)
      .gte("data", primeiroDia)
      .lte("data", ultimoDia)
      .order("data", { ascending: false });
    if (error) throw error;
    return registros ?? [];
  });

export const obterAjustesPontoCpf = createServerFn({ method: "POST" }).handler(async () => {
  const { funcionario, supabaseAdmin } = await requireFuncionario();
  const { data, error } = await supabaseAdmin
    .from("solicitacoes_ajuste_ponto")
    .select(
      "id,data,hora_entrada,hora_saida_almoco,hora_retorno_almoco,hora_saida,motivo,status,resposta,created_at",
    )
    .eq("funcionario_id", funcionario.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const registrarPontoCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => marcacaoSchema.parse(input))
  .handler(async ({ data }) => {
    const { funcionario, supabaseAdmin } = await requireFuncionario();
    const { error } = await supabaseAdmin.rpc("registrar_ponto_por_cpf", {
      p_funcionario_id: funcionario.id,
      p_tipo: data.tipo,
      p_latitude: data.latitude,
      p_longitude: data.longitude,
      p_precisao: data.precisao,
      p_dispositivo: data.dispositivo,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const solicitarAjustePontoCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ajusteSchema.parse(input))
  .handler(async ({ data }) => {
    const { funcionario, supabaseAdmin } = await requireFuncionario();
    const { data: registro, error: readError } = await supabaseAdmin
      .from("registros_ponto")
      .select("id")
      .eq("funcionario_id", funcionario.id)
      .eq("data", data.data)
      .maybeSingle();
    if (readError) throw readError;
    const { error } = await supabaseAdmin.from("solicitacoes_ajuste_ponto").insert({
      funcionario_id: funcionario.id,
      registro_ponto_id: registro?.id ?? null,
      ...data,
      solicitado_por: null,
      solicitado_via_cpf: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const obterObrasPonto = createServerFn({ method: "POST" }).handler(async () => {
  const { getPontoFuncionario } = await import("./ponto-session.server");
  const access = await getPontoFuncionario();
  // Se logado via CPF ou se chamado via SSR
  let supabaseClient = access?.supabaseAdmin;
  if (!supabaseClient) {
    const { createSupabaseAdminClient } = await import("@/integrations/supabase/client.server.custom");
    supabaseClient = createSupabaseAdminClient();
  }
  const { data, error } = await supabaseClient
    .from("obras")
    .select("id, numero, nome")
    .order("nome");
  if (error) return [];
  return data ?? [];
});

export const obterEquipePonto = createServerFn({ method: "POST" }).handler(async () => {
  const { getPontoFuncionario } = await import("./ponto-session.server");
  const access = await getPontoFuncionario();
  let supabaseClient = access?.supabaseAdmin;
  if (!supabaseClient) {
    const { createSupabaseAdminClient } = await import("@/integrations/supabase/client.server.custom");
    supabaseClient = createSupabaseAdminClient();
  }
  const { data, error } = await supabaseClient
    .from("funcionarios")
    .select("id, nome, cargo, matricula, obra_id")
    .eq("status", "ativo")
    .order("nome");
  if (error) return [];
  return data ?? [];
});

const equipeMarcacaoSchema = z.object({
  funcionarioId: z.string().uuid(),
  tipo: z.enum(["entrada", "saida_almoco", "retorno_almoco", "saida"]),
  obraId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  precisao: z.number().finite().nonnegative().nullable(),
  dispositivo: z.object({
    navegador: z.string().max(500),
    plataforma: z.string().max(100),
    idioma: z.string().max(30),
    registrado_por_mestre: z.boolean().optional(),
  }),
});

export const registrarPontoEquipeCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => equipeMarcacaoSchema.parse(input))
  .handler(async ({ data }) => {
    const { funcionario, supabaseAdmin } = await requireFuncionario();
    const cargo = (funcionario.cargo || "").toLowerCase();
    if (!cargo.includes("mestre") && !cargo.includes("encarregado")) {
      throw new Error("Apenas o Mestre de Obras ou Encarregado pode bater ponto da equipe.");
    }
    const { error } = await supabaseAdmin.rpc("registrar_ponto_equipe", {
      p_funcionario_id: data.funcionarioId,
      p_tipo: data.tipo,
      p_obra_id: data.obraId,
      p_latitude: data.latitude,
      p_longitude: data.longitude,
      p_precisao: data.precisao,
      p_dispositivo: data.dispositivo,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const loteMarcacaoSchema = z.object({
  funcionarioIds: z.array(z.string().uuid()),
  tipo: z.enum(["entrada", "saida_almoco", "retorno_almoco", "saida"]),
  obraId: z.string().uuid(),
  latitude: z.number().finite().min(-90).max(90).nullable(),
  longitude: z.number().finite().min(-180).max(180).nullable(),
  precisao: z.number().finite().nonnegative().nullable(),
  dispositivo: z.object({
    navegador: z.string().max(500),
    plataforma: z.string().max(100),
    idioma: z.string().max(30),
    registrado_por_mestre: z.boolean().optional(),
    em_lote: z.boolean().optional(),
  }),
});

export const registrarPontoEmLoteCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loteMarcacaoSchema.parse(input))
  .handler(async ({ data }) => {
    const { funcionario, supabaseAdmin } = await requireFuncionario();
    const cargo = (funcionario.cargo || "").toLowerCase();
    if (!cargo.includes("mestre") && !cargo.includes("encarregado")) {
      throw new Error("Apenas o Mestre de Obras ou Encarregado pode bater ponto em lote da equipe.");
    }

    let sucessos = 0;
    const erros: string[] = [];

    for (const funcId of data.funcionarioIds) {
      try {
        const { error } = await supabaseAdmin.rpc("registrar_ponto_equipe", {
          p_funcionario_id: funcId,
          p_tipo: data.tipo,
          p_obra_id: data.obraId,
          p_latitude: data.latitude,
          p_longitude: data.longitude,
          p_precisao: data.precisao,
          p_dispositivo: { ...data.dispositivo, em_lote: true },
        });
        if (error) {
          erros.push(error.message);
        } else {
          sucessos++;
        }
      } catch (err: any) {
        erros.push(err.message);
      }
    }

    return { ok: true as const, sucessos, erros };
  });

export const obterRegistrosEquipeHojeServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { getPontoFuncionario } = await import("./ponto-session.server");
    const access = await getPontoFuncionario();
    let supabaseClient = access?.supabaseAdmin;
    if (!supabaseClient) {
      const { createSupabaseAdminClient } = await import("@/integrations/supabase/client.server.custom");
      supabaseClient = createSupabaseAdminClient();
    }
    const { data: registros, error } = await supabaseClient
      .from("registros_ponto")
      .select("*")
      .eq("data", data.data);
    if (error) return [];
    return registros ?? [];
  });

export const sairDoPontoCpf = createServerFn({ method: "POST" }).handler(async () => {
  const { getPontoSession } = await import("./ponto-session.server");
  await (await getPontoSession()).clear();
  return { ok: true as const };
});

