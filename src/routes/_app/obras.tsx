import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Calculator, Plus, Pencil, Trash2, HardHat, Ruler, ListTree } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { useAuth } from "@/hooks/use-auth";
import { canAccess } from "@/lib/permissions";
import {
  obraSchema, type ObraFormValues, type StatusObra,
  STATUS_OBRA_LABEL, STATUS_OBRA_BADGE, statusObraEnum,
} from "@/lib/obras.schema";
import { UFS } from "@/lib/clientes.schema";
import { buscarCep } from "@/lib/cep";
import { formatCep } from "@/lib/validacao-documento";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/obras")({
  component: ObrasPage,
});

interface ObraRow {
  id: string;
  numero: string;
  nome: string;
  descricao: string | null;
  cliente_id: string;
  contrato_id: string | null;
  responsavel_id: string | null;
  status: StatusObra;
  orcamento: number;
  valor_executado: number;
  progresso: number;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_inicio_real: string | null;
  data_fim_real: string | null;
  cep: string | null;
  logradouro: string | null;
  numero_endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
}
interface ClienteOpt { id: string; nome: string }
interface ContratoOpt { id: string; numero: string; titulo: string }
interface UsuarioOpt { user_id: string; nome: string }

const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY: ObraFormValues = {
  nome: "", descricao: "",
  cliente_id: "", contrato_id: null, responsavel_id: null,
  status: "planejamento",
  orcamento: 0, valor_executado: 0, progresso: 0,
  data_inicio_prevista: "", data_fim_prevista: "",
  data_inicio_real: "", data_fim_real: "",
  cep: "", logradouro: "", numero_endereco: "", complemento: "",
  bairro: "", cidade: "", uf: "",
  observacoes: "",
};

function ObrasPage() {
  const { perfil, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const podeEditar =
    perfil?.perfil === "admin" || perfil?.perfil === "diretor" || perfil?.perfil === "engenharia";
  const podeExcluir = perfil?.perfil === "admin" || perfil?.perfil === "diretor";

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ObraRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | StatusObra>("all");
  const [busca, setBusca] = useState("");
  const [escopoTarget, setEscopoTarget] = useState<ObraRow | null>(null);

  const { data: escopo = [], isLoading: escopoLoading } = useQuery({
    queryKey: ["escopo-obra", escopoTarget?.id], enabled: !!escopoTarget,
    queryFn: async () => { const { data, error } = await (supabase as any).rpc("escopo_obra", { p_obra_id: escopoTarget!.id }); if (error) throw error; return data ?? []; },
  });

  const { data: obras, isLoading } = useQuery({
    queryKey: ["obras"],
    staleTime: 1000 * 60 * 3,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ObraRow[];
    },
    enabled: !loading && !!perfil,
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-opt"],
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes").select("id,nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteOpt[];
    },
  });

  const { data: contratos } = useQuery({
    queryKey: ["contratos-opt"],
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos").select("id,numero,titulo").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContratoOpt[];
    },
  });

  const { data: usuarios } = useQuery({
    queryKey: ["usuarios-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_usuarios").select("user_id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as UsuarioOpt[];
    },
  });

  const clientesMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientes ?? []).forEach((c) => { m[c.id] = c.nome; });
    return m;
  }, [clientes]);

  const usuariosMap = useMemo(() => {
    const m: Record<string, string> = {};
    (usuarios ?? []).forEach((u) => { m[u.user_id] = u.nome; });
    return m;
  }, [usuarios]);

  const filtradas = useMemo(() => {
    if (!obras) return [];
    let r = obras;
    if (statusFilter !== "all") r = r.filter((o) => o.status === statusFilter);
    const q = busca.trim().toLowerCase();
    if (q) r = r.filter((o) =>
      o.nome.toLowerCase().includes(q) ||
      o.numero.toLowerCase().includes(q) ||
      (clientesMap[o.cliente_id] ?? "").toLowerCase().includes(q),
    );
    return r;
  }, [obras, statusFilter, busca, clientesMap]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obra excluída");
      qc.invalidateQueries({ queryKey: ["obras"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const criarMedicao = useMutation({
    mutationFn: async (obraId: string) => {
      const { data, error } = await supabase.rpc("criar_medicao_da_obra", {
        p_obra_id: obraId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Medição criada com sucesso");
      qc.invalidateQueries({ queryKey: ["obras"] });
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loading && perfil && !canAccess(perfil.perfil, "obras")) {
    return <div className="text-sm text-muted-foreground">Sem acesso ao módulo Obras.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
        <p className="text-sm text-muted-foreground">Gestão de projetos e canteiros.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="Buscar por nome, número ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusObraEnum.options.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_OBRA_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {podeEditar && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }} className="gap-2">
            <Plus className="size-4" /> Nova obra
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-40">Progresso</TableHead>
              <TableHead className="text-right">Orçamento</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                <HardHat className="size-8 mx-auto mb-2 opacity-50" />
                Nenhuma obra encontrada
              </TableCell></TableRow>
            ) : filtradas.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.numero}</TableCell>
                <TableCell className="font-medium">{o.nome}</TableCell>
                <TableCell>{clientesMap[o.cliente_id] ?? "—"}</TableCell>
                <TableCell>
                  <Badge className={cn(STATUS_OBRA_BADGE[o.status])}>
                    {STATUS_OBRA_LABEL[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {o.responsavel_id ? (usuariosMap[o.responsavel_id] ?? "—") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={o.progresso} className="h-2" />
                    <span className="text-xs font-mono w-10 text-right">{o.progresso}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{fmtBRL(o.orcamento)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-8 gap-1" title="Ver etapas, itens, subitens e avanço" onClick={() => setEscopoTarget(o)}><ListTree className="size-3.5" /> Escopo</Button>
                    {podeEditar && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        title="Abrir orçamento e referências SINAPI/SICRO"
                        onClick={() => navigate({ to: "/orcamentos", search: { obra: o.id } as any })}
                      >
                        <Calculator className="size-3.5" /> Custos
                      </Button>
                    )}
                    {podeEditar && (
                      <Button size="sm" variant="outline" className="h-8 gap-1" title="Criar próxima medição" onClick={() => criarMedicao.mutate(o.id)} disabled={criarMedicao.isPending}>
                        <Ruler className="size-3.5" /> Medição
                      </Button>
                    )}
                    {podeEditar && (
                      <Button size="icon" variant="ghost" className="size-8"
                        onClick={() => { setEditTarget(o); setFormOpen(true); }}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {podeExcluir && (
                      <Button size="icon" variant="ghost" className="size-8 text-destructive"
                        onClick={() => setDeleteId(o.id)}>
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

      <Dialog open={!!escopoTarget} onOpenChange={(open) => { if (!open) setEscopoTarget(null); }}><DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Escopo contratado — {escopoTarget?.nome}</DialogTitle><DialogDescription>Etapas, itens, subitens e avanço acumulado das medições.</DialogDescription></DialogHeader>{escopoLoading ? <Skeleton className="h-40 w-full" /> : escopo.length === 0 ? <p className="py-8 text-center text-muted-foreground">Esta obra não possui estrutura contratada vinculada.</p> : <div className="space-y-2">{escopo.map((linha: any) => <div key={linha.proposta_item_id} className="rounded-md border p-3"><p className="font-semibold">{[linha.etapa_codigo, linha.etapa_nome].filter(Boolean).join(" — ")}</p><p className="text-sm">{[linha.item_codigo, linha.item_nome, linha.subitem_codigo, linha.descricao].filter(Boolean).join(" · ")}</p><div className="mt-2 flex items-center gap-3"><Progress value={Number(linha.percentual_executado)} className="h-2 flex-1" /><span className="font-mono text-xs">{Number(linha.percentual_executado).toFixed(2)}%</span><span className="text-xs text-muted-foreground">Saldo {Number(linha.percentual_saldo).toFixed(2)}%</span></div></div>)}</div>}</DialogContent></Dialog>

      <ObraFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTarget(null); }}
        target={editTarget}
        clientes={clientes ?? []}
        contratos={contratos ?? []}
        usuarios={usuarios ?? []}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["obras"] })}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obra?</AlertDialogTitle>
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
  );
}

function ObraFormDialog({
  open, onOpenChange, target, clientes, contratos, usuarios, onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ObraRow | null;
  clientes: ClienteOpt[];
  contratos: ContratoOpt[];
  usuarios: UsuarioOpt[];
  onSuccess: () => void;
}) {
  const isEdit = !!target;
  const { user } = useAuth();
  const form = useForm<ObraFormValues>({
    resolver: zodResolver(obraSchema),
    defaultValues: EMPTY,
  });
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.reset({
        nome: target.nome,
        descricao: target.descricao ?? "",
        cliente_id: target.cliente_id,
        contrato_id: target.contrato_id,
        responsavel_id: target.responsavel_id,
        status: target.status,
        orcamento: Number(target.orcamento),
        valor_executado: Number(target.valor_executado),
        progresso: target.progresso,
        data_inicio_prevista: target.data_inicio_prevista ?? "",
        data_fim_prevista: target.data_fim_prevista ?? "",
        data_inicio_real: target.data_inicio_real ?? "",
        data_fim_real: target.data_fim_real ?? "",
        cep: target.cep ?? "",
        logradouro: target.logradouro ?? "",
        numero_endereco: target.numero_endereco ?? "",
        complemento: target.complemento ?? "",
        bairro: target.bairro ?? "",
        cidade: target.cidade ?? "",
        uf: (target.uf as any) ?? "",
        observacoes: target.observacoes ?? "",
      });
    } else {
      form.reset(EMPTY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target?.id]);

  const handleCepBlur = async (cep: string) => {
    if (!cep || cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const endereco = await buscarCep(cep);
    setBuscandoCep(false);
    if (endereco) {
      form.setValue("logradouro", endereco.logradouro);
      form.setValue("bairro", endereco.bairro);
      form.setValue("cidade", endereco.cidade);
      form.setValue("uf", endereco.uf as any);
    } else {
      toast.error("CEP não encontrado");
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: ObraFormValues) => {
      // Defensiva: prevenir valores inválidos antes do envio
      const progress = Math.min(100, Math.max(0, Number(values.progresso ?? 0)));
      const orcamento = Math.max(0, Number(values.orcamento ?? 0));
      const valorExecutado = Math.max(0, Number(values.valor_executado ?? 0));

      const payload = {
        nome: values.nome,
        descricao: values.descricao || null,
        cliente_id: values.cliente_id,
        contrato_id: values.contrato_id || null,
        responsavel_id: values.responsavel_id || null,
        status: values.status,
        orcamento: orcamento,
        valor_executado: valorExecutado,
        progresso: progress,
        data_inicio_prevista: values.data_inicio_prevista || null,
        data_fim_prevista: values.data_fim_prevista || null,
        data_inicio_real: values.data_inicio_real || null,
        data_fim_real: values.data_fim_real || null,
        cep: values.cep || null,
        logradouro: values.logradouro || null,
        numero_endereco: values.numero_endereco || null,
        complemento: values.complemento || null,
        bairro: values.bairro || null,
        cidade: values.cidade || null,
        uf: values.uf || null,
        observacoes: values.observacoes || null,
      };
      if (isEdit && target) {
        const { error } = await supabase.from("obras").update(payload).eq("id", target.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("obras")
          .insert({ ...payload, numero: "", created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Obra atualizada" : "Obra criada");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar ${target?.numero}` : "Nova obra"}</DialogTitle>
          <DialogDescription>Dados da obra, cronograma e endereço</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <Tabs defaultValue="dados">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
                <TabsTrigger value="itr">ITRs</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="descricao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl><Textarea rows={2} {...field} /></FormControl>
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
                  <FormField control={form.control} name="contrato_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contrato</FormLabel>
                      <Select
                        value={field.value ?? "_none"}
                        onValueChange={(v) => field.onChange(v === "_none" ? null : v)}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">— nenhum —</SelectItem>
                          {contratos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.numero} — {c.titulo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="responsavel_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável técnico</FormLabel>
                      <Select
                        value={field.value ?? "_none"}
                        onValueChange={(v) => field.onChange(v === "_none" ? null : v)}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">— ninguém —</SelectItem>
                          {usuarios.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {statusObraEnum.options.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_OBRA_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="orcamento" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orçamento (R$) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="valor_executado" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Executado (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="progresso" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Progresso (%) *</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} max={100}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
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
              </TabsContent>

              <TabsContent value="cronograma" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="data_inicio_prevista" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início previsto</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="data_fim_prevista" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim previsto</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="data_inicio_real" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início real</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="data_fim_real" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim real</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>

              <TabsContent value="itr" className="space-y-3 pt-4">
                <div className="text-sm font-medium">ITRs — Inspeção / Controle</div>
                <p className="text-xs text-muted-foreground">Cadastre inspeções por etapa da obra (tabela obra_itr já criada).</p>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4 pt-4">
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="cep" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(formatCep(e.target.value))}
                          onBlur={(e) => handleCepBlur(e.target.value)}
                          placeholder="00000-000"
                        />
                      </FormControl>
                      {buscandoCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="logradouro" render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Logradouro</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="numero_endereco" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="complemento" render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>Complemento</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField control={form.control} name="bairro" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Bairro</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="uf" render={({ field }) => (
                    <FormItem>
                      <FormLabel>UF</FormLabel>
                      <Select
                        value={(field.value as string) || "_none"}
                        onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="_none">—</SelectItem>
                          {UFS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </TabsContent>
            </Tabs>

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
