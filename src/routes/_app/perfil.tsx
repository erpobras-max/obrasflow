import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_BADGE_CLASS, ROLE_LABEL } from "@/lib/role-meta";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { loading, user, perfil } = useAuth();
  const [nome, setNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  useEffect(() => {
    if (perfil?.nome) setNome(perfil.nome);
  }, [perfil?.nome]);

  const updateNome = useMutation({
    mutationFn: async () => {
      if (!perfil) return;
      const { error } = await supabase
        .from("perfis_usuarios")
        .update({ nome })
        .eq("id", perfil.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Perfil atualizado!"),
    onError: (e: Error) => toast.error(e.message ?? "Falha ao atualizar"),
  });

  const updateSenha = useMutation({
    mutationFn: async () => {
      if (novaSenha !== confirmarSenha) {
        throw new Error("As senhas não coincidem");
      }
      if (novaSenha.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres");
      }
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso!");
      setNovaSenha("");
      setConfirmarSenha("");
    },
    onError: (e: Error) => toast.error(e.message ?? "Falha ao redefinir senha"),
  });

  if (loading || !perfil) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais e credenciais.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {perfil.nome.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{perfil.nome}</CardTitle>
              <CardDescription>{perfil.email}</CardDescription>
              <Badge variant="outline" className={cn("mt-2 border", ROLE_BADGE_CLASS[perfil.perfil])}>
                {ROLE_LABEL[perfil.perfil]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={perfil.email} disabled />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => updateNome.mutate()}
              disabled={updateNome.isPending || nome.trim() === ""}
            >
              {updateNome.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar Senha</CardTitle>
          <CardDescription>Redefina sua senha de acesso ao sistema diretamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova Senha</Label>
            <Input
              id="nova-senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
            <Input
              id="confirmar-senha"
              type="password"
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => updateSenha.mutate()}
              disabled={updateSenha.isPending || !novaSenha || !confirmarSenha}
            >
              {updateSenha.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
