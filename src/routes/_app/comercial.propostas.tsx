import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, Printer, Settings2, CheckCircle2, XCircle, Database, ArrowDown, ArrowUp, Calculator } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import {
  propostaSchema, type PropostaFormValues, type StatusProposta,
  STATUS_PROPOSTA_LABEL, STATUS_PROPOSTA_BADGE, statusPropostaEnum,
} from "@/lib/clientes.schema";
import { cn, formatBRLInput } from "@/lib/utils";
import { CatalogoPropostas } from "@/components/propostas/catalogo-propostas";
import { PropostaImpressao } from "@/components/propostas/proposta-impressao";
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

export const Route = createFileRoute("/_app/comercial/propostas")({
  component: PropostasPage,
});

interface PropostaRow {
  id: string;
  numero: string;
  cliente_id: string;
  oportunidade_id: string | null;
  titulo: string;
  descricao: string | null;
  valor_total: number;
  status: StatusProposta;
  validade: string | null;
  data_envio: string | null;
  condicoes_pagamento: string | null;
  observacoes: string | null;
}
interface ItemRow {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  referencia_id: string | null;
  fonte_referencia: "sinapi" | "sicro" | null;
  tipo_referencia: "insumo" | "composicao" | null;
  codigo_referencia: string | null;
  referencia_uf: string | null;
  referencia_mes: string | null;
  etapa_codigo: string | null; etapa_nome: string | null;
  item_codigo: string | null; item_nome: string | null;
  subitem_codigo: string | null; unidade: string | null;
}
interface ClienteOpt { id: string; nome: string }
interface CatalogoSubitem { id: string; codigo: string; descricao: string; unidade: string; valor_unitario: number }
interface CatalogoItem { id: string; codigo: string; descricao: string; propostas_catalogo_subitens: CatalogoSubitem[] }
interface CatalogoEtapa { id: string; nome: string; descricao: string | null; propostas_catalogo_itens: CatalogoItem[] }
interface SubetapaSelecionada {
  chave: string; etapaId: string; etapaNome: string; itemId: string; itemCodigo: string;
  itemNome: string; subitemId: string; subitemCodigo: string; descricao: string;
  unidade: string; valorUnitario: number;
}

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY: PropostaFormValues = {
  cliente_id: "",
  oportunidade_id: null,
  titulo: "",
  descricao: "",
  status: "rascunho",
  validade: "",
  data_envio: "",
  condicoes_pagamento: "",
  observacoes: "",
  itens: [],
};

function PropostasPage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const podeEditar =
    perfil?.perfil === "admin" ||
    perfil?.perfil === "diretor" ||
    perfil?.perfil === "financeiro_civil" ||
    perfil?.perfil === "financeiro_imobiliaria";
  const podeExcluir = perfil?.perfil === "admin" || perfil?.perfil === "diretor";

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PropostaRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<PropostaRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusProposta>("all");
  const [catalogoOpen, setCatalogoOpen] = useState(false);

  const { data: propostas, isLoading } = useQuery({
    queryKey: ["propostas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropostaRow[];
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

  const clientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientes ?? []).forEach((c) => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  const filtradas = useMemo(() => {
    if (!propostas) return [];
    if (statusFilter === "all") return propostas;
    return propostas.filter((p) => p.status === statusFilter);
  }, [propostas, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("propostas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposta excluída");
      qc.invalidateQueries({ queryKey: ["propostas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decidirProposta = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "aceita" | "rejeitada" }) => {
      const { error } = await supabase.from("propostas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variaveis) => {
      toast.success(variaveis.status === "aceita" ? "Proposta aceita e obra criada" : "Proposta rejeitada");
      qc.invalidateQueries({ queryKey: ["propostas"] });
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Propostas</h1>
        <p className="text-sm text-muted-foreground">
          Gestão e acompanhamento de propostas comerciais de orçamentos de obras.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            {podeEditar && <Button variant="outline" onClick={() => setCatalogoOpen(true)}><Settings2 className="size-4" /> Catálogo</Button>}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statusPropostaEnum.options.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_PROPOSTA_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {podeEditar && (
            <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
              <Plus className="size-4" /> Nova proposta
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
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <FileText className="size-8 mx-auto mb-2 opacity-50" />
                  Nenhuma proposta encontrada
                </TableCell></TableRow>
              ) : filtradas.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                  <TableCell className="font-medium">{p.titulo}</TableCell>
                  <TableCell>{clientesMap[p.cliente_id] ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn(STATUS_PROPOSTA_BADGE[p.status])}>
                      {STATUS_PROPOSTA_LABEL[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.validade ? new Date(p.validade + "T00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{fmtBRL(p.valor_total)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {(p.status === "rascunho" || p.status === "enviada") && <>
                        <Button size="icon" variant="ghost" className="size-8 text-green-700 hover:text-green-800" title="Aceitar proposta e criar obra" onClick={() => decidirProposta.mutate({ id: p.id, status: "aceita" })}>
                          <CheckCircle2 className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8 text-destructive" title="Rejeitar proposta" onClick={() => decidirProposta.mutate({ id: p.id, status: "rejeitada" })}>
                          <XCircle className="size-4" />
                        </Button>
                      </>}
                      <Button size="icon" variant="ghost" className="size-8" title="Gerar proposta para envio" onClick={() => setPrintTarget(p)}>
                        <Printer className="size-3.5" />
                      </Button>
                      {podeEditar && (
                        <Button size="icon" variant="ghost" className="size-8"
                          onClick={() => { setEditTarget(p); setFormOpen(true); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button size="icon" variant="ghost" className="size-8 text-destructive"
                          onClick={() => setDeleteId(p.id)}>
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

        <Dialog open={catalogoOpen} onOpenChange={setCatalogoOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Catálogo de etapas, itens e subitens</DialogTitle><DialogDescription>Cadastre e mantenha os modelos usados nas propostas.</DialogDescription></DialogHeader>
            <CatalogoPropostas />
          </DialogContent>
        </Dialog>

        <PropostaFormDialog
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
          target={editTarget}
          clientes={clientes ?? []}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["propostas"] })}
        />

        <PropostaImpressao proposta={printTarget} open={!!printTarget} onOpenChange={(o) => !o && setPrintTarget(null)} />

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Os itens também serão removidos.
              </AlertDialogDescription>
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

function PropostaFormDialog({
  open, onOpenChange, target, clientes, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: PropostaRow | null;
  clientes: ClienteOpt[];
  onSuccess: () => void;
}) {
  const isEdit = !!target;
  const { user } = useAuth();
  const form = useForm<PropostaFormValues>({
    resolver: zodResolver(propostaSchema),
    defaultValues: EMPTY,
  });
  const itens = useFieldArray({ control: form.control, name: "itens" });
  const [etapaDisponivel, setEtapaDisponivel] = useState("");
  const [subetapasSelecionadas, setSubetapasSelecionadas] = useState<SubetapaSelecionada[]>([]);
  const [referenciaOpen, setReferenciaOpen] = useState(false);
  const [calculadoraOpen, setCalculadoraOpen] = useState(false);

  const adicionarReferencia = (referencia: ReferenciaCustoSelecionada) => {
    const novoItem = {
      descricao: referencia.descricao,
      unidade: "un",
      quantidade: 1,
      valor_unitario: referencia.valorUnitario,
      referencia_id: referencia.id,
      fonte_referencia: referencia.fonte,
      tipo_referencia: referencia.tipo,
      codigo_referencia: referencia.codigo,
      referencia_uf: referencia.uf,
      referencia_mes: referencia.competencia,
    };
    if (itens.fields.length === 0 || (itens.fields.length === 1 && !form.getValues("itens.0.descricao"))) itens.replace([novoItem]);
    else itens.append(novoItem);
  };
  const { data: catalogoEtapas = [] } = useQuery({
    queryKey: ["catalogo-etapas-proposta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("propostas_catalogo_etapas")
        .select("id,nome,descricao,propostas_catalogo_itens(id,codigo,descricao,propostas_catalogo_subitens(id,codigo,descricao,unidade,valor_unitario))")
        .eq("ativo", true).order("ordem");
      if (error) throw error;
      return (data ?? []) as CatalogoEtapa[];
    },
  });
  const etapaAtual = useMemo(
    () => catalogoEtapas.find((etapa) => etapa.id === etapaDisponivel) ?? null,
    [catalogoEtapas, etapaDisponivel],
  );
  const subetapasDisponiveis = useMemo<SubetapaSelecionada[]>(
    () => (etapaAtual?.propostas_catalogo_itens ?? []).flatMap((item) =>
      (item.propostas_catalogo_subitens ?? []).map((subitem) => ({
        chave: `${etapaAtual.id}:${item.id}:${subitem.id}`,
        etapaId: etapaAtual.id,
        etapaNome: etapaAtual.nome,
        itemId: item.id,
        itemCodigo: item.codigo,
        itemNome: item.descricao,
        subitemId: subitem.id,
        subitemCodigo: subitem.codigo,
        descricao: subitem.descricao,
        unidade: subitem.unidade || "un",
        valorUnitario: Number(subitem.valor_unitario ?? 0),
      })),
    ),
    [etapaAtual],
  );
  const incluirSubetapaCatalogo = (subetapa: SubetapaSelecionada) => {
    if (subetapasSelecionadas.some((selecionada) => selecionada.chave === subetapa.chave)) return;
    setSubetapasSelecionadas((atuais) => [...atuais, subetapa]);
    const linha = {
      descricao: subetapa.descricao,
      unidade: subetapa.unidade,
      quantidade: 1,
      valor_unitario: subetapa.valorUnitario,
      etapa_codigo: String(catalogoEtapas.findIndex((etapa) => etapa.id === subetapa.etapaId) + 1),
      etapa_nome: subetapa.etapaNome,
      item_codigo: subetapa.itemCodigo,
      item_nome: subetapa.itemNome,
      subitem_codigo: subetapa.subitemCodigo,
    };
    if (itens.fields.length === 0 || (itens.fields.length === 1 && !form.getValues("itens.0.descricao"))) itens.replace([linha]);
    else itens.append(linha);
  };
  const removerSubetapaCatalogo = (subetapa: SubetapaSelecionada) => {
    setSubetapasSelecionadas((atuais) => atuais.filter((atual) => atual.chave !== subetapa.chave));
    itens.replace(form.getValues("itens").filter((item) =>
      item.etapa_nome !== subetapa.etapaNome ||
      item.item_codigo !== subetapa.itemCodigo ||
      item.subitem_codigo !== subetapa.subitemCodigo,
    ));
  };
  const subetapasPorEtapa = useMemo(() => subetapasSelecionadas.reduce<Record<string, SubetapaSelecionada[]>>(
    (grupos, subetapa) => ({ ...grupos, [subetapa.etapaNome]: [...(grupos[subetapa.etapaNome] ?? []), subetapa] }),
    {},
  ), [subetapasSelecionadas]);
  const watchedItens = useWatch({ control: form.control, name: "itens" });
  const total = useMemo(
    () => (watchedItens ?? []).reduce(
      (s, i) => s + (Number(i?.quantidade || 0) * Number(i?.valor_unitario || 0)), 0,
    ),
    [watchedItens],
  );

  useEffect(() => {
    if (!open) return;
    if (target) {
      (async () => {
        const { data, error } = await (supabase as any)
          .from("propostas_itens")
          .select("id,descricao,unidade,quantidade,valor_unitario,referencia_id,fonte_referencia,tipo_referencia,codigo_referencia,referencia_uf,referencia_mes,etapa_codigo,etapa_nome,item_codigo,item_nome,subitem_codigo")
          .eq("proposta_id", target.id)
          .order("ordem", { ascending: true });
        if (error) toast.error(error.message);
        const its = ((data ?? []) as ItemRow[]).map((i) => ({
          id: i.id, descricao: i.descricao,
          quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
          referencia_id: i.referencia_id,
          fonte_referencia: i.fonte_referencia,
          tipo_referencia: i.tipo_referencia,
          codigo_referencia: i.codigo_referencia,
          referencia_uf: i.referencia_uf,
          referencia_mes: i.referencia_mes,
          etapa_codigo: i.etapa_codigo, etapa_nome: i.etapa_nome,
          item_codigo: i.item_codigo, item_nome: i.item_nome,
          subitem_codigo: i.subitem_codigo, unidade: i.unidade ?? "un",
        }));
        form.reset({
          cliente_id: target.cliente_id,
          titulo: target.titulo,
          descricao: target.descricao ?? "",
          status: target.status,
          validade: target.validade ?? "",
          data_envio: target.data_envio ?? "",
          condicoes_pagamento: target.condicoes_pagamento ?? "",
          observacoes: target.observacoes ?? "",
          itens: its.length ? its : [{ descricao: "", quantidade: 1, valor_unitario: 0 }],
        });
      })();
    } else {
      form.reset(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  const mutation = useMutation({
    mutationFn: async (values: PropostaFormValues) => {
      const head = {
        cliente_id: values.cliente_id,
        titulo: values.titulo,
        descricao: values.descricao || null,
        status: values.status,
        validade: values.validade || null,
        data_envio: values.data_envio || null,
        condicoes_pagamento: values.condicoes_pagamento || null,
        observacoes: values.observacoes || null,
      };
      let propostaId = target?.id;
      if (isEdit && target) {
        const { error } = await supabase.from("propostas").update(head).eq("id", target.id);
        if (error) throw error;
        const { error: delErr } = await supabase
          .from("propostas_itens").delete().eq("proposta_id", target.id);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase
          .from("propostas")
          .insert({ ...head, numero: "", created_by: user?.id ?? null })
          .select("id").single();
        if (error) throw error;
        propostaId = data.id;
      }
      const itensPayload = values.itens.map((i, idx) => ({
        proposta_id: propostaId!,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        referencia_id: i.referencia_id || null,
        fonte_referencia: i.fonte_referencia || null,
        tipo_referencia: i.tipo_referencia || null,
        codigo_referencia: i.codigo_referencia || null,
        referencia_uf: i.referencia_uf || null,
        referencia_mes: i.referencia_mes || null,
        etapa_codigo: i.etapa_codigo || null,
        etapa_nome: i.etapa_nome || null,
        item_codigo: i.item_codigo || null,
        item_nome: i.item_nome || null,
        subitem_codigo: i.subitem_codigo || null,
        unidade: i.unidade || "un",
        ordem: idx,
      }));
      const { error: insErr } = await (supabase as any).from("propostas_itens").insert(itensPayload);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Proposta atualizada" : "Proposta criada");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${target?.numero}` : "Nova proposta"}</DialogTitle>
          <DialogDescription>Cabeçalho e itens da proposta comercial</DialogDescription>
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
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {statusPropostaEnum.options.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_PROPOSTA_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="data_envio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data envio</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="validade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="rounded-md border bg-muted/20 p-4 space-y-3">
              <div>
                <h3 className="font-semibold">Etapas do orçamento</h3>
                <p className="text-sm text-muted-foreground">Escolha a etapa e inclua somente as subetapas necessárias para esta proposta.</p>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="mb-2 text-sm font-medium">1. Etapa disponível</p>
                <Select value={etapaDisponivel} onValueChange={setEtapaDisponivel}>
                  <SelectTrigger><SelectValue placeholder={catalogoEtapas.length ? "Selecione uma etapa" : "Nenhuma etapa cadastrada"} /></SelectTrigger>
                  <SelectContent>
                    {catalogoEtapas.map((etapa) => <SelectItem key={etapa.id} value={etapa.id}>{etapa.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="mb-2 text-sm font-medium">2. Subetapas disponíveis</p>
                {!etapaAtual ? (
                  <p className="py-3 text-sm text-muted-foreground">Selecione uma etapa para visualizar suas subetapas.</p>
                ) : subetapasDisponiveis.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Esta etapa ainda não possui subetapas cadastradas.</p>
                ) : (
                  <div className="space-y-2">
                    {subetapasDisponiveis.map((subetapa) => {
                      const incluida = subetapasSelecionadas.some((selecionada) => selecionada.chave === subetapa.chave);
                      return (
                        <div key={subetapa.chave} className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">{subetapa.itemCodigo} {subetapa.itemNome}</p>
                            <p className="text-muted-foreground">{subetapa.subitemCodigo} · {subetapa.descricao} · {subetapa.unidade}</p>
                          </div>
                          <Button type="button" size="sm" variant={incluida ? "secondary" : "default"} disabled={incluida} onClick={() => incluirSubetapaCatalogo(subetapa)}>
                            {incluida ? "Incluída" : "Incluir"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="rounded-md border bg-background p-3">
                <p className="mb-2 text-sm font-medium">3. Subetapas incluídas</p>
                {subetapasSelecionadas.length === 0 ? (
                  <p className="py-3 text-sm text-muted-foreground">Nenhuma subetapa incluída nesta proposta.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(subetapasPorEtapa).map(([etapaNome, subetapas]) => (
                      <div key={etapaNome} className="rounded-md border p-3">
                        <p className="mb-2 font-semibold">{etapaNome}</p>
                        <div className="space-y-2">
                          {subetapas.map((subetapa) => (
                            <div key={subetapa.chave} className="flex items-center justify-between gap-2 text-sm">
                              <span>{subetapa.subitemCodigo} · {subetapa.descricao}</span>
                              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removerSubetapaCatalogo(subetapa)}>Remover</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Itens *</label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1"
                    onClick={() => setCalculadoraOpen(true)}>
                    <Calculator className="size-3.5" /> Calculadora
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1"
                    onClick={() => setReferenciaOpen(true)}>
                    <Database className="size-3.5" /> SINAPI/SICRO
                  </Button>

                </div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-20">Unid.</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead className="w-32">Vlr unit.</TableHead>
                      <TableHead className="w-28 text-right">Subtotal</TableHead>
                      <TableHead className="w-20 text-center">Ordem</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.fields.map((f, idx) => {
                      const currentItem = watchedItens?.[idx];
                      const q = Number(currentItem?.quantidade || 0);
                      const v = Number(currentItem?.valor_unitario || 0);
                      return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <Input
                              {...form.register(`itens.${idx}.descricao`)}
                              placeholder="Descrição"
                            />
                            {currentItem?.fonte_referencia && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {currentItem.fonte_referencia.toUpperCase()} · {currentItem.codigo_referencia} · {currentItem.referencia_uf} · {currentItem.referencia_mes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label="Unidade de medida"
                              {...form.register(`itens.${idx}.unidade`)}
                              placeholder="un"
                            />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.001" min="0"
                              {...form.register(`itens.${idx}.quantidade`, { valueAsNumber: true })}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`itens.${idx}.valor_unitario`}
                              render={({ field }) => (
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
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmtBRL(q * v)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-1">
                              <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Subir item"
                                disabled={idx === 0} onClick={() => itens.move(idx, idx - 1)}>
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Descer item"
                                disabled={idx === itens.fields.length - 1} onClick={() => itens.move(idx, idx + 1)}>
                                <ArrowDown className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="icon" variant="ghost"
                              className="size-7 text-destructive"
                              onClick={() => itens.remove(idx)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {form.formState.errors.itens && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.itens.message ?? "Verifique os itens"}
                </p>
              )}
              <div className="flex justify-end text-sm font-semibold pr-12">
                Total: <span className="font-mono ml-2">{fmtBRL(total)}</span>
              </div>
            </div>

            <FormField control={form.control} name="condicoes_pagamento" render={({ field }) => (
              <FormItem>
                <FormLabel>Condições de pagamento</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <CalculadoraDialog open={calculadoraOpen} onOpenChange={setCalculadoraOpen} />
            
            <ReferenciaCustosPicker
              open={referenciaOpen}
              onOpenChange={setReferenciaOpen}
              onSelect={adicionarReferencia}
              title="Adicionar referência à proposta"
            />

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


function CalculadoraDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [primeiroValor, setPrimeiroValor] = useState("0");
  const [segundoValor, setSegundoValor] = useState("0");
  const [operacao, setOperacao] = useState<"+" | "-" | "*" | "/">("+");

  const resultado = useMemo(() => {
    const primeiro = Number(primeiroValor.replace(",", ".")) || 0;
    const segundo = Number(segundoValor.replace(",", ".")) || 0;
    if (operacao === "+") return primeiro + segundo;
    if (operacao === "-") return primeiro - segundo;
    if (operacao === "*") return primeiro * segundo;
    return segundo === 0 ? null : primeiro / segundo;
  }, [primeiroValor, segundoValor, operacao]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Calculadora</DialogTitle>
          <DialogDescription>Use como apoio ao orçamento. O resultado não altera os itens automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-[1fr_100px_1fr] items-end gap-2">
          <div className="space-y-2">
            <label htmlFor="calculadora-primeiro" className="text-sm font-medium">Primeiro valor</label>
            <Input id="calculadora-primeiro" inputMode="decimal" value={primeiroValor} onChange={(event) => setPrimeiroValor(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="calculadora-operacao" className="text-sm font-medium">Operação</label>
            <Select value={operacao} onValueChange={(value) => setOperacao(value as typeof operacao)}>
              <SelectTrigger id="calculadora-operacao"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="+">Somar (+)</SelectItem>
                <SelectItem value="-">Subtrair (−)</SelectItem>
                <SelectItem value="*">Multiplicar (×)</SelectItem>
                <SelectItem value="/">Dividir (÷)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="calculadora-segundo" className="text-sm font-medium">Segundo valor</label>
            <Input id="calculadora-segundo" inputMode="decimal" value={segundoValor} onChange={(event) => setSegundoValor(event.target.value)} />
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 p-4 text-right">
          <p className="text-xs text-muted-foreground">Resultado</p>
          <p className="font-mono text-lg font-semibold">{resultado === null ? "Não é possível dividir por zero" : fmtBRL(resultado)}</p>
        </div>
        <DialogFooter><Button type="button" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
