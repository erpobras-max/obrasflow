import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Star, UserRoundCheck, UsersRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client.custom";
import {
  criarEmpreiteiroPayload,
  empreiteiroSchema,
  filtrarEmpreiteiros,
  type Empreiteiro,
  type EmpreiteiroFormValues,
  type EmpreiteiroStatusFilter,
} from "@/lib/empreiteiros";

const emptyForm: EmpreiteiroFormValues = {
  razao_social: "",
  nome_fantasia: "",
  tipo: "pj",
  cnpj: "",
  cpf: "",
  especialidade: "",
  telefone: "",
  email: "",
  avaliacao: null,
  ativo: true,
};

function valuesFromEmpreiteiro(item: Empreiteiro): EmpreiteiroFormValues {
  return {
    razao_social: item.razao_social,
    nome_fantasia: item.nome_fantasia ?? "",
    tipo: item.tipo,
    cnpj: item.cnpj ?? "",
    cpf: item.cpf ?? "",
    especialidade: item.especialidade ?? "",
    telefone: item.telefone ?? "",
    email: item.email ?? "",
    avaliacao: item.avaliacao,
    ativo: item.ativo,
  };
}

function documentLabel(item: Empreiteiro) {
  return item.tipo === "pj" ? item.cnpj || "CNPJ não informado" : item.cpf || "CPF não informado";
}

export function EmpreiteirosCadastroPanel({ podeGerenciar }: { podeGerenciar: boolean }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<EmpreiteiroStatusFilter>("todos");
  const [dialogTarget, setDialogTarget] = useState<Empreiteiro | "new" | null>(null);

  const form = useForm<EmpreiteiroFormValues>({
    resolver: zodResolver(empreiteiroSchema),
    defaultValues: emptyForm,
  });
  const tipo = form.watch("tipo");

  const {
    data: empreiteiros = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["empreiteiros"],
    queryFn: async () => {
      // Os campos classificacao e especialidade ainda não constam nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("fornecedores")
        .select(
          "id,razao_social,nome_fantasia,cnpj,cpf,tipo,email,telefone,classificacao,especialidade,avaliacao,ativo,created_at",
        )
        .eq("classificacao", "terceirizado")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as Empreiteiro[];
    },
  });

  const filtered = useMemo(
    () => filtrarEmpreiteiros(empreiteiros, busca, status),
    [empreiteiros, busca, status],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: EmpreiteiroFormValues) => {
      const payload = criarEmpreiteiroPayload(values);
      // A classificação de terceirizado ainda não consta nos tipos gerados.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = (supabase as any).from("fornecedores");
      const { error } =
        dialogTarget && dialogTarget !== "new"
          ? await query.update(payload).eq("id", dialogTarget.id)
          : await query.insert(payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(dialogTarget === "new" ? "Empreiteiro cadastrado" : "Cadastro atualizado");
      setDialogTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["empreiteiros"] }),
        queryClient.invalidateQueries({ queryKey: ["fornecedores-terceirizados-contratos"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar o cadastro"),
  });

  function openDialog(target: Empreiteiro | "new") {
    form.reset(target === "new" ? emptyForm : valuesFromEmpreiteiro(target));
    setDialogTarget(target);
  }

  const activeCount = empreiteiros.filter((item) => item.ativo).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UsersRound className="size-8 text-primary" />
            <div>
              <p className="text-2xl font-semibold">{empreiteiros.length}</p>
              <p className="text-xs text-muted-foreground">Cadastrados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UserRoundCheck className="size-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-semibold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UsersRound className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-semibold">{empreiteiros.length - activeCount}</p>
              <p className="text-xs text-muted-foreground">Inativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, documento ou especialidade"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as EmpreiteiroStatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
            {podeGerenciar && (
              <Button onClick={() => openDialog("new")}>
                <Plus className="mr-2 size-4" />
                Novo empreiteiro
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 p-6 text-center">
              <p className="mb-3 text-sm text-destructive">
                Não foi possível carregar os empreiteiros.
              </p>
              <Button variant="outline" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreiteiro</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead>Situação</TableHead>
                  {podeGerenciar && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.razao_social}</div>
                      {item.nome_fantasia && (
                        <div className="text-xs text-muted-foreground">{item.nome_fantasia}</div>
                      )}
                    </TableCell>
                    <TableCell>{documentLabel(item)}</TableCell>
                    <TableCell>{item.especialidade || "—"}</TableCell>
                    <TableCell>
                      <div>{item.telefone || "—"}</div>
                      {item.email && (
                        <div className="text-xs text-muted-foreground">{item.email}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.avaliacao == null ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-4 fill-amber-400 text-amber-400" />
                          {item.avaliacao.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.ativo ? "default" : "secondary"}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {podeGerenciar && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar empreiteiro"
                          onClick={() => openDialog(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={podeGerenciar ? 7 : 6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum empreiteiro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogTarget !== null} onOpenChange={(open) => !open && setDialogTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogTarget === "new" ? "Novo empreiteiro" : "Editar empreiteiro"}
            </DialogTitle>
            <DialogDescription>
              Cadastre os dados que serão usados nos contratos e medições.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de pessoa</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pj">Pessoa jurídica</SelectItem>
                          <SelectItem value="pf">Pessoa física</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={tipo === "pj" ? "cnpj" : "cpf"}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pj" ? "CNPJ" : "CPF"}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={tipo === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tipo === "pj" ? "Razão social" : "Nome completo"}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nome_fantasia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome fantasia</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="especialidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especialidade</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: elétrica, pintura, alvenaria" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="avaliacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avaliação (0 a 5)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="5"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === "" ? null : Number(event.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Cadastro ativo</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Empreiteiros inativos permanecem no histórico, mas não devem ser usados em
                        novos contratos.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogTarget(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar empreiteiro"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
