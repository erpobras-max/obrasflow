import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Eye, Loader2, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatCpfCnpj } from "@/lib/validacao-documento";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/imobiliaria/fiadores")({
  component: ImobFiadoresPage,
});

interface FiadorRow {
  id: string;
  cliente_id: string;
  vinculo_tipo: string;
  renda_mensal: number | null;
  documento_vida: string | null;
  observacoes: string | null;
  imobiliaria_clientes: {
    nome: string;
    cpf_cnpj: string;
  };
}

const VINCULO_LABELS: Record<string, string> = {
  parente: "Parente",
  amigo: "Amigo",
  companheiro: "Companheiro(a)",
  outro: "Outro",
};

const EMPTY_FORM = {
  cliente_id: "",
  vinculo_tipo: "parente" as string,
  renda_mensal: "",
  documento_vida: "",
  observacoes: "",
};

function ImobFiadoresPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FiadorRow | null>(null);
  const [viewTarget, setViewTarget] = useState<FiadorRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FiadorRow | null>(null);

  const { data: fiadores, isLoading } = useQuery({
    queryKey: ["imob_fiadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_fiadores")
        .select(`
          id, cliente_id, vinculo_tipo, renda_mensal, documento_vida, observacoes,
          imobiliaria_clientes ( nome, cpf_cnpj )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FiadorRow[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["imob_clientes_ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imobiliaria_clientes")
        .select("id, nome, cpf_cnpj")
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Check which clients are already fiadores
  const { data: fiadoresExist } = useQuery({
    queryKey: ["imob_fiadores_ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imob_fiadores")
        .select("cliente_id")
        .is("deleted_at", null);
      if (error) throw error;
      return new Set((data ?? []).map((f: any) => f.cliente_id));
    },
  });

  const filteredFiadores = useMemo(() => {
    return (fiadores ?? []).filter((f) => {
      if (search) {
        const s = search.toLowerCase();
        const blob = `${f.imobiliaria_clientes?.nome ?? ""} ${f.imobiliaria_clientes?.cpf_cnpj ?? ""} ${f.vinculo_tipo}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [fiadores, search]);

  const form = useForm({
    defaultValues: EMPTY_FORM,
  });

  const handleCreate = () => {
    setEditTarget(null);
    form.reset(EMPTY_FORM);
    setFormOpen(true);
  };

  const handleEdit = async (f: FiadorRow) => {
    const { data } = await supabase.from("imob_fiadores").select("*").eq("id", f.id).single();
    if (data) {
      setEditTarget(f);
      form.reset({
        cliente_id: data.cliente_id,
        vinculo_tipo: data.vinculo_tipo,
        renda_mensal: data.renda_mensal?.toString() ?? "",
        documento_vida: data.documento_vida ?? "",
        observacoes: data.observacoes ?? "",
      });
      setFormOpen(true);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("imob_fiadores")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiador removido");
      qc.invalidateQueries({ queryKey: ["imob_fiadores"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        cliente_id: values.cliente_id,
        vinculo_tipo: values.vinculo_tipo,
        renda_mensal: values.renda_mensal ? parseFloat(values.renda_mensal) : null,
        documento_vida: values.documento_vida || null,
        observacoes: values.observacoes || null,
        updated_at: new Date().toISOString(),
      };
      if (editTarget) {
        const { error } = await supabase
          .from("imob_fiadores")
          .update(payload)
          .eq("id", editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("imob_fiadores").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editTarget ? "Fiador atualizado" : "Fiador cadastrado");
      qc.invalidateQueries({ queryKey: ["imob_fiadores"] });
      setFormOpen(false);
      form.reset(EMPTY_FORM);
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fiadores</h1>
          <p className="text-muted-foreground">
            Cadastre os fiadores que garantem os contratos de locação.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Novo Fiador
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="bg-card p-4 rounded-xl border">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : filteredFiadores.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nenhum fiador cadastrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Renda Mensal</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiadores.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.imobiliaria_clientes?.nome}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatCpfCnpj(f.imobiliaria_clientes?.cpf_cnpj ?? "")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{VINCULO_LABELS[f.vinculo_tipo] ?? f.vinculo_tipo}</Badge>
                  </TableCell>
                  <TableCell>
                    {f.renda_mensal
                      ? f.renda_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewTarget(f)} title="Ver">
                        <Eye className="size-4" />
                      </Button>
                      {podeEditar && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(f)} title="Editar">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(f)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Fiador" : "Cadastrar Fiador"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Atualize os dados do fiador."
                : "Selecione um cliente ativo como fiador."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="cliente_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (Responsável)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(clientes ?? []).map((c: any) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            disabled={fiadoresExist?.has(c.id) && !editTarget}
                          >
                            {c.nome} {fiadoresExist?.has(c.id) && " (já cadastrado)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vinculo_tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Vínculo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="parente">Parente</SelectItem>
                        <SelectItem value="amigo">Amigo</SelectItem>
                        <SelectItem value="companheiro">Companheiro(a)</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="renda_mensal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Renda Mensal (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="5000"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documento_vida"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento de Vida (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Carteira de Trabalho, RG..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Informações adicionais..." rows={3} {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewTarget !== null} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Fiador</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Nome</span>
                <span>{viewTarget.imobiliaria_clientes?.nome}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase">CPF/CNPJ</span>
                <span>{formatCpfCnpj(viewTarget.imobiliaria_clientes?.cpf_cnpj ?? "")}</span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Vínculo</span>
                <Badge variant="outline">{VINCULO_LABELS[viewTarget.vinculo_tipo]}</Badge>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Renda Mensal</span>
                <span>
                  {viewTarget.renda_mensal
                    ? viewTarget.renda_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </span>
              </div>
              {viewTarget.documento_vida && (
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Documento de Vida</span>
                  <span>{viewTarget.documento_vida}</span>
                </div>
              )}
              {viewTarget.observacoes && (
                <div>
                  <span className="font-semibold text-muted-foreground block text-[11px] uppercase">Observações</span>
                  <p className="bg-muted p-2 rounded text-xs mt-1 whitespace-pre-wrap">
                    {viewTarget.observacoes}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setViewTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fiador?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá <strong>{deleteTarget?.imobiliaria_clientes?.nome}</strong> da lista de fiadores.
              Contratos vinculados a este fiador continuarão existentes, mas perderão a referência.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
