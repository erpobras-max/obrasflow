import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  OPORT_STAGES, oportunidadeSchema, type OportunidadeFormValues, type StatusOportunidade,
} from "@/lib/clientes.schema";
import { cn, formatBRLInput } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_app/comercial/oportunidades")({
  component: OportunidadesPage,
});

interface OportRow {
  id: string;
  cliente_id: string | null;
  titulo: string;
  descricao: string | null;
  valor_estimado: number | null;
  status: StatusOportunidade;
  probabilidade: number;
  data_prevista: string | null;
}

interface ClienteOpt { id: string; nome: string }

const EMPTY: OportunidadeFormValues = {
  cliente_id: null,
  titulo: "",
  descricao: "",
  valor_estimado: null,
  status: "novo",
  probabilidade: 50,
  data_prevista: "",
};

const fmtBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function OportunidadesPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";

  const [editTarget, setEditTarget] = useState<OportRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: opts, isLoading } = useQuery({
    queryKey: ["oportunidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oportunidades" as any)
        .select("id,cliente_id,titulo,descricao,valor_estimado,status,probabilidade,data_prevista")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OportRow[];
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes" as any)
        .select("id,nome")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as ClienteOpt[];
    },
  });

  const clientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientes ?? []).forEach((c) => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  const grouped = useMemo(() => {
    const g: Record<StatusOportunidade, OportRow[]> = {
      novo: [], qualificacao: [], proposta: [], negociacao: [], ganho: [], perdido: [],
    };
    (opts ?? []).forEach((o) => g[o.status].push(o));
    return g;
  }, [opts]);

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusOportunidade }) => {
      const { error } = await supabase
        .from("oportunidades" as any).update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oportunidades"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline de oportunidades comerciais e negociações em andamento.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-end">
          {podeEditar && (
            <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
              <Plus className="size-4" /> Nova oportunidade
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {OPORT_STAGES.map((stage) => {
            const items = grouped[stage.key];
            const total = items.reduce((s, i) => s + (i.valor_estimado ?? 0), 0);
            return (
              <div
                key={stage.key}
                className="rounded-lg border bg-card p-3 min-h-[300px] flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  if (id && podeEditar) moveMutation.mutate({ id, status: stage.key });
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-sm font-semibold">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {items.length} · {fmtBRL(total)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  {isLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : items.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">Vazio</div>
                  ) : (
                    items.map((o) => (
                      <div
                        key={o.id}
                        draggable={podeEditar}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
                        className={cn(
                          "rounded-md border bg-background p-2.5 text-sm group hover:border-primary transition-colors",
                          podeEditar && "cursor-move",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium leading-tight flex-1">{o.titulo}</div>
                          {podeEditar && (
                            <Button
                              size="icon" variant="ghost"
                              className="size-6 opacity-0 group-hover:opacity-100"
                              onClick={() => { setEditTarget(o); setFormOpen(true); }}
                            >
                              <Pencil className="size-3" />
                            </Button>
                          )}
                        </div>
                        {o.cliente_id && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {clientesMap[o.cliente_id] ?? "Cliente"}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-2 text-xs">
                          <span className="font-mono">{fmtBRL(o.valor_estimado)}</span>
                          <span className="text-muted-foreground">{o.probabilidade}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <OportFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
          target={editTarget}
          clientes={clientes ?? []}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["oportunidades"] })}
        />
      </div>
    </div>
  );
}

function OportFormDialog({
  open, onOpenChange, target, clientes, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: OportRow | null;
  clientes: ClienteOpt[];
  onSuccess: () => void;
}) {
  const isEdit = !!target;
  const { user } = useAuth();
  const form = useForm<OportunidadeFormValues>({
    resolver: zodResolver(oportunidadeSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.reset({
        cliente_id: target.cliente_id,
        titulo: target.titulo,
        descricao: target.descricao ?? "",
        valor_estimado: target.valor_estimado,
        status: target.status,
        probabilidade: target.probabilidade,
        data_prevista: target.data_prevista ?? "",
      });
    } else {
      form.reset(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  const mutation = useMutation({
    mutationFn: async (values: OportunidadeFormValues) => {
      const payload: any = {
        ...values,
        cliente_id: values.cliente_id || null,
        descricao: values.descricao || null,
        valor_estimado: values.valor_estimado ?? null,
        data_prevista: values.data_prevista || null,
      };
      if (isEdit && target) {
        const { error } = await supabase
          .from("oportunidades" as any).update(payload).eq("id", target.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("oportunidades" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Oportunidade atualizada" : "Oportunidade criada");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>Pipeline comercial</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="titulo" render={({ field }) => (
              <FormItem>
                <FormLabel>Título *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cliente_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select
                  value={field.value ?? "_none"}
                  onValueChange={(v) => field.onChange(v === "_none" ? null : v)}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="_none">— sem cliente —</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      {OPORT_STAGES.map((s) => (
                        <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="probabilidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Probabilidade (%) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={0} max={100}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="valor_estimado" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor estimado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      {...field}
                      value={formatBRLInput(field.value)}
                      onChange={(e) => {
                        const rawVal = e.target.value;
                        const cleanDigits = rawVal.replace(/\D/g, "");
                        if (!cleanDigits) {
                          field.onChange(null);
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
              <FormField control={form.control} name="data_prevista" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data prevista</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
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
