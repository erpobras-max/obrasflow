import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.custom";

const inviteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().nullable(),
  perfil: z.enum([
    "admin", "diretor", "financeiro", "compras",
    "engenharia", "almoxarifado", "rh", "cliente", "funcionario",
  ]),
  funcionarioId: z.string().uuid().optional().nullable(),
});

async function requireAdmin(context: {
  supabase: { from: (table: string) => any };
  userId: string;
}) {
  const { data: profile } = await context.supabase
    .from("perfis_usuarios")
    .select("perfil, ativo")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (profile?.perfil !== "admin" || profile.ativo === false) {
    throw new Error("Ação não autorizada.");
  }
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    let emailToInvite = data.email?.toLowerCase();

    if (data.perfil === "funcionario") {
      if (!data.funcionarioId) {
        throw new Error("É necessário vincular um funcionário do RH.");
      }

      const { data: employee, error: employeeError } = await context.supabase
        .from("funcionarios")
        .select("email")
        .eq("id", data.funcionarioId)
        .maybeSingle();

      if (employeeError || !employee) {
        throw new Error("Funcionário não localizado.");
      }

      emailToInvite = emailToInvite || employee.email?.toLowerCase();
      if (!emailToInvite) {
        throw new Error("Cadastre um e-mail válido para o funcionário antes de convidá-lo.");
      }
    }

    if (!emailToInvite) {
      throw new Error("E-mail é obrigatório para enviar um convite.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      emailToInvite,
      { data: { nome: data.nome, perfil: data.perfil } },
    );

    if (inviteError || !inviteData.user) {
      throw new Error("Não foi possível enviar o convite.");
    }

    const userId = inviteData.user.id;
    const { error: profileError } = await supabaseAdmin
      .from("perfis_usuarios")
      .upsert({
        user_id: userId,
        nome: data.nome,
        email: emailToInvite,
        perfil: data.perfil,
        ativo: true,
      }, { onConflict: "user_id" });

    if (profileError) {
      throw new Error("Não foi possível configurar as permissões do usuário.");
    }

    if (data.perfil === "funcionario" && data.funcionarioId) {
      const { error: linkError } = await supabaseAdmin
        .from("funcionarios")
        .update({ user_id: userId })
        .eq("id", data.funcionarioId);

      if (linkError) {
        throw new Error("Convite criado, mas não foi possível vincular o funcionário.");
      }
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
