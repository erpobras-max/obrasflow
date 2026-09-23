import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  Loader2,
  MailCheck,
  ShieldCheck,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client.custom";
import { acessarDiretoPorDocumento } from "@/lib/acesso-documento.functions";
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

function getDestination(roles: string[]) {
  const managementRoles = roles.filter((role) => !["cliente", "funcionario"].includes(role));
  if (managementRoles.length > 0) return "/dashboard";
  if (roles.includes("funcionario")) return "/ponto";
  if (roles.includes("cliente")) return "/portal";
  return "/dashboard";
}

async function loadUserAccess(userId: string) {
  const [{ data: perfil, error: profileError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      supabase
        .from("perfis_usuarios")
        .select("perfil,ativo")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError || rolesError || !perfil?.ativo) {
    throw new Error("Acesso desativado ou sem permissões configuradas.");
  }

  return Array.from(new Set([
    perfil.perfil,
    ...(roleRows ?? []).map((row) => row.role),
  ]));
}

function formatDocumentInput(value: string, area: AccessArea) {
  const digits = onlyDigits(value).slice(0, area === "client" ? 14 : 11);
  if (area === "client" && digits.length > 11) {
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function AuthPage() {
  const navigate = useNavigate();
  const [area, setArea] = useState<AccessArea>("general");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAccess, setPendingAccess] = useState<{
    method: "email" | "sms";
    maskedTarget: string;
    documento: string;
    area: Exclude<AccessArea, "general">;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { identificador: "", password: "" },
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;

      try {
        const roles = await loadUserAccess(session.user.id);
        navigate({ to: getDestination(roles) as never, replace: true });
      } catch {
        await supabase.auth.signOut();
      }
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

        const roles = await loadUserAccess(data.user.id);

        toast.success("Bem-vindo!");
        navigate({ to: getDestination(roles) as never, replace: true });
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

      const tokens = await acessarDiretoPorDocumento({
        data: { area, documento },
      });
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (error || !data.user) throw new Error("Sessão inválida.");
      toast.success("Acesso liberado.");
      navigate({ to: area === "client" ? "/portal" : "/ponto", replace: true });
    } catch (error) {
      if (area === "general") await supabase.auth.signOut();
      const serverMessage = error instanceof Error ? error.message : "";
      const safeAccessMessage = serverMessage.includes("acesso por celular ainda não está configurado")
        ? serverMessage
        : "Não foi possível acessar esta área com o documento informado.";
      toast.error(
        area === "general"
          ? "Não foi possível entrar. Confira seu e-mail e senha."
          : safeAccessMessage,
      );
    } finally {
      setSubmitting(false);
    }
  };


  const resetDocumentAccess = () => form.reset({ identificador: "", password: "" });
  const confirmSmsCode = async () => undefined;

  const currentCopy = AREA_COPY[area];
  const isGeneral = area === "general";
  const documentLabel = area === "client" ? "CPF ou CNPJ" : "CPF";
  const documentPlaceholder = area === "client" ? "000000000-00 ou 00000000000000" : "000000000-00";

  return (
    <main className="min-h-screen bg-stone-100 p-3 sm:p-6 lg:flex lg:items-center lg:justify-center">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:min-h-[720px] lg:min-h-[680px] lg:grid-cols-[0.92fr_1.08fr]">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
                <HardHat className="size-6" />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">ObrasFlow ERP</p>
                <p className="text-xs text-slate-400">Construção e gestão imobiliária</p>
              </div>
            </div>
            <h1 className="mt-16 max-w-sm text-4xl font-semibold leading-tight tracking-[-0.03em]">
              Cada área do seu negócio em um só acesso.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Equipe, clientes e administração entram pelo mesmo endereço e seguem direto para o ambiente correto.
            </p>
          </div>
          <div className="space-y-4 border-t border-slate-800 pt-7">
            {[
              "Acesso definido pelos cargos do usuário",
              "Portal exclusivo para acompanhamento do cliente",
              "Registro de ponto adaptado para celular",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="size-4 shrink-0 text-amber-400" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-slate-950 text-amber-400">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight text-slate-950">ObrasFlow ERP</p>
                  <p className="text-xs text-slate-500">Gestão integrada</p>
                </div>
              </div>
            </div>

            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Acesso seguro</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">Entre na sua conta</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Escolha sua área para continuar.</p>
            </div>

            <Card className="border-slate-200 p-1 shadow-none">
              <div className="grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1" role="tablist" aria-label="Área de acesso">
                {([
                  ["general", "Equipe", ShieldCheck],
                  ["client", "Cliente", UserRound],
                  ["employee", "Funcionário", UsersRound],
                ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={area === value}
                onClick={() => {
                  setArea(value);
                  setPendingAccess(null);
                  setOtpCode("");
                  form.reset({ identificador: "", password: "" });
                }}
                    className={`flex min-h-12 items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  area === value
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                }`}
              >
                    <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
            </Card>

            <div className="mb-5 mt-6">
              <h3 className="font-semibold text-slate-900">{currentCopy.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{currentCopy.hint}</p>
          </div>

            {pendingAccess?.method === "sms" ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950" role="status">
                  <div className="flex items-center gap-2 font-semibold">
                    <Smartphone className="size-4" /> Código enviado por SMS
                  </div>
                  <p className="mt-1 text-xs">Enviamos um código de 6 dígitos para {pendingAccess.maskedTarget}.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Código de acesso</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="h-14 border-slate-300 text-center text-2xl font-semibold tracking-[0.45em]"
                    disabled={submitting}
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  className="h-12 w-full bg-slate-950 text-white hover:bg-slate-800"
                  disabled={submitting || otpCode.length !== 6}
                  onClick={confirmSmsCode}
                >
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirmar código
                </Button>
                <button type="button" onClick={resetDocumentAccess} className="w-full text-sm font-medium text-slate-600 hover:text-slate-950 hover:underline">
                  Usar outro documento
                </button>
              </div>
            ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identificador">{isGeneral ? "E-mail" : documentLabel}</Label>
              <Input
                id="identificador"
                type={isGeneral ? "email" : "tel"}
                inputMode={isGeneral ? "email" : "numeric"}
                autoComplete={isGeneral ? "email" : "off"}
                placeholder={isGeneral ? "voce@empresa.com.br" : documentPlaceholder}
                disabled={submitting}
                  className="h-12 border-slate-300 bg-white"
                {...form.register("identificador")}
                onChange={(event) => form.setValue(
                  "identificador",
                  isGeneral
                    ? event.target.value
                    : formatDocumentInput(event.target.value, area),
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
                  <div className="relative">
                <Input
                  id="password"
                      type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={submitting}
                      className="h-12 border-slate-300 pr-12"
                  {...form.register("password")}
                />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
            )}

              <Button type="submit" className="h-12 w-full bg-slate-950 text-white hover:bg-slate-800" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isGeneral ? "Entrar no sistema" : `Acessar área do ${area === "client" ? "cliente" : "funcionário"}`}
            </Button>
          </form>
            )}

          {isGeneral && (
              <div className="mt-5 text-center">
                <Link to="/forgot-password" className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">
                Esqueci minha senha
              </Link>
            </div>
          )}

            {!isGeneral && (
              pendingAccess?.method === "email" ? (
                <div className="mt-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs leading-5 text-emerald-950" role="status">
                  <MailCheck className="mt-0.5 size-4 shrink-0" />
                  <div>
                    Enviamos o link de acesso para {pendingAccess.maskedTarget}. Abra o e-mail neste dispositivo para continuar.
                    <button type="button" onClick={resetDocumentAccess} className="mt-2 block font-semibold underline underline-offset-2">Usar outro documento</button>
                  </div>
                </div>
              ) : !pendingAccess ? (
                <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  O documento localiza uma conta autorizada e libera diretamente o portal correspondente.
                </div>
              ) : null
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
