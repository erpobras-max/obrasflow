import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileSignature, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  contratoSchema, type ContratoFormValues, type StatusContrato,
  STATUS_CONTRATO_LABEL, STATUS_CONTRATO_BADGE, statusContratoEnum,
} from "@/lib/clientes.schema";
import { cn, formatBRLInput } from "@/lib/utils";
import { ContratoImpressao } from "@/components/contratos/contrato-impressao";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/comercial/contratos")({
  component: ContratosPage,
});

interface ContratoRow {
  id: string;
  numero: string;
  cliente_id: string;
  proposta_id: string | null;
  titulo: string;
  objeto: string | null;
  valor_total: number;
  status: StatusContrato;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
}
interface ClienteOpt { id: string; nome: string }
interface PropostaOpt { id: string; numero: string; titulo: string; valor_total: number }

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY: ContratoFormValues = {
  cliente_id: "",
  proposta_id: null,
  titulo: "",
  objeto: "",
  valor_total: 0,
  status: "ativo",
  data_inicio: "",
  data_fim: "",
  observacoes: "",
};

function ContratosPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";
  const podeExcluir = perfil?.perfil === "admin" || perfil?.perfil === "diretor";

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContratoRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<ContratoRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusContrato>("all");

  const { data: contratos, isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContratoRow[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("id,nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteOpt[];
    },
  });

  const { data: propostas } = useQuery({
    queryKey: ["propostas-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("id,numero,titulo,valor_total")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropostaOpt[];
    },
  });

  const clientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientes ?? []).forEach((c) => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  const filtrados = useMemo(() => {
    if (!contratos) return [];
    if (statusFilter === "all") return contratos;
    return contratos.filter((c) => c.status === statusFilter);
  }, [contratos, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contratos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato excluído");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
        <p className="text-sm text-muted-foreground">
          Gestão e vigência de contratos com clientes e parceiros de obras.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 justify-between">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusContratoEnum.options.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONTRATO_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {podeEditar && (
            <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
              <Plus className="size-4" /> Novo contrato
            </Button>
          )}
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <FileSignature className="size-8 mx-auto mb-2 opacity-50" />
                  Nenhum contrato encontrado
                </TableCell></TableRow>
              ) : filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                  <TableCell className="font-medium">{c.titulo}</TableCell>
                  <TableCell>{clientesMap[c.cliente_id] ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn(STATUS_CONTRATO_BADGE[c.status])}>
                      {STATUS_CONTRATO_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.data_inicio ? new Date(c.data_inicio + "T00:00").toLocaleDateString("pt-BR") : "—"}
                    {" → "}
                    {c.data_fim ? new Date(c.data_fim + "T00:00").toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmtBRL(c.valor_total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="size-8" title="Gerar contrato" onClick={() => setPrintTarget(c)}>
                        <Printer className="size-3.5" />
                      </Button>
                      {podeEditar && (
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditTarget(c); setFormOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ContratoImpressao contrato={printTarget} open={!!printTarget} onOpenChange={(open) => !open && setPrintTarget(null)} />

        <ContratoFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
          target={editTarget}
          clientes={clientes ?? []}
          propostas={propostas ?? []}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["contratos"] })}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
              >Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ContratoFormDialog({
  open, onOpenChange, target, clientes, propostas, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ContratoRow | null;
  clientes: ClienteOpt[];
  propostas: PropostaOpt[];
  onSuccess: () => void;
}) {
  const isEdit = !!target;
  const { user } = useAuth();
  const form = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.reset({
        cliente_id: target.cliente_id,
        proposta_id: target.proposta_id,
        titulo: target.titulo,
        objeto: target.objeto ?? "",
        valor_total: Number(target.valor_total),
        status: target.status,
        data_inicio: target.data_inicio ?? "",
        data_fim: target.data_fim ?? "",
        observacoes: target.observacoes ?? "",
      });
    } else {
      form.reset(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  // Auto-preenche título/valor/cliente quando seleciona proposta (apenas em criação)
  const propostaIdWatch = form.watch("proposta_id");
  useEffect(() => {
    if (isEdit || !propostaIdWatch) return;
    const p = propostas.find((x) => x.id === propostaIdWatch);
    if (!p) return;
    if (!form.getValues("titulo")) form.setValue("titulo", p.titulo);
    if (!form.getValues("valor_total")) form.setValue("valor_total", Number(p.valor_total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaIdWatch]);

  const mutation = useMutation({
    mutationFn: async (values: ContratoFormValues) => {
      const payload = {
        cliente_id: values.cliente_id,
        proposta_id: values.proposta_id || null,
        titulo: values.titulo,
        objeto: values.objeto || null,
        valor_total: values.valor_total,
        status: values.status,
        data_inicio: values.data_inicio || null,
        data_fim: values.data_fim || null,
        observacoes: values.observacoes || null,
      };
      if (isEdit && target) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", target.id);
        if (error) throw error;
      } else {
        const { data: contractData, error } = await supabase
          .from("contratos")
          .insert({ ...payload, numero: "", created_by: user?.id ?? null })
          .select("id, numero, valor_total, cliente_id, data_inicio")
          .single();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Contrato atualizado" : "Contrato criado");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${target?.numero}` : "Novo contrato"}</DialogTitle>
          <DialogDescription>Dados do contrato</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cliente_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {clientes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="proposta_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposta de origem</FormLabel>
                  <Select
                    value={field.value ?? "_none"}
                    onValueChange={(v) => field.onChange(v === "_none" ? null : v)}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="_none">— nenhuma —</SelectItem>
                      {propostas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.numero} — {p.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="objeto" render={({ field }) => (
              <FormItem>
                <FormLabel>Objeto</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {statusContratoEnum.options.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_CONTRATO_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="valor_total" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor total (R$) *</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      value={formatBRLInput(field.value)}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        const cleanDigits = rawVal.replace(/\D/g, "");
                        if (!cleanDigits) {
                          field.onChange(0);
                          return;
                        }
                        const val = parseInt(cleanDigits, 10) / 100;
                        field.onChange(val);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="data_inicio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Início</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="data_fim" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fim</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
