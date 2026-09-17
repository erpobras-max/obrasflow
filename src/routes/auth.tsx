import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.custom";
import { iniciarAcessoPorDocumento } from "@/lib/acesso-documento.functions";
import { onlyDigits, validarCPF, validarCpfCnpj } from "@/lib/validacao-documento";

const schema = z.object({
  identificador: z.string().trim().min(3, "Informe seu acesso.").max(255),
  password: z.string().max(128).optional(),
});
type FormData = z.infer<typeof schema>;
type AccessArea = "general" | "client" | "employee";

const AREA_COPY: Record<AccessArea, { title: string; hint: string }> = {
  general: { title: "Acesso geral", hint: "Administração e gestão da empresa" },
  client: { title: "Área do cliente", hint: "Informe seu CPF ou CNPJ para acessar" },
  employee: { title: "Área do funcionário", hint: "Informe seu CPF para acessar" },
};

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — ERP Obras" }] }),
  component: AuthPage,
});

function getDestination(perfil?: string) {
  if (perfil === "cliente") return "/portal";
  if (perfil === "funcionario") return "/ponto";
  return "/dashboard";
}

function sanitizeDocumentInput(value: string, maxLength: number) {
  return value.replace(/[^\d-]/g, "").slice(0, maxLength);
}

function AuthPage() {
  const navigate = useNavigate();
  const [area, setArea] = useState<AccessArea>("general");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identificador: "", password: "" },
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;

      const { data: perfil } = await supabase
        .from("perfis_usuarios")
        .select("perfil")
        .eq("user_id", session.user.id)
        .maybeSingle();

      navigate({ to: getDestination((perfil as { perfil?: string } | null)?.perfil) as never, replace: true });
    });
  }, [navigate]);

  const onSubmit = async (values: FormData) => {
    setSubmitting(true);

    try {
      if (area === "general") {
        if (!values.password || values.password.length < 6) {
          form.setError("password", { message: "A senha deve ter pelo menos 6 caracteres." });
          return;
        }

        const { error, data } = await supabase.auth.signInWithPassword({
          email: values.identificador.trim().toLowerCase(),
          password: values.password,
        });

        if (error || !data.user) throw new Error("Credenciais inválidas.");

        const { data: perfil } = await supabase
          .from("perfis_usuarios")
          .select("perfil")
          .eq("user_id", data.user.id)
          .maybeSingle();

        toast.success("Bem-vindo!");
        navigate({ to: getDestination((perfil as { perfil?: string } | null)?.perfil) as never, replace: true });
        return;
      }

      const documento = onlyDigits(values.identificador);
      const documentoValido = area === "client"
        ? validarCpfCnpj(documento)
        : validarCPF(documento);

      if (!documentoValido) {
        form.setError("identificador", {
          message: area === "client" ? "Informe um CPF ou CNPJ válido." : "Informe um CPF válido.",
        });
        return;
      }

      const acesso = await iniciarAcessoPorDocumento({
        data: { area, documento },
      });

      const { error, data } = await supabase.auth.verifyOtp({
        token_hash: acesso.tokenHash,
        type: acesso.type,
      });

      if (error || !data.user) throw new Error("Acesso não autorizado.");

      toast.success("Bem-vindo!");
      navigate({ to: area === "client" ? "/portal" : "/ponto", replace: true });
    } catch {
      toast.error(
        area === "general"
          ? "Não foi possível entrar. Confira seu e-mail e senha."
          : "Não foi possível acessar esta área com o documento informado.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentCopy = AREA_COPY[area];
  const isGeneral = area === "general";
  const documentLabel = area === "client" ? "CPF ou CNPJ" : "CPF";
  const documentPlaceholder = area === "client" ? "000000000-00 ou 00000000000000" : "000000000-00";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30 ring-2 ring-white/20">
            <Building2 className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">ERP Obras</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão completa para construção civil</p>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-3 gap-1 mb-5 rounded-md bg-muted p-1" role="tablist" aria-label="Área de acesso">
            {([
              ["general", "Geral"],
              ["client", "Cliente"],
              ["employee", "Funcionário"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={area === value}
                onClick={() => {
                  setArea(value);
                  form.reset({ identificador: "", password: "" });
                }}
                className={`rounded px-2 py-2 text-xs font-semibold transition-colors ${
                  area === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="font-semibold text-foreground">{currentCopy.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{currentCopy.hint}</p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identificador">{isGeneral ? "E-mail" : documentLabel}</Label>
              <Input
                id="identificador"
                type={isGeneral ? "email" : "tel"}
                inputMode={isGeneral ? "email" : "numeric"}
                autoComplete={isGeneral ? "email" : "off"}
                placeholder={isGeneral ? "voce@empresa.com.br" : documentPlaceholder}
                disabled={submitting}
                {...form.register("identificador")}
                onChange={(event) => form.setValue(
                  "identificador",
                  isGeneral
                    ? event.target.value
                    : sanitizeDocumentInput(event.target.value, area === "client" ? 17 : 14),
                  { shouldValidate: true },
                )}
              />
              {form.formState.errors.identificador && (
                <p className="text-xs text-destructive">{form.formState.errors.identificador.message}</p>
              )}
            </div>

            {isGeneral && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={submitting}
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
              Entrar
            </Button>
          </form>

          {isGeneral && (
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
