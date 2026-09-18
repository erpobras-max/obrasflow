import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { inviteUser, removeUser, updateUserAccess } from "@/lib/usuarios.functions";
import { ROLE_BADGE_CLASS, ROLE_LABEL, ROLE_OPTIONS } from "@/lib/role-meta";
import type { AppRole } from "@/lib/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/usuarios")({
  component: UsuariosPage,
});

interface PerfilRow {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  perfil: AppRole;
  roles: AppRole[];
  ativo: boolean;
  created_at: string;
}

function UsuariosPage() {
  const navigate = useNavigate();
  const { loading, perfil, roles: currentRoles } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PerfilRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PerfilRow | null>(null);

  const removeUserFn = useServerFn(removeUser);
  const deleteMutation = useMutation({
    mutationFn: (arg: { id: string; userId: string }) => removeUserFn({ data: arg }),
    onSuccess: () => {
      toast.success("Usuário removido com sucesso!");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Falha ao remover usuário");
    }
  });

  // Guard: admin only
  useEffect(() => {
    if (!loading && perfil && !currentRoles.includes("admin")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, perfil, currentRoles, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("perfis_usuarios")
        .select("id,user_id,nome,email,perfil,ativo,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id,role");
      if (rolesError) throw rolesError;
      const rolesByUser = new Map<string, AppRole[]>();
      for (const row of roleRows ?? []) {
        const list = rolesByUser.get(row.user_id) ?? [];
        list.push(row.role as AppRole);
        rolesByUser.set(row.user_id, list);
      }
      return (profiles ?? []).map((profile) => ({
        ...profile,
        roles: [
          profile.perfil as AppRole,
          ...(rolesByUser.get(profile.user_id) ?? []).filter((role) => role !== profile.perfil),
        ],
      })) as PerfilRow[];
    },
    enabled: currentRoles.includes("admin"),
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((u) => {
      if (filterRole !== "all" && !u.roles.includes(filterRole as AppRole)) return false;
      if (filterStatus === "active" && !u.ativo) return false;
      if (filterStatus === "inactive" && u.ativo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!u.nome.toLowerCase().includes(s) && !u.email.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, search, filterRole, filterStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários & Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuários do sistema e seus perfis de acesso.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <Plus className="size-4" /> Convidar usuário
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os perfis</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex max-w-sm flex-wrap gap-1.5">
                      {u.roles.map((role) => (
                        <Badge key={role} variant="outline" className={cn("border", ROLE_BADGE_CLASS[role])}>
                          {ROLE_LABEL[role]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "default" : "secondary"} className={u.ativo ? "bg-green-600 hover:bg-green-600" : ""}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(u)} className="gap-1">
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                      {u.user_id !== perfil?.user_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(u)}
                          className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />
      <EditDialog
        target={editTarget}
        currentUserId={perfil?.user_id ?? null}
        onClose={() => setEditTarget(null)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["usuarios"] })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente a conta de <strong>{deleteTarget?.nome}</strong> ({deleteTarget?.email}) e revogará seu acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ id: deleteTarget.id, userId: deleteTarget.user_id });
                }
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const inviteFormSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  email: z.string().trim().max(255).optional().nullable().or(z.literal("")),
  roles: z.array(z.enum(ROLE_OPTIONS as [AppRole, ...AppRole[]])).min(1, "Selecione ao menos um cargo"),
  funcionarioId: z.string().optional().nullable(),
}).refine((data) => {
  // Se for perfil diferente de funcionário, email é obrigatório e precisa ser válido
  if (!data.roles.includes("funcionario")) {
    if (!data.email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data.email);
  }
  // Se for funcionário, e-mail é opcional (mas se inserido, deve ser válido)
  if (data.email && data.email.trim() !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data.email);
  }
  return true;
}, {
  message: "E-mail inválido ou obrigatório para este perfil",
  path: ["email"],
});
type InviteFormValues = z.infer<typeof inviteFormSchema>;

function InviteDialog({
  open, onOpenChange, onSuccess,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { nome: "", email: "", roles: ["cliente"], funcionarioId: "" },
  });

  const selectedRoles = form.watch("roles");

  // Busca lista de funcionários ativos disponíveis para vincular
  const { data: funcionarios } = useQuery({
    queryKey: ["funcionarios-disponiveis-link", open],
    queryFn: async () => {
      // Tenta buscar com user_id (se a migration já foi aplicada)
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cpf, user_id, email")
        .eq("status", "ativo");

      if (!error) {
        // Migration já foi aplicada: filtra apenas os sem user_id vinculado
        return (data ?? []).filter((f: any) => !f.user_id);
      }

      // Fallback: se a coluna user_id ainda não existe (migration não rodada),
      // busca apenas os campos básicos e exibe todos os ativos
      const { data: dataFallback, error: errorFallback } = await supabase
        .from("funcionarios")
        .select("id, nome, cpf, email")
        .eq("status", "ativo");

      if (errorFallback) {
        console.warn("Erro ao buscar funcionários:", errorFallback.message);
        return [];
      }

      return (dataFallback ?? []).map((f: any) => ({ ...f, user_id: null }));
    },
    enabled: open,
  });

  const invite = useServerFn(inviteUser);
  const mutation = useMutation({
    mutationFn: (values: InviteFormValues) => invite({ data: values }),
    onSuccess: (result) => {
      toast.success(result.delivery === "sms"
        ? "Acesso criado. O funcionário já pode entrar pelo CPF e receber o código no celular."
        : "Convite enviado com sucesso!");
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao enviar convite"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>
            O convite será enviado por e-mail. Para funcionário sem e-mail, o acesso será criado com o celular cadastrado no RH.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            
            <FormField control={form.control} name="roles" render={({ field }) => (
              <FormItem>
                <FormLabel>Cargos e áreas de acesso</FormLabel>
                <FormControl>
                  <RolePicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Funcionário por segundo (com Autofill) */}
            {selectedRoles.includes("funcionario") && (
              <FormField control={form.control} name="funcionarioId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular ao Funcionário (RH)</FormLabel>
                  <Select 
                    value={field.value ?? ""} 
                    onValueChange={(val) => {
                      field.onChange(val);
                      // Autofill dos dados do funcionário selecionado
                      const func = (funcionarios ?? []).find((f) => f.id === val);
                      if (func) {
                        form.setValue("nome", func.nome);
                        if (func.email) {
                          form.setValue("email", func.email);
                        }
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funcionário..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(funcionarios ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome} (CPF: {f.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")})
                        </SelectItem>
                      ))}
                      {(funcionarios ?? []).length === 0 && (
                        <SelectItem value="none" disabled>
                          Nenhum funcionário ativo disponível (sem conta vinculada)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Nome Completo */}
            <FormField control={form.control} name="nome" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl><Input placeholder="João da Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Email */}
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>{selectedRoles.includes("funcionario") ? "Email (opcional para funcionário)" : "Email"}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="joao@empresa.com" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Criando acesso..." : "Criar acesso"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Edit dialog ----------
function EditDialog({
  target, currentUserId, onClose, onSuccess,
}: {
  target: PerfilRow | null;
  currentUserId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [nome, setNome] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["cliente"]);
  const [ativo, setAtivo] = useState(true);
  const [funcionarioId, setFuncionarioId] = useState<string>("");

  // Busca lista de funcionários ativos para o select
  const { data: funcionarios } = useQuery({
    queryKey: ["funcionarios-link-edit", target?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cpf, user_id")
        .eq("status", "ativo");

      if (!error) {
        return data ?? [];
      }

      // Fallback se a coluna user_id ainda não existe
      const { data: dataFallback, error: errorFallback } = await supabase
        .from("funcionarios")
        .select("id, nome, cpf")
        .eq("status", "ativo");

      if (errorFallback) {
        console.warn("Erro ao buscar funcionários no EditDialog:", errorFallback.message);
        return [];
      }

      return (dataFallback ?? []).map((f: any) => ({ ...f, user_id: null }));
    },
    enabled: !!target,
  });

  useEffect(() => {
    if (target) {
      setNome(target.nome);
      setSelectedRoles(target.roles.length ? target.roles : [target.perfil]);
      setAtivo(target.ativo);
      
      // Encontrar se já existe um funcionário vinculado a este user_id
      if (funcionarios && target.user_id) {
        const vinculado = funcionarios.find((f) => f.user_id === target.user_id);
        setFuncionarioId(vinculado ? vinculado.id : "");
      } else {
        setFuncionarioId("");
      }
    }
  }, [target, funcionarios]);

  const isSelf = !!target && target.user_id === currentUserId;
  const updateAccess = useServerFn(updateUserAccess);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      
      await updateAccess({
        data: {
          userId: target.user_id,
          profileId: target.id,
          nome,
          ativo,
          roles: selectedRoles,
          funcionarioId: funcionarioId && funcionarioId !== "none" ? funcionarioId : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Usuário atualizado!");
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message ?? "Falha ao atualizar"),
  });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cargos e áreas de acesso</Label>
            <RolePicker value={selectedRoles} onChange={setSelectedRoles} disabled={isSelf} />
            {isSelf && (
              <p className="text-xs text-muted-foreground">
                Você não pode alterar seu próprio perfil de administrador.
              </p>
            )}
          </div>

          {selectedRoles.includes("funcionario") && (
            <div className="space-y-2">
              <Label>Vincular ao Funcionário (RH)</Label>
              <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum vínculo</SelectItem>
                  {(funcionarios ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} (CPF: {f.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Usuário ativo</Label>
              <p className="text-xs text-muted-foreground">
                Usuários inativos não podem acessar o sistema.
              </p>
            </div>
            <Switch checked={ativo} onCheckedChange={setAtivo} disabled={isSelf} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RolePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: AppRole[];
  onChange: (roles: AppRole[]) => void;
  disabled?: boolean;
}) {
  const toggleRole = (role: AppRole, checked: boolean) => {
    if (checked) {
      onChange(Array.from(new Set([...value, role])));
      return;
    }
    if (value.length > 1) onChange(value.filter((item) => item !== role));
  };

  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
      {ROLE_OPTIONS.map((role) => {
        const checked = value.includes(role);
        return (
          <label
            key={role}
            className={cn(
              "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
              checked && "border-primary bg-primary/5",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled || (checked && value.length === 1)}
              onCheckedChange={(next) => toggleRole(role, next === true)}
            />
            <span>{ROLE_LABEL[role]}</span>
          </label>
        );
      })}
    </div>
  );
}
