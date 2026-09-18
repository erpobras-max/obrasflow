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

type AccessArea = z.infer<typeof accessAreaSchema>;

function normalizeBrazilianPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
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
  return Boolean(email && !email.toLowerCase().endsWith("@obrasflow.com.br") && !email.toLowerCase().endsWith("@sms.obrasflow.local"));
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
  const lookup = area === "client"
    ? await supabaseAdmin
        .from("clientes")
        .select("auth_user_id,email,celular,telefone")
        .eq("cpf_cnpj", documento)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .maybeSingle()
    : await supabaseAdmin
        .from("funcionarios")
        .select("user_id,email,celular,telefone")
        .eq("cpf", documento)
        .eq("status", "ativo")
        .maybeSingle();

  const record = lookup.data as {
    auth_user_id?: string | null;
    user_id?: string | null;
    email?: string | null;
    celular?: string | null;
    telefone?: string | null;
  } | null;
  const userId = area === "client" ? record?.auth_user_id : record?.user_id;
  if (lookup.error || !record || !userId) throw new Error(GENERIC_ERROR);

  const expectedRole = area === "client" ? "cliente" : "funcionario";
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

  const hasExpectedRole = profile?.perfil === expectedRole || role?.role === expectedRole;
  if (profileError || roleError || !profile?.ativo || !hasExpectedRole) {
    throw new Error(GENERIC_ERROR);
  }

  return { supabaseAdmin, userId, record };
}

export const iniciarAcessoPorDocumento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, userId, record } = await findAuthorizedAccess(data.area, data.documento);
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !authUser.user) throw new Error(GENERIC_ERROR);

    const email = isRealEmail(record.email) ? record.email! : authUser.user.email;
    if (isRealEmail(email)) {
      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email: email!,
        options: { shouldCreateUser: false },
      });
      if (error) throw new Error(GENERIC_ERROR);
      return { method: "email" as const, maskedTarget: maskEmail(email!) };
    }

    const phone = normalizeBrazilianPhone(record.celular || record.telefone);
    if (!phone) throw new Error(GENERIC_ERROR);

    if (authUser.user.phone !== phone) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        phone,
        phone_confirm: true,
      });
      if (updateError) throw new Error(GENERIC_ERROR);
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false, channel: "sms" },
    });
    if (error) throw new Error(GENERIC_ERROR);

    return { method: "sms" as const, maskedTarget: maskPhone(phone) };
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
