import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  area: z.enum(["client", "employee"]),
  documento: z.string().trim().min(1).max(30),
});

const GENERIC_ERROR = "Não foi possível acessar esta área com o documento informado.";

export const iniciarAcessoPorDocumento = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const documento = data.documento.replace(/\D/g, "");

    if (
      (data.area === "employee" && documento.length !== 11) ||
      (data.area === "client" && ![11, 14].includes(documento.length))
    ) {
      throw new Error(GENERIC_ERROR);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server.custom");

    const lookup = data.area === "client"
      ? await supabaseAdmin
          .from("clientes")
          .select("auth_user_id")
          .eq("cpf_cnpj", documento)
          .eq("status", "ativo")
          .is("deleted_at", null)
          .maybeSingle()
      : await supabaseAdmin
          .from("funcionarios")
          .select("user_id")
          .eq("cpf", documento)
          .eq("status", "ativo")
          .maybeSingle();

    const userId = data.area === "client"
      ? (lookup.data as { auth_user_id?: string | null } | null)?.auth_user_id
      : (lookup.data as { user_id?: string | null } | null)?.user_id;

    if (lookup.error || !userId) throw new Error(GENERIC_ERROR);

    const expectedRole = data.area === "client" ? "cliente" : "funcionario";
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

    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !authUser.user?.email) throw new Error(GENERIC_ERROR);

    const { error: linkError } = await supabaseAdmin.auth.signInWithOtp({
      email: authUser.user.email,
      options: { shouldCreateUser: false },
    });

    if (linkError) throw new Error(GENERIC_ERROR);

    const [localPart, domain] = authUser.user.email.split("@");
    const visibleStart = localPart.slice(0, Math.min(2, localPart.length));
    const maskedEmail = `${visibleStart}${"*".repeat(Math.max(3, localPart.length - visibleStart.length))}@${domain}`;
    return { sent: true as const, maskedEmail };
  });
