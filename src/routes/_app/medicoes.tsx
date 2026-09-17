import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Database, FileOutput, Plus, Pencil, Trash2, Ruler, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  medicaoSchema, type MedicaoFormValues, type StatusMedicao,
  STATUS_MEDICAO_LABEL, STATUS_MEDICAO_BADGE, statusMedicaoEnum,
} from "@/lib/medicoes.schema";
import { cn } from "@/lib/utils";
import { MedicaoRelatorio } from "@/components/medicoes/medicao-relatorio";
import {
  ReferenciaCustosPicker,
  type ReferenciaCustoSelecionada,
} from "@/components/referencias/referencia-custos-picker";

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

export const Route = createFileRoute("/_app/medicoes")({ component: MedicoesPage });

interface MedicaoRow {
  id: string; numero: string; obra_id: string; contrato_id: string | null;
  periodo_inicio: string; periodo_fim: string;
  percentual_total: number; percentual_anterior?: number; percentual_disponivel?: number; valor_total: number;
  status: StatusMedicao; observacoes: string | null;
}
interface MedicaoItemRow {
  id: string;
  descricao: string; unidade: string | null;
  qtd_contratada: number; qtd_executada: number;
  valor_unitario: number; valor_total: number;
  referencia_id: string | null;
  fonte_referencia: "sinapi" | "sicro" | null;
  tipo_referencia: "insumo" | "composicao" | null;
  codigo_referencia: string | null;
  referencia_uf: string | null;
  referencia_mes: string | null;
  proposta_item_id: string | null; etapa_codigo: string | null; etapa_nome: string | null;
  item_codigo: string | null; item_nome: string | null; subitem_codigo: string | null;
  percentual_executado: number;
}
interface ObraOpt { id: string; numero: string; nome: string }
interface ContratoOpt { id: string; numero: string; titulo: string }

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY: MedicaoFormValues = {
  obra_id: "", contrato_id: null,
  periodo_inicio: "", periodo_fim: "",
  percentual_total: 0, status: "rascunho", observacoes: "",
  itens: [{ descricao: "", unidade: "", qtd_contratada: 0, qtd_executada: 0, valor_unitario: 0 }],
};

function MedicoesPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "engenharia";
  const podeExcluir = perfil?.perfil === "admin" || perfil?.perfil === "diretor";

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MedicaoRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [relatorioTarget, setRelatorioTarget] = useState<MedicaoRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusMedicao>("all");

  const { data: medicoes, isLoading } = useQuery({
    queryKey: ["medicoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicoes").select("*").order("numero", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MedicaoRow[];
    },
  });

  const { data: obras } = useQuery({
    queryKey: ["obras-opt-med"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("id,numero,nome").order("nome");
      if (error) throw error;
      return (data ?? []) as ObraOpt[];
    },
  });
  const { data: contratos } = useQuery({
    queryKey: ["contratos-opt-med"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("id,numero,titulo").order("created_at",{ascending:false});
      if (error) throw error;
      return (data ?? []) as ContratoOpt[];
    },
  });

  const obrasMap = useMemo(() => {
    const m: Record<string, ObraOpt> = {};
    (obras ?? []).forEach((o) => { m[o.id] = o; });
    return m;
  }, [obras]);

  const filtradas = useMemo(() => {
    if (!medicoes) return [];
    return statusFilter === "all" ? medicoes : medicoes.filter((m) => m.status === statusFilter);
  }, [medicoes, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medicoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medição excluída");
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 justify-between">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statusMedicaoEnum.options.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_MEDICAO_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {podeEditar && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Nova medição
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Obra</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>%</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                <Ruler className="size-8 mx-auto mb-2 opacity-50" />
                Nenhuma medição encontrada
              </TableCell></TableRow>
            ) : filtradas.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.numero}</TableCell>
                <TableCell className="text-sm">
                  {obrasMap[m.obra_id]?.numero ?? "—"} <span className="text-muted-foreground">{obrasMap[m.obra_id]?.nome ?? ""}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(m.periodo_inicio + "T00:00").toLocaleDateString("pt-BR")}
                  {" → "}
                  {new Date(m.periodo_fim + "T00:00").toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="font-mono text-xs">{Number(m.percentual_total).toFixed(2)}%</TableCell>
                <TableCell>
                  <Badge className={cn(STATUS_MEDICAO_BADGE[m.status])}>
                    {STATUS_MEDICAO_LABEL[m.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{fmtBRL(m.valor_total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="size-8" title="Gerar relatório para cliente"
                      onClick={() => setRelatorioTarget(m)}>
                      <FileOutput className="size-3.5" />
                    </Button>
                    {podeEditar && (
                      <Button size="icon" variant="ghost" className="size-8"
                        onClick={() => { setEditTarget(m); setFormOpen(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button size="icon" variant="ghost" className="size-8 text-destructive"
                        onClick={() => setDeleteId(m.id)}>
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

      <MedicaoFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
        target={editTarget}
        obras={obras ?? []}
        contratos={contratos ?? []}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["medicoes"] })}
      />

      <MedicaoRelatorio
        medicao={relatorioTarget}
        open={!!relatorioTarget}
        onOpenChange={(o) => { if (!o) setRelatorioTarget(null); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir medição?</AlertDialogTitle>
            <AlertDialogDescription>Os itens da medição serão removidos junto.</AlertDialogDescription>
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
  );
}

function MedicaoFormDialog({
  open, onOpenChange, target, obras, contratos, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: MedicaoRow | null;
  obras: ObraOpt[];
  contratos: ContratoOpt[];
  onSuccess: () => void;
}) {
  const bloqueado = !!target && (target.status === "aprovada" || target.status === "faturada");
  const apenasVisual = !!target && ((target as any).itens?.some((i: any) => Number(i.qtd_executada) > 0) ?? false);
  const somenteLeitura = bloqueado || apenasVisual;
  const { user } = useAuth();
  const form = useForm<MedicaoFormValues>({
    resolver: zodResolver(medicaoSchema),
    defaultValues: EMPTY,
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "itens" });
  const [referenciaOpen, setReferenciaOpen] = useState(false);
  const itensWatch = form.watch("itens");

  const adicionarReferencia = (referencia: ReferenciaCustoSelecionada) => {
    const novoItem = {
      descricao: referencia.descricao,
      unidade: referencia.unidade,
      qtd_contratada: 1,
      qtd_executada: 0,
      valor_unitario: referencia.valorUnitario,
      referencia_id: referencia.id,
      fonte_referencia: referencia.fonte,
      tipo_referencia: referencia.tipo,
      codigo_referencia: referencia.codigo,
      referencia_uf: referencia.uf,
      referencia_mes: referencia.competencia,
    };
    if (fields.length === 1 && !form.getValues("itens.0.descricao")) replace([novoItem]);
    else append(novoItem);
  };
  const totalCalc = useMemo(
    () => (itensWatch ?? []).reduce(
      (s, it) => s + (Number(it?.qtd_contratada) || 0) * (Number(it?.percentual_executado) || 0) / 100 * (Number(it?.valor_unitario) || 0),
      0,
    ),
    [itensWatch],
  );

  useEffect(() => {
    if (!open) return;
    if (target) {
      (async () => {
        const { data } = await supabase.from("medicoes_itens")
          .select("*").eq("medicao_id", target.id).order("created_at");
        const itens = ((data ?? []) as MedicaoItemRow[]).map((i) => ({
          descricao: i.descricao, unidade: i.unidade ?? "",
          qtd_contratada: Number(i.qtd_contratada),
          qtd_executada: Number(i.qtd_executada),
          valor_unitario: Number(i.valor_unitario),
          referencia_id: i.referencia_id,
          fonte_referencia: i.fonte_referencia,
          tipo_referencia: i.tipo_referencia,
          codigo_referencia: i.codigo_referencia,
          referencia_uf: i.referencia_uf,
          referencia_mes: i.referencia_mes,
          proposta_item_id: i.proposta_item_id,
          etapa_codigo: i.etapa_codigo, etapa_nome: i.etapa_nome,
          item_codigo: i.item_codigo, item_nome: i.item_nome,
          subitem_codigo: i.subitem_codigo,
          percentual_executado: Number(i.percentual_executado ?? 0),
        }));
        form.reset({
          obra_id: target.obra_id,
          contrato_id: target.contrato_id,
          periodo_inicio: target.periodo_inicio,
          periodo_fim: target.periodo_fim,
          percentual_total: Number(target.percentual_total),
          status: target.status,
          observacoes: target.observacoes ?? "",
          itens: itens.length ? itens : EMPTY.itens,
        });
      })();
    } else {
      form.reset(EMPTY);
    }
  }, [open, target, form]);

  const onSubmit = async (values: MedicaoFormValues) => {
    if (somenteLeitura) return;
    try {
      const baseMed = {
        obra_id: values.obra_id,
        contrato_id: values.contrato_id || null,
        periodo_inicio: values.periodo_inicio,
        periodo_fim: values.periodo_fim,
        percentual_total: values.percentual_total,
        status: values.status,
        observacoes: values.observacoes || null,
      };

      let medicaoId: string;
      if (target) {
        const { error } = await supabase.from("medicoes").update(baseMed).eq("id", target.id);
        if (error) throw error;
        medicaoId = target.id;
        await supabase.from("medicoes_itens").delete().eq("medicao_id", medicaoId);
      } else {
        const { data, error } = await supabase.from("medicoes")
          .insert({ ...baseMed, created_by: user?.id ?? null }).select("id").single();
        if (error) throw error;
        medicaoId = data!.id;
      }

      const itens = values.itens.map((i) => ({
        medicao_id: medicaoId,
        descricao: i.descricao,
        unidade: i.unidade || null,
        qtd_contratada: i.qtd_contratada,
        qtd_executada: i.qtd_executada,
        valor_unitario: i.valor_unitario,
        valor_total: Number((i.qtd_executada || 0) * (i.valor_unitario || 0)),
        referencia_id: i.referencia_id || null,
        fonte_referencia: i.fonte_referencia || null,
        tipo_referencia: i.tipo_referencia || null,
        codigo_referencia: i.codigo_referencia || null,
        referencia_uf: i.referencia_uf || null,
        referencia_mes: i.referencia_mes || null,
        proposta_item_id: i.proposta_item_id || null,
        etapa_codigo: i.etapa_codigo || null, etapa_nome: i.etapa_nome || null,
        item_codigo: i.item_codigo || null, item_nome: i.item_nome || null,
        subitem_codigo: i.subitem_codigo || null,
        percentual_executado: Number(i.percentual_executado || 0),
      }));
      const { error: iErr } = await (supabase as any).from("medicoes_itens").insert(itens);
      if (iErr) throw iErr;

      toast.success(target ? "Medição atualizada" : "Medição criada");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{somenteLeitura ? "Visualizar medição" : (target ? "Editar medição" : "Nova medição")}</DialogTitle>
          <DialogDescription>Boletim de medição da obra.</DialogDescription>
          {target && <p className="text-sm text-muted-foreground">Já executado: <b>{Number(target.percentual_anterior ?? 0).toLocaleString("pt-BR")}%</b> · Saldo disponível: <b>{Number(target.percentual_disponivel ?? 100).toLocaleString("pt-BR")}%</b></p>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="obra_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Obra *</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.numero} — {o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contrato_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contrato</FormLabel>
                  <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {contratos.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero} — {c.titulo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {statusMedicaoEnum.options.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_MEDICAO_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="periodo_inicio" render={({ field }) => (
                <FormItem><FormLabel>Início *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="periodo_fim" render={({ field }) => (
                <FormItem><FormLabel>Fim *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">% executado nesta medição</label>
                <div className="rounded-md border bg-muted px-3 py-2 text-sm font-medium">
                  {target ? `${Number(target.percentual_total).toLocaleString("pt-BR")}% (calculado automaticamente)` : "Será calculado a partir dos itens medidos"}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">Itens medidos *</label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1"
                    onClick={() => setReferenciaOpen(true)}>
                    <Database className="size-3.5" /> SINAPI/SICRO
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1"
                    onClick={() => append({ descricao: "", unidade: "", qtd_contratada: 0, qtd_executada: 0, valor_unitario: 0 })}>
                    <Plus className="size-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {fields.map((f, idx) => {
                  const it = itensWatch?.[idx];
                  const sub = (Number(it?.qtd_contratada) || 0) * (Number(it?.percentual_executado) || 0) / 100 * (Number(it?.valor_unitario) || 0);
                  return (
                    <div key={f.id} className="rounded-md border p-2"><div className="text-[10px] font-semibold text-muted-foreground mb-1">{[it?.etapa_codigo, it?.etapa_nome, it?.item_codigo, it?.item_nome].filter(Boolean).join(" · ") || "Item"}</div><div className="grid grid-cols-[minmax(0,1fr)_60px_60px_60px_70px_70px_60px_auto] gap-1 items-end">
                      <FormField control={form.control} name={`itens.${idx}.descricao`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormControl><Input placeholder="Descrição" {...field} className="h-7 text-xs" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`itens.${idx}.unidade`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormControl><Input placeholder="un" {...field} className="h-7 text-xs w-14" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`itens.${idx}.qtd_contratada`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormLabel className="text-[10px]">Contrat</FormLabel><FormControl><Input type="number" step="0.01" placeholder="T" {...field} disabled={!!it?.qtd_executada && Number(it.qtd_executada) > 0} className="h-7 text-xs" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`itens.${idx}.qtd_executada`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormLabel className="text-[10px]">Exec</FormLabel><FormControl><Input type="number" step="0.01" placeholder="J" {...field} disabled={!!field.value && Number(field.value) > 0} className="h-7 text-xs" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`itens.${idx}.percentual_executado`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormLabel className="text-[10px]">%</FormLabel><FormControl><Input type="number" min="0" max="100" step="0.01" placeholder="%" {...field} className="h-7 text-xs" /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name={`itens.${idx}.valor_unitario`} render={({ field }) => (
                        <FormItem className="!mb-0"><FormLabel className="text-[10px]">Unit.</FormLabel><FormControl><Input type="number" step="0.01" placeholder="R$" {...field} className="h-7 text-xs" /></FormControl></FormItem>
                      )} />
                      <div className="h-7 flex items-center justify-end text-xs font-mono">{fmtBRL(sub)}</div>
                      <Button type="button" size="icon" variant="ghost" className="text-destructive"
                        onClick={() => remove(idx)}><X className="size-4" /></Button>
                    </div></div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-3 text-sm">
                <span className="text-muted-foreground mr-2">Total:</span>
                <span className="font-mono font-semibold">{fmtBRL(totalCalc)}</span>
              </div>
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <ReferenciaCustosPicker
              open={referenciaOpen}
              onOpenChange={setReferenciaOpen}
              onSelect={adicionarReferencia}
              title="Adicionar referência à medição"
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando…" : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
