import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const accessAreaSchema = z.enum(["client", "employee"]);
const inputSchema = z.object({
  area: accessAreaSchema,
  documento: z.string().trim().min(1).max(30),
});
const confirmationSchema = inputSchema.extend({
  codigo: z.string().regex(/^\d{6}$/),
});

const GENERIC_ERROR = "Não foi possível acessar esta área com o documento informado.";
const INVALID_CODE_ERROR = "Código inválido ou expirado.";
const SMS_NOT_CONFIGURED_ERROR =
  "O acesso por celular ainda não está configurado. Cadastre um e-mail válido para este cliente ou configure o provedor de SMS.";

type AccessArea = z.infer<typeof accessAreaSchema>;

function normalizeBrazilianPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    return `+${digits}`;
  return null;
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  const visibleStart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visibleStart}${"*".repeat(Math.max(3, localPart.length - visibleStart.length))}@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `(**) *****-${digits.slice(-4)}`;
}

function isRealEmail(email?: string | null) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] ?? "";
  return (
    ![
      "obrasflow.com.br",
      "sms.obrasflow.local",
      "example.com",
      "example.org",
      "example.net",
    ].includes(domain) &&
    !domain.endsWith(".invalid") &&
    !domain.endsWith(".test")
  );
}

function failAccess(stage: string, error?: unknown, publicMessage = GENERIC_ERROR): never {
  const failure = error as { code?: string; status?: number } | undefined;
  console.error("[acesso-documento]", {
    stage,
    code: failure?.code ?? null,
    status: failure?.status ?? null,
  });
  throw new Error(publicMessage);
}

function documentVariants(documento: string) {
  if (documento.length === 11) {
    return [documento, documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")];
  }
  if (documento.length === 14) {
    return [
      documento,
      documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
    ];
  }
  return [documento];
}

async function findAuthorizedAccess(area: AccessArea, rawDocument: string) {
  const documento = rawDocument.replace(/\D/g, "");
  if (
    (area === "employee" && documento.length !== 11) ||
    (area === "client" && ![11, 14].includes(documento.length))
  ) {
    throw new Error(GENERIC_ERROR);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");
  const variants = documentVariants(documento);
  let source: "clientes" | "imobiliaria_clientes" | "funcionarios";
  let lookup;

  if (area === "client") {
    const civilLookup = await supabaseAdmin
      .from("clientes")
      .select("id,nome,auth_user_id,email,celular,telefone")
      .in("cpf_cnpj", variants)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .maybeSingle();
    if (civilLookup.error) failAccess("buscar_cliente_civil", civilLookup.error);

    if (civilLookup.data) {
      source = "clientes";
      lookup = civilLookup;
    } else {
      source = "imobiliaria_clientes";
      lookup = await supabaseAdmin
        .from("imobiliaria_clientes")
        .select("id,nome,auth_user_id,email,celular,telefone")
        .in("cpf_cnpj", variants)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .maybeSingle();
    }
  } else {
    source = "funcionarios";
    lookup = await supabaseAdmin
      .from("funcionarios")
      .select("id,nome,user_id,email,celular,telefone")
      .in("cpf", variants)
      .eq("status", "ativo")
      .maybeSingle();
  }

  const record = lookup.data as {
    id: string;
    nome: string;
    auth_user_id?: string | null;
    user_id?: string | null;
    email?: string | null;
    celular?: string | null;
    telefone?: string | null;
  } | null;
  if (lookup.error || !record) failAccess("buscar_cadastro", lookup.error);

  const expectedRole = area === "client" ? "cliente" : "funcionario";
  const phone = normalizeBrazilianPhone(record.celular || record.telefone);
  const profileEmail =
    record.email?.trim().toLowerCase() ||
    (phone ? `${phone.replace(/\D/g, "")}@sms.obrasflow.local` : null);
  if (!profileEmail && !phone) throw new Error(GENERIC_ERROR);

  let userId = area === "client" ? record.auth_user_id : record.user_id;

  if (!userId && profileEmail) {
    const { data: existingProfile } = await supabaseAdmin
      .from("perfis_usuarios")
      .select("user_id")
      .eq("email", profileEmail)
      .maybeSingle();
    userId = existingProfile?.user_id || null;
  }

  if (!userId) {
    const createPayload = {
      user_metadata: { nome: record.nome, perfil: expectedRole },
      ...(isRealEmail(record.email)
        ? { email: record.email!.trim().toLowerCase(), email_confirm: true }
        : {}),
      ...(phone ? { phone, phone_confirm: true } : {}),
    };
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser(createPayload);
    if (createError || !created.user) failAccess("criar_usuario", createError);
    userId = created.user.id;
  }

  const linkResult =
    source === "funcionarios"
      ? await supabaseAdmin.from("funcionarios").update({ user_id: userId }).eq("id", record.id)
      : await supabaseAdmin.from(source).update({ auth_user_id: userId }).eq("id", record.id);
  if (linkResult.error) failAccess("vincular_usuario", linkResult.error);

  const [{ data: profile, error: profileError }, { data: role, error: roleError }] =
    await Promise.all([
      supabaseAdmin
        .from("perfis_usuarios")
        .select("perfil,ativo")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", expectedRole)
        .maybeSingle(),
    ]);

  if (profileError || roleError || profile?.ativo === false) {
    failAccess("validar_perfil", profileError || roleError);
  }

  if (!profile) {
    const { error } = await supabaseAdmin.from("perfis_usuarios").insert({
      user_id: userId,
      nome: record.nome,
      email: profileEmail!,
      perfil: expectedRole,
      ativo: true,
    });
    if (error) failAccess("criar_perfil", error);
  }

  if (profile?.perfil !== expectedRole && role?.role !== expectedRole) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: expectedRole }, { onConflict: "user_id,role" });
    if (error) failAccess("atribuir_cargo", error);
  }

  return { supabaseAdmin, userId, record };
}

export const iniciarAcessoPorDocumento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, userId, record } = await findAuthorizedAccess(data.area, data.documento);
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !authUser.user) failAccess("buscar_usuario_auth", userError);

    const email = isRealEmail(record.email) ? record.email! : authUser.user.email;
    if (isRealEmail(email)) {
      if (authUser.user.email?.trim().toLowerCase() !== email!.trim().toLowerCase()) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: email!.trim().toLowerCase(),
          email_confirm: true,
        });
        if (updateError) failAccess("atualizar_email_auth", updateError);
      }
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email: email!,
        options: { shouldCreateUser: false },
      });
      if (!error) return { method: "email" as const, maskedTarget: maskEmail(email!) };

      const fallbackPhone = normalizeBrazilianPhone(record.celular || record.telefone);
      if (!fallbackPhone) failAccess("enviar_email", error);
    }

    const phone = normalizeBrazilianPhone(record.celular || record.telefone);
    if (!phone) failAccess("sem_canal_de_acesso");

    if (authUser.user.phone !== phone) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        phone,
        phone_confirm: true,
      });
      if (updateError) failAccess("atualizar_telefone_auth", updateError);
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false, channel: "sms" },
    });
    if (error) {
      failAccess("enviar_sms", error, SMS_NOT_CONFIGURED_ERROR);
    }

    return { method: "sms" as const, maskedTarget: maskPhone(phone) };
  });

async function gerarSenhaDeAcessoDireto(userId: string) {
  const { env } = await import("cloudflare:workers");
  const secret = (env as unknown as { MY_SUPABASE_SERVICE_ROLE_KEY?: string }).MY_SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error(GENERIC_ERROR);
  const input = new TextEncoder().encode(`${userId}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `ObrasFlow-${hex}!a1`;
}

export const acessarDiretoPorDocumento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, userId } = await findAuthorizedAccess(data.area, data.documento);
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !authUser.user?.email) failAccess("buscar_usuario_auth", userError);

    const password = await gerarSenhaDeAcessoDireto(userId);
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (passwordError) failAccess("preparar_acesso_direto", passwordError);

    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });
    if (sessionError || !sessionData.session) failAccess("criar_sessao_direta", sessionError);

    return {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    };
  });

export const confirmarAcessoPorDocumento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => confirmationSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, userId, record } = await findAuthorizedAccess(data.area, data.documento);
    const phone = normalizeBrazilianPhone(record.celular || record.telefone);
    if (!phone) throw new Error(INVALID_CODE_ERROR);

    const { data: sessionData, error } = await supabaseAdmin.auth.verifyOtp({
      phone,
      token: data.codigo,
      type: "sms",
    });

    if (error || sessionData.user?.id !== userId || !sessionData.session) {
      throw new Error(INVALID_CODE_ERROR);
    }

    return {
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    };
  });
