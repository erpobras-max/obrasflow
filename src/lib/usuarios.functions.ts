import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

const inviteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().nullable(),
  roles: z.array(z.enum([
    "admin", "diretor", "financeiro_civil", "financeiro_imobiliaria", "compras",
    "engenharia", "almoxarifado", "rh", "cliente", "funcionario", "imobiliaria",
  ])).min(1).max(11),
  funcionarioId: z.string().uuid().optional().nullable(),
});

const ROLE_PRIORITY = [
  "admin", "diretor", "financeiro_civil", "financeiro_imobiliaria", "engenharia",
  "imobiliaria", "compras", "almoxarifado", "rh", "funcionario", "cliente",
] as const;

function getPrimaryRole(roles: Array<(typeof ROLE_PRIORITY)[number]>) {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? roles[0];
}

function normalizeBrazilianPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return null;
}

async function requireAdmin(context: {
  supabase: { from: (table: string) => any };
  userId: string;
}) {
  const { data: profile } = await context.supabase
    .from("perfis_usuarios")
    .select("perfil, ativo")
    .eq("user_id", context.userId)
    .maybeSingle();

  const { data: adminRole } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();

  if ((profile?.perfil !== "admin" && !adminRole) || profile?.ativo === false) {
    throw new Error("Ação não autorizada.");
  }
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    let emailToInvite = data.email?.toLowerCase() || null;
    let phoneToInvite: string | null = null;
    const primaryRole = getPrimaryRole(data.roles);

    if (data.roles.includes("funcionario")) {
      if (!data.funcionarioId) {
        throw new Error("É necessário vincular um funcionário do RH.");
      }

      const { data: employee, error: employeeError } = await context.supabase
        .from("funcionarios")
        .select("email,celular,telefone")
        .eq("id", data.funcionarioId)
        .maybeSingle();

      if (employeeError || !employee) {
        throw new Error("Funcionário não localizado.");
      }

      emailToInvite = emailToInvite || employee.email?.toLowerCase() || null;
      phoneToInvite = normalizeBrazilianPhone(employee.celular || employee.telefone);
      if (!emailToInvite && !phoneToInvite) {
        throw new Error("Cadastre um e-mail ou celular válido para o funcionário antes de criar o acesso.");
      }
    }

    if (!emailToInvite && !phoneToInvite) {
      throw new Error("E-mail é obrigatório para enviar um convite.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");
    const authResult = emailToInvite
      ? await supabaseAdmin.auth.admin.inviteUserByEmail(
          emailToInvite,
          { data: { nome: data.nome, perfil: primaryRole } },
        )
      : await supabaseAdmin.auth.admin.createUser({
          phone: phoneToInvite!,
          phone_confirm: true,
          user_metadata: { nome: data.nome, perfil: primaryRole },
        });

    if (authResult.error || !authResult.data.user) {
      throw new Error(emailToInvite ? "Não foi possível enviar o convite." : "Não foi possível criar o acesso pelo celular.");
    }

    const userId = authResult.data.user.id;
    const profileEmail = emailToInvite || `${phoneToInvite!.replace(/\D/g, "")}@sms.obrasflow.local`;
    const { error: profileError } = await supabaseAdmin
      .from("perfis_usuarios")
      .upsert({
        user_id: userId,
        nome: data.nome,
        email: profileEmail,
        perfil: primaryRole,
        ativo: true,
      }, { onConflict: "user_id" });

    if (profileError) {
      throw new Error("Não foi possível configurar as permissões do usuário.");
    }

    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        data.roles.map((role) => ({ user_id: userId, role })),
        { onConflict: "user_id,role" },
      );

    if (rolesError) {
      throw new Error("Convite criado, mas não foi possível atribuir os cargos.");
    }

    if (data.roles.includes("funcionario") && data.funcionarioId) {
      const { error: linkError } = await supabaseAdmin
        .from("funcionarios")
        .update({ user_id: userId })
        .eq("id", data.funcionarioId);

      if (linkError) {
        throw new Error("Convite criado, mas não foi possível vincular o funcionário.");
      }
    }

    return { ok: true, delivery: emailToInvite ? "email" as const : "sms" as const };
  });

const updateAccessSchema = z.object({
  userId: z.string().uuid(),
  profileId: z.string().uuid(),
  nome: z.string().trim().min(1).max(120),
  ativo: z.boolean(),
  roles: inviteSchema.shape.roles,
  funcionarioId: z.string().uuid().optional().nullable(),
});

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateAccessSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const primaryRole = getPrimaryRole(data.roles);

    if (data.userId === context.userId) {
      if (!data.ativo || !data.roles.includes("admin")) {
        throw new Error("Você não pode remover seu próprio acesso administrativo.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");
    const roleRows = data.roles.map((role) => ({ user_id: data.userId, role }));
    const { error: insertRolesError } = await supabaseAdmin
      .from("user_roles")
      .upsert(roleRows, { onConflict: "user_id,role" });
    if (insertRolesError) throw new Error("Não foi possível atribuir os cargos.");

    const { error: removeRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .not("role", "in", `(${data.roles.join(",")})`);
    if (removeRolesError) throw new Error("Não foi possível remover os cargos antigos.");

    const { error: profileError } = await supabaseAdmin
      .from("perfis_usuarios")
      .update({ nome: data.nome, ativo: data.ativo, perfil: primaryRole })
      .eq("id", data.profileId);
    if (profileError) throw new Error("Não foi possível atualizar o usuário.");

    await supabaseAdmin
      .from("funcionarios")
      .update({ user_id: null })
      .eq("user_id", data.userId);

    if (data.roles.includes("funcionario") && data.funcionarioId) {
      const { error: linkError } = await supabaseAdmin
        .from("funcionarios")
        .update({ user_id: data.userId })
        .eq("id", data.funcionarioId);
      if (linkError) throw new Error("Cargos salvos, mas o funcionário não pôde ser vinculado.");
    }

    return { ok: true };
  });

const removeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (data.userId === context.userId) {
      throw new Error("Você não pode remover a própria conta.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (deleteAuthError) {
      throw new Error("Não foi possível remover a conta do usuário.");
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("perfis_usuarios")
      .delete()
      .eq("id", data.id);

    if (deleteProfileError) {
      throw new Error("A conta foi removida, mas o perfil não pôde ser limpo.");
    }

    return { ok: true };
  });
